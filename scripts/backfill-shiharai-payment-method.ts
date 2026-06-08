/// <reference types="node" />
/**
 * 使用料・管理料の支払方法(shiharai)レガシー値を正コードへ remap する backfill（#108）
 *
 * 移行済みデータに残る生レガシー値を payment_method_master の code に揃える:
 *   '0' / 'legacy-shiharai-0' → 'BANK_TRANSFER'   （銀行振込）
 *   '1' / 'legacy-shiharai-1' → 'ACCOUNT_TRANSFER' （口座振替）
 *   '2' / 'legacy-shiharai-2' → null               （永代＝定期支払なし。管理料のみ出現）
 *   '口座振替'（新システム手入力の表記揺れ）        → 'ACCOUNT_TRANSFER'
 *
 * 旧int値の意味は issue #108 の業務確認（2026-06-08）で確定。
 * null（未登録）と、既に正コード（CASH/BANK_TRANSFER/ACCOUNT_TRANSFER）のものは対象外。
 *
 * 使い方:
 *   npx ts-node --transpile-only scripts/backfill-shiharai-payment-method.ts          # dry-run（変更計画のみ）
 *   npx ts-node --transpile-only scripts/backfill-shiharai-payment-method.ts --apply  # 実際に更新
 *   npm run backfill:shiharai-payment-method            # dry-run
 *   npm run backfill:shiharai-payment-method -- --apply # 実際に更新
 *
 * 冪等: 実行後はレガシー値が消えるため再実行で 0 件。
 */
import 'dotenv/config';

import { prisma } from '../src/db/prisma';

const APPLY = process.argv.includes('--apply');

/**
 * 現在の payment_method 文字列を新コードへ写像する。
 * - 生int / legacy-shiharai-N / 表記揺れ「口座振替」を対象にする。
 * - 写像対象外（null・既存の正コード・想定外値）は undefined を返し、触らない。
 */
function mapLegacyShiharai(value: string): string | null | undefined {
  if (value === '口座振替') return 'ACCOUNT_TRANSFER';
  const m = /^(?:legacy-shiharai-)?(\d+)$/.exec(value);
  if (!m) return undefined;
  switch (m[1]) {
    case '0':
      return 'BANK_TRANSFER';
    case '1':
      return 'ACCOUNT_TRANSFER';
    case '2':
      return null; // 永代＝支払なし
    default:
      return undefined; // 想定外の int は温存
  }
}

type FeeModel = 'usageFee' | 'managementFee';

interface PlanRow {
  from: string;
  to: string | null;
  count: number;
}

async function backfillFee(model: FeeModel): Promise<{ plan: PlanRow[]; updated: number }> {
  const delegate = prisma[model] as {
    groupBy: (args: {
      by: ['payment_method'];
      _count: { _all: true };
    }) => Promise<Array<{ payment_method: string | null; _count: { _all: number } }>>;
    updateMany: (args: {
      where: { payment_method: string };
      data: { payment_method: string | null };
    }) => Promise<{ count: number }>;
  };

  const groups = await delegate.groupBy({ by: ['payment_method'], _count: { _all: true } });

  const plan: PlanRow[] = [];
  for (const g of groups) {
    if (g.payment_method == null) continue;
    const to = mapLegacyShiharai(g.payment_method);
    if (to === undefined) continue; // 触らない
    plan.push({ from: g.payment_method, to, count: g._count._all });
  }

  if (!APPLY) return { plan, updated: 0 };

  let updated = 0;
  for (const p of plan) {
    const r = await delegate.updateMany({
      where: { payment_method: p.from },
      data: { payment_method: p.to },
    });
    updated += r.count;
  }
  return { plan, updated };
}

async function main(): Promise<void> {
  console.log(`[backfill shiharai-payment-method] start (apply=${APPLY})`);

  const usageFee = await backfillFee('usageFee');
  const managementFee = await backfillFee('managementFee');

  console.log(JSON.stringify({ apply: APPLY, usageFee, managementFee }, null, 2));

  if (!APPLY) {
    console.log('\n（dry-run。--apply で実際に更新します）');
  }
}

main()
  .catch((e) => {
    console.error('ERROR', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
