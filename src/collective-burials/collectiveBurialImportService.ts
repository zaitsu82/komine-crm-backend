/**
 * 合祀情報の一括投入サービス（#359）
 *
 * 共同区画（樹木葬/納骨堂/桜シェア葬/千年桜 等）の合祀は、レガシーから自動移行されない
 * （移行ステップに合祀が無くレガシーにも専用テーブルが無い）。事務所のエクセル（区画残数
 * /合祀台帳）由来の値を本番へ投入するための一括取込を提供する。
 *
 * 区画は区画番号（display_number 優先・無ければ plot_number）で解決し、その有効な契約区画に
 * CollectiveBurial を upsert する。冪等（再実行で既存はスキップ/更新）。
 * 値の意味は台帳UIの合祀トグル（createCollectiveBurial）と揃える。
 */
import { PrismaClient } from '@prisma/client';
import { resolveBillingScheduledDate, updateCollectiveBurialCount } from './utils';

export interface CollectiveBurialImportRow {
  /** 区画番号（display_number 優先・無ければ plot_number） */
  plotNumber: string;
  /** 埋葬上限人数（1以上） */
  burialCapacity: number;
  /** 合祀年数（有効期間・1以上） */
  validityPeriodYears: number;
  /** 現在埋葬数（任意・既定0） */
  currentBurialCount?: number;
  /** 請求金額（任意） */
  billingAmount?: number | null;
  /** 備考（任意） */
  notes?: string | null;
}

export type ImportRowOutcome =
  | 'created'
  | 'updated'
  | 'notFound'
  | 'ambiguous'
  | 'invalid'
  | 'skippedExisting';

export interface ImportRowResult {
  plotNumber: string;
  outcome: ImportRowOutcome;
  message?: string;
}

export interface ImportSummary {
  total: number;
  created: number;
  updated: number;
  skippedExisting: number;
  notFound: number;
  ambiguous: number;
  invalid: number;
  results: ImportRowResult[];
}

export interface ImportOptions {
  apply: boolean;
  /** 既存（生存）合祀があるとき上書き更新する（既定 false=スキップ） */
  overwrite?: boolean;
}

/** 区画番号(display_number 優先, fallback plot_number)から有効な契約区画を1件解決する。 */
async function resolveContractPlot(
  prisma: PrismaClient,
  plotNumber: string
): Promise<{ id: string; contract_date: Date | null } | { error: 'notFound' | 'ambiguous' }> {
  // 有効な契約区画（active）を物理区画の display_number / plot_number から引く
  const candidates = await prisma.contractPlot.findMany({
    where: {
      deleted_at: null,
      contract_status: 'active',
      physicalPlot: {
        is: {
          deleted_at: null,
          OR: [{ display_number: plotNumber }, { plot_number: plotNumber }],
        },
      },
    },
    select: { id: true, contract_date: true },
  });
  if (candidates.length === 0) return { error: 'notFound' };
  if (candidates.length > 1) return { error: 'ambiguous' };
  return candidates[0]!;
}

function validateRow(row: CollectiveBurialImportRow): string | null {
  if (!row.plotNumber) return '区画番号が空です';
  if (!Number.isInteger(row.burialCapacity) || row.burialCapacity < 1)
    return '埋葬上限数は1以上の整数で指定してください';
  if (!Number.isInteger(row.validityPeriodYears) || row.validityPeriodYears < 1)
    return '合祀年数は1以上の整数で指定してください';
  if (
    row.currentBurialCount !== undefined &&
    (!Number.isInteger(row.currentBurialCount) || row.currentBurialCount < 0)
  )
    return '現在埋葬数は0以上の整数で指定してください';
  // 現在埋葬数が上限を超える行は要確認リストへ回す（#396）。
  // 投入後に updateCollectiveBurialCount で実数へ再同期するが、入力時点の
  // 整合性チェックとして上限超過を検出しておく。
  if (row.currentBurialCount !== undefined && row.currentBurialCount > row.burialCapacity)
    return '現在埋葬数が埋葬上限数を超えています';
  return null;
}

