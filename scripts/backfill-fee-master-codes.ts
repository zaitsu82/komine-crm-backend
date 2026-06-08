/// <reference types="node" />
/**
 * 使用料・管理料の計算/税/請求区分のレガシー値を正コードへ remap する backfill（#331）
 *
 * 本番の usage_fees / management_fees には step05 の remap 適用前に移行された生レガシーint
 * （"0"/"1"/"2"）が残り、フロントの resolveMasterName が「旧コード: X」表示になっていた。
 * 業務確認（#331, 2026-06-09）で「マスタをレガシー意味に合わせる」方針が確定したため、
 * seedMasters の正コード（旧 sykbnn の意味）へ揃える:
 *
 *   calculation_type: '0'/'legacy-keisan-0'/'01'/'面積単価' → 'AREA'  （面積×単価）
 *                     '1'/'legacy-keisan-1'                 → 'FIXED' （任意設定）
 *   tax_type:         '0'/'legacy-zei-0'    → 'INCLUSIVE'   （内税）
 *                     '1'/'legacy-zei-1'    → 'EXCLUSIVE'   （外税）
 *   billing_type:     '0'/'legacy-seikyu-0' → 'NONE'        （なし）
 *                     '1'/'legacy-seikyu-1' → 'PRESENT'     （あり）
 *                     '2'/'legacy-seikyu-2' → 'PERPETUAL'   （永代）
 *
 * 支払方法(payment_method)は別 backfill（#108 / backfill-shiharai-payment-method）で対応済みのため対象外。
 * 新システムの別語彙で手入力された少数の混入値（'02'/'消費税10%'/'一括請求'/'onetime' 等、
 * レガシーの内税外税・なし/あり/永代に機械対応しないもの）は誤変換を避けて温存する。
 * null・既存の正コードは対象外。
 *
 * 前提: seedMasters の正コード（AREA/FIXED/INCLUSIVE/EXCLUSIVE/NONE/PRESENT/PERPETUAL）が
 *       本番マスタに投入済みであること（`npm run seed:masters` は冪等）。投入後にこの backfill を実行する。
 *
 * 使い方:
 *   npm run backfill:fee-master-codes            # dry-run（変更計画のみ）
 *   npm run backfill:fee-master-codes -- --apply # 実際に更新
 *
 * 冪等: 実行後はレガシー値が消えるため再実行で 0 件。
 */
import 'dotenv/config';

import { prisma } from '../src/db/prisma';

const APPLY = process.argv.includes('--apply');

export type FeeCodeField = 'calculation_type' | 'tax_type' | 'billing_type';

export interface FeeFieldSpec {
  field: FeeCodeField;
  /** legacy-{prefix}-N 形式の prefix（migration step05 の mapFeeCode と一致） */
  prefix: string;
  /** 生int（または legacy-{prefix}-N の int 部）→ 正コード */
  intMap: Record<string, string>;
  /** 表記揺れ・別スキーム混入値の明示マップ（レガシー意味に一致するもののみ） */
  literalMap?: Record<string, string>;
}

export const FEE_FIELD_SPECS: FeeFieldSpec[] = [
  {
    field: 'calculation_type',
    prefix: 'keisan',
    intMap: { '0': 'AREA', '1': 'FIXED' },
    // 旧マスタ 01=面積単価 / 表記揺れ「面積単価」はレガシー 0（面積×単価）と同義
    literalMap: { '01': 'AREA', 面積単価: 'AREA' },
  },
  {
    field: 'tax_type',
    prefix: 'zei',
    intMap: { '0': 'INCLUSIVE', '1': 'EXCLUSIVE' },
  },
  {
    field: 'billing_type',
    prefix: 'seikyu',
    intMap: { '0': 'NONE', '1': 'PRESENT', '2': 'PERPETUAL' },
  },
];

/**
 * 現在の値を正コードへ写像する。
 * - 生int / legacy-{prefix}-N / literalMap の表記揺れを対象にする。
 * - 写像対象外（null・既存の正コード・機械対応しない混入値）は undefined を返し、触らない。
 */
export function mapFeeFieldValue(spec: FeeFieldSpec, value: string): string | undefined {
  if (spec.literalMap && Object.prototype.hasOwnProperty.call(spec.literalMap, value)) {
    return spec.literalMap[value];
  }
  const m = new RegExp(`^(?:legacy-${spec.prefix}-)?(\\d+)$`).exec(value);
  if (!m) return undefined;
  const intKey = m[1] as string;
  return Object.prototype.hasOwnProperty.call(spec.intMap, intKey)
    ? spec.intMap[intKey]
    : undefined;
}

type FeeModel = 'usageFee' | 'managementFee';

interface PlanRow {
  field: FeeCodeField;
  from: string;
  to: string;
  count: number;
}

async function backfillFee(model: FeeModel): Promise<{ plan: PlanRow[]; updated: number }> {
  // usageFee/managementFee は同形だが Prisma の delegate union は構造比較が通らないため
  // unknown 経由で必要な2メソッドのみに絞った型へ写す（shiharai backfill と同方針）。
  const delegate = prisma[model] as unknown as {
    groupBy: (args: {
      by: [FeeCodeField];
      _count: { _all: true };
    }) => Promise<Array<Record<FeeCodeField, string | null> & { _count: { _all: number } }>>;
    updateMany: (args: {
      where: Record<string, string>;
      data: Record<string, string>;
    }) => Promise<{ count: number }>;
  };

  const plan: PlanRow[] = [];
  for (const spec of FEE_FIELD_SPECS) {
    const groups = await delegate.groupBy({ by: [spec.field], _count: { _all: true } });
    for (const g of groups) {
      const current = g[spec.field];
      if (current == null) continue;
      const to = mapFeeFieldValue(spec, current);
      if (to === undefined) continue; // 触らない
      plan.push({ field: spec.field, from: current, to, count: g._count._all });
    }
  }

  if (!APPLY) return { plan, updated: 0 };

  let updated = 0;
  for (const p of plan) {
    const r = await delegate.updateMany({
      where: { [p.field]: p.from },
      data: { [p.field]: p.to },
    });
    updated += r.count;
  }
  return { plan, updated };
}

async function main(): Promise<void> {
  console.log(`[backfill fee-master-codes] start (apply=${APPLY})`);

  const usageFee = await backfillFee('usageFee');
  const managementFee = await backfillFee('managementFee');

  console.log(JSON.stringify({ apply: APPLY, usageFee, managementFee }, null, 2));

  if (!APPLY) {
    console.log(
      '\n（dry-run。--apply で実際に更新します。事前に npm run seed:masters を実行のこと）'
    );
  }
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error('ERROR', e);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
