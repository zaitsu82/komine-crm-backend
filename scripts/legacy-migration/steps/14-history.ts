import type { Prisma } from '@prisma/client';
import type { RowDataPacket } from 'mysql2/promise';

import { legacyQuery } from '../legacyDb';
import { rebuildIdMap } from '../lib/id-map-loader';
import { assertIdMapsReady } from '../lib/invariants';
import { parseLegacyDate } from '../transforms';
import type { MigrationStep } from '../types';

/**
 * t_dankalog / t_famlog → History（#324）
 *
 * レガシーの履歴テーブルはスナップショット形式（変更のたびに全カラムを1行で保持）。
 * 同一エンティティ（danka_cd / family_cd）の連続レコードを世代順に比較して
 * changed_fields / before_record / after_record(JSON) を生成し History に取り込む。
 *
 *   - t_dankalog → entity_type='Customer'（entity_id=Customer UUID）
 *   - t_famlog   → entity_type='FamilyContact'（entity_id=FamilyContact UUID）
 *
 * 設計上の前提（business-confirmation 項目。komine-docs#10 / 本 issue で要確認）:
 *   - 世代の並び順は rireki_cd ASC（無ければ reg_date / PK）。rireki_cd は名義変更
 *     世代番号の可能性があり、確定したら並び順の妥当性を再確認する。
 *   - 各エンティティの最初のスナップショットは CREATE（before=null, after=全項目）、
 *     以降は UPDATE（changed_fields と差分の before/after のみ）として記録する。
 *   - change_reason（t_opelog の担当者メモ）の取り込みは未対応（業務確認後に追加可能）。
 *   - changed_by は t_dankalog.tancd → `legacy-tancd-${tancd}`。t_famlog は tancd 列が無く null。
 *
 * 冪等性: 各ログ行 PK（danka_log_cd / family_log_id）を
 *   History.legacy_log_cd + legacy_log_table の複合ユニークで一意化し、
 *   createMany({ skipDuplicates }) と既存キー事前ロードで再実行時の重複を防ぐ。
 *
 * 本番投入: `npm run migrate:legacy -- --only=history`（#163 のデプロイに同梱可）。
 */

type LogRow = RowDataPacket & Record<string, unknown>;

// スナップショット差分の対象外（ログ管理メタ列）
const DANKALOG_META = new Set([
  'danka_log_cd',
  'rireki_cd',
  'reg_date',
  'mod_date',
  'del_date',
  'del_flg',
  'tancd',
]);
const FAMLOG_META = new Set([
  'family_log_id',
  'rireki_cd',
  'reg_date',
  'mod_date',
  'del_date',
  'del_flg',
]);

/** メタ列を除いたエンティティ状態のスナップショットを作る。 */
function buildSnapshot(row: Record<string, unknown>, meta: Set<string>): Record<string, unknown> {
  const snap: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (!meta.has(k)) snap[k] = v ?? null;
  }
  return snap;
}

/** 値の等価判定（mysql の型ゆれを文字列で吸収）。 */
function normalize(v: unknown): string {
  return v == null ? '' : String(v);
}

/** before→after で変化したフィールド名の配列。 */
function diffFields(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  const changed: string[] = [];
  for (const k of Object.keys(after)) {
    if (normalize(before[k]) !== normalize(after[k])) changed.push(k);
  }
  return changed;
}

/** 指定キーだけ抜き出した部分レコード。 */
function pick(record: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) out[k] = record[k] ?? null;
  return out;
}

interface BuildEntriesParams {
  rows: LogRow[];
  groupKey: string; // 'danka_cd' | 'family_cd'
  meta: Set<string>;
  entityType: 'Customer' | 'FamilyContact';
  table: 't_dankalog' | 't_famlog';
  existingKeys: Set<string>;
  /** 1行から entity_id / contract_plot_id / physical_plot_id / changed_by を解決。null entityId なら group ごとスキップ。 */
  resolve: (row: LogRow) => {
    entityId: string | null;
    contractPlotId: string | null;
    physicalPlotId: string | null;
    changedBy: string | null;
  };
  counters: { skipNoEntity: number; skipExisting: number; skipNoChange: number };
}

function buildEntries(params: BuildEntriesParams): Prisma.HistoryCreateManyInput[] {
  const { rows, groupKey, meta, entityType, table, existingKeys, resolve, counters } = params;
  const entries: Prisma.HistoryCreateManyInput[] = [];

  let i = 0;
  while (i < rows.length) {
    const gid: unknown = rows[i][groupKey];
    // 同一エンティティの連続行を取り出す（rows は groupKey, rireki_cd でソート済み）
    const group: LogRow[] = [];
    while (i < rows.length && (rows[i][groupKey] as unknown) === gid) {
      group.push(rows[i]);
      i++;
    }

    const resolved = resolve(group[0]);
    if (!resolved.entityId) {
      counters.skipNoEntity += group.length;
      continue;
    }

    let prev: Record<string, unknown> | null = null;
    for (const row of group) {
      const pk = row[table === 't_dankalog' ? 'danka_log_cd' : 'family_log_id'] as number;
      const snapshot = buildSnapshot(row, meta);
      const key = `${table}:${pk}`;

      const isCreate = prev === null;
      const changed = isCreate ? [] : diffFields(prev as Record<string, unknown>, snapshot);

      // 変化なしの UPDATE 行はノイズなので記録しない（prev は更新する）
      if (!isCreate && changed.length === 0) {
        counters.skipNoChange++;
        prev = snapshot;
        continue;
      }
      if (existingKeys.has(key)) {
        counters.skipExisting++;
        prev = snapshot;
        continue;
      }

      const perRow = resolve(row);
      const createdAt = parseLegacyDate(row.reg_date) ?? parseLegacyDate(row.mod_date);

      entries.push({
        entity_type: entityType,
        entity_id: resolved.entityId,
        contract_plot_id: perRow.contractPlotId,
        physical_plot_id: perRow.physicalPlotId,
        action_type: isCreate ? 'CREATE' : 'UPDATE',
        before_record: isCreate ? undefined : (pick(prev!, changed) as Prisma.InputJsonValue),
        after_record: (isCreate ? snapshot : pick(snapshot, changed)) as Prisma.InputJsonValue,
        changed_fields: isCreate ? undefined : (changed as unknown as Prisma.InputJsonValue),
        changed_by: perRow.changedBy,
        ...(createdAt ? { created_at: createdAt } : {}),
        legacy_log_cd: pk,
        legacy_log_table: table,
      });
      prev = snapshot;
    }
  }

  return entries;
}

