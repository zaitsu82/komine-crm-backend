/// <reference types="node" />
/**
 * idMaps の self-sufficient ローダ。
 *
 * `--only=<step>` のように依存 step を飛ばして単発実行した場合でも、
 * 既に Postgres に投入済みのデータから idMap を再構築できるようにする。
 *
 * 詳細は query_result/RECOVERY_PHASE1_HARDENING.md Task 3 を参照。
 */

import type { PrismaClient } from '@prisma/client';
import type { Logger } from 'pino';

import type { IdMaps } from '../idMap';

const PHYSICAL_PLOT_PREFIX = 'legacy-';
const STAFF_SUPABASE_UID_PREFIX = 'legacy-tancd-';

/**
 * 直接 `legacy_*` カラムを持つモデル（Customer / ContractPlot / Billing）から
 * `legacyColumn (int) → id (uuid)` のマップを構築する。
 */
export async function loadIdMapFromDb(
  prisma: PrismaClient,
  modelName: 'customer' | 'contractPlot' | 'billing',
  legacyColumn: 'legacy_danka_cd' | 'legacy_grave_cd' | 'legacy_seikyu_cd',
  extraWhere?: Record<string, unknown>
): Promise<Map<number, string>> {
  // Prisma の型システム上、delegate は引数で動的に決まる。実行時に存在しないキーは
  // テストでも本番でも発生しないため、安全な dynamic dispatch とする。
  const delegate = (
    prisma as unknown as Record<
      string,
      {
        findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
      }
    >
  )[modelName];
  if (!delegate || typeof delegate.findMany !== 'function') {
    throw new Error(`Unknown Prisma model: ${modelName}`);
  }
  const rows = await delegate.findMany({
    where: { [legacyColumn]: { not: null }, deleted_at: null, ...(extraWhere ?? {}) },
    select: { id: true, [legacyColumn]: true },
  });

  const map = new Map<number, string>();
  for (const r of rows) {
    const legacy = r[legacyColumn];
    const id = r['id'];
    if (typeof legacy === 'number' && typeof id === 'string') {
      map.set(legacy, id);
    }
  }
  return map;
}

/**
 * 指定された idMap が空なら DB から再構築する。
 * 既に値が入っていれば no-op（idempotent）。
 *
 * 戻り値: 再構築後のサイズ（既に埋まっていた場合は元のサイズ）。
 */
export async function rebuildIdMap(
  prisma: PrismaClient,
  idMaps: IdMaps,
  key: keyof IdMaps,
  logger?: Pick<Logger, 'info'>
): Promise<number> {
  if (idMaps[key].size > 0) return idMaps[key].size;

  let loaded = 0;
  switch (key) {
    case 'customer': {
      // 終了顧客（is_terminated=true、レガシー del_flg=2 由来）は契約/請求/入金のリンク対象外
      // のため除外する（#129/Q19: 旧入金35件を取り込まない）
      const m = await loadIdMapFromDb(prisma, 'customer', 'legacy_danka_cd', {
        is_terminated: false,
      });
      for (const [k, v] of m) idMaps.customer.set(k, v);
      loaded = m.size;
      break;
    }
    case 'contractPlot': {
      const m = await loadIdMapFromDb(prisma, 'contractPlot', 'legacy_grave_cd');
      for (const [k, v] of m) idMaps.contractPlot.set(k, v);
      loaded = m.size;
      break;
    }
    case 'billing': {
      const m = await loadIdMapFromDb(prisma, 'billing', 'legacy_seikyu_cd');
      for (const [k, v] of m) idMaps.billing.set(k, v);
      loaded = m.size;
      break;
    }
    case 'physicalPlot': {
      const rows = await prisma.physicalPlot.findMany({
        where: { plot_number: { startsWith: PHYSICAL_PLOT_PREFIX }, deleted_at: null },
        select: { id: true, plot_number: true },
      });
      for (const r of rows) {
        const cd = Number(r.plot_number.slice(PHYSICAL_PLOT_PREFIX.length));
        if (Number.isInteger(cd) && cd > 0) idMaps.physicalPlot.set(cd, r.id);
      }
      loaded = idMaps.physicalPlot.size;
      break;
    }
    case 'staff': {
      const rows = await prisma.staff.findMany({
        where: { supabase_uid: { startsWith: STAFF_SUPABASE_UID_PREFIX } },
        select: { id: true, supabase_uid: true },
      });
      for (const r of rows) {
        const cd = Number(r.supabase_uid.slice(STAFF_SUPABASE_UID_PREFIX.length));
        if (Number.isInteger(cd) && cd > 0) idMaps.staff.set(cd, r.id);
      }
      loaded = idMaps.staff.size;
      break;
    }
    default: {
      // 網羅性チェック
      const _exhaustive: never = key;
      throw new Error(`Unknown idMap key: ${String(_exhaustive)}`);
    }
  }

  if (loaded > 0 && logger) {
    logger.info({ key, loaded }, `idMaps.${key} loaded ${loaded} from DB`);
  }
  return loaded;
}