export async function importCollectiveBurials(
  prisma: PrismaClient,
  rows: CollectiveBurialImportRow[],
  opts: ImportOptions
): Promise<ImportSummary> {
  const summary: ImportSummary = {
    total: rows.length,
    created: 0,
    updated: 0,
    skippedExisting: 0,
    notFound: 0,
    ambiguous: 0,
    invalid: 0,
    results: [],
  };

  for (const row of rows) {
    const invalidMsg = validateRow(row);
    if (invalidMsg) {
      summary.invalid++;
      summary.results.push({ plotNumber: row.plotNumber, outcome: 'invalid', message: invalidMsg });
      continue;
    }

    const resolved = await resolveContractPlot(prisma, row.plotNumber);
    if ('error' in resolved) {
      if (resolved.error === 'notFound') {
        summary.notFound++;
        summary.results.push({ plotNumber: row.plotNumber, outcome: 'notFound' });
      } else {
        summary.ambiguous++;
        summary.results.push({
          plotNumber: row.plotNumber,
          outcome: 'ambiguous',
          message: '有効な契約区画が複数該当（分割販売等）。手動で区画を特定して投入してください',
        });
      }
      continue;
    }

    const contractPlotId = resolved.id;
    // contract_plot_id は deleted_at を含まない単独 @unique。生存行は重複、ソフトデリート行は復活。
    const existing = await prisma.collectiveBurial.findUnique({
      where: { contract_plot_id: contractPlotId },
    });
    const isLiveExisting = existing != null && existing.deleted_at == null;

    if (isLiveExisting && !opts.overwrite) {
      summary.skippedExisting++;
      summary.results.push({
        plotNumber: row.plotNumber,
        outcome: 'skippedExisting',
        message: '既に合祀情報あり（--overwrite で更新）',
      });
      continue;
    }

    const billingScheduledDate = resolveBillingScheduledDate(
      resolved.contract_date,
      row.validityPeriodYears
    );
    // CSV の現在埋葬数は初期値として書くが、apply 時は直後の
    // updateCollectiveBurialCount で BuriedPerson 実数に再同期される（#396）。
    const currentBurialCount = row.currentBurialCount ?? 0;
    const data = {
      burial_capacity: row.burialCapacity,
      current_burial_count: currentBurialCount,
      validity_period_years: row.validityPeriodYears,
      billing_scheduled_date: billingScheduledDate,
      billing_status: 'pending' as const,
      billing_amount: row.billingAmount ?? null,
      notes: row.notes ?? null,
    };

    const willUpdate = existing != null; // 生存 or ソフトデリート行を更新/復活

    if (opts.apply) {
      if (existing) {
        await prisma.collectiveBurial.update({
          where: { id: existing.id },
          data: { ...data, capacity_reached_date: null, deleted_at: null },
        });
      } else {
        await prisma.collectiveBurial.create({
          data: { contract_plot_id: contractPlotId, ...data },
        });
      }
      // 実埋葬者（BuriedPerson）の実数から current_burial_count と capacity_reached_date を
      // 再同期する（#281 と同じ整合ルール・#396）。本番には移行済み埋葬者を持つ有効区画が
      // 多数あり、CSV の現在埋葬数（省略時0）をそのまま残すと「count=0 なのに埋葬者一覧に
      // 実データが並ぶ」「count>=capacity でも上限到達日 null で一覧に出ない」矛盾が生じ、
      // 次に UI で埋葬者編集した時点で CSV 値が黙って実数に上書きされる。
      await updateCollectiveBurialCount(prisma, contractPlotId);
    }

    if (willUpdate) {
      summary.updated++;
      summary.results.push({ plotNumber: row.plotNumber, outcome: 'updated' });
    } else {
      summary.created++;
      summary.results.push({ plotNumber: row.plotNumber, outcome: 'created' });
    }
  }

  return summary;
}