export const stepHistory: MigrationStep = {
  name: 'history',
  dependsOn: ['customer', 'contractPlot', 'familyContact'],
  async run({ prisma, logger, idMaps, dryRun }) {
    await rebuildIdMap(prisma, idMaps, 'customer', logger);
    await rebuildIdMap(prisma, idMaps, 'contractPlot', logger);
    await rebuildIdMap(prisma, idMaps, 'physicalPlot', logger);
    assertIdMapsReady('history', idMaps, ['customer', 'contractPlot', 'physicalPlot']);

    // famlog 用: family_cd → FamilyContact（entity_id + contract_plot_id）
    const familyContacts = await prisma.familyContact.findMany({
      where: { legacy_family_cd: { not: null } },
      select: { id: true, legacy_family_cd: true, contract_plot_id: true },
    });
    const familyByCd = new Map<number, { id: string; contractPlotId: string | null }>();
    for (const fc of familyContacts) {
      if (fc.legacy_family_cd != null) {
        familyByCd.set(fc.legacy_family_cd, { id: fc.id, contractPlotId: fc.contract_plot_id });
      }
    }

    // 既存の取込済みキー（再実行スキップの集計用。実INSERTは skipDuplicates でも防御）
    const existing = await prisma.history.findMany({
      where: { legacy_log_table: { not: null } },
      select: { legacy_log_table: true, legacy_log_cd: true },
    });
    const existingKeys = new Set(existing.map((e) => `${e.legacy_log_table}:${e.legacy_log_cd}`));

    const counters = { skipNoEntity: 0, skipExisting: 0, skipNoChange: 0 };

    // ---- t_dankalog → Customer ----
    const dankalog = await legacyQuery<LogRow>(
      `SELECT * FROM t_dankalog ORDER BY danka_cd, rireki_cd, danka_log_cd`
    );
    const dankaEntries = buildEntries({
      rows: dankalog,
      groupKey: 'danka_cd',
      meta: DANKALOG_META,
      entityType: 'Customer',
      table: 't_dankalog',
      existingKeys,
      resolve: (row) => {
        const dankaCd = row.danka_cd as number | null;
        const graveCd = row.grave_cd as number | null;
        return {
          entityId: dankaCd != null ? (idMaps.customer.get(dankaCd) ?? null) : null,
          contractPlotId: graveCd != null ? (idMaps.contractPlot.get(graveCd) ?? null) : null,
          physicalPlotId: graveCd != null ? (idMaps.physicalPlot.get(graveCd) ?? null) : null,
          changedBy: row.tancd != null ? `legacy-tancd-${row.tancd}` : null,
        };
      },
      counters,
    });

    // ---- t_famlog → FamilyContact ----
    const famlog = await legacyQuery<LogRow>(
      `SELECT * FROM t_famlog ORDER BY family_cd, rireki_cd, family_log_id`
    );
    const famEntries = buildEntries({
      rows: famlog,
      groupKey: 'family_cd',
      meta: FAMLOG_META,
      entityType: 'FamilyContact',
      table: 't_famlog',
      existingKeys,
      resolve: (row) => {
        const familyCd = row.family_cd as number | null;
        const fc = familyCd != null ? familyByCd.get(familyCd) : undefined;
        return {
          entityId: fc?.id ?? null,
          contractPlotId: fc?.contractPlotId ?? null,
          physicalPlotId: null,
          changedBy: null, // t_famlog に担当者列は無い
        };
      },
      counters,
    });

    const entries = [...dankaEntries, ...famEntries];

    let inserted = 0;
    if (!dryRun && entries.length > 0) {
      const CHUNK = 1000;
      for (let i = 0; i < entries.length; i += CHUNK) {
        const chunk = entries.slice(i, i + CHUNK);
        const r = await prisma.history.createMany({ data: chunk, skipDuplicates: true });
        inserted += r.count;
      }
    } else {
      inserted = entries.length;
    }

    logger.info(
      {
        dankalog_rows: dankalog.length,
        famlog_rows: famlog.length,
        danka_entries: dankaEntries.length,
        fam_entries: famEntries.length,
        ...counters,
      },
      'History migrated'
    );

    return {
      inserted,
      skipped: counters.skipNoEntity + counters.skipExisting + counters.skipNoChange,
      notes: {
        dankalog_rows: dankalog.length,
        famlog_rows: famlog.length,
        danka_entries: dankaEntries.length,
        fam_entries: famEntries.length,
        skip_no_entity: counters.skipNoEntity,
        skip_existing: counters.skipExisting,
        skip_no_change: counters.skipNoChange,
      },
    };
  },
};
