import type { PaymentStatus } from '@prisma/client';

import {
  paymentStatusFromTotals,
  uncollectedFromTotals,
} from '../../../src/plots/services/paymentStatusLogic';
import type { MigrationStep } from '../types';

/**
 * ContractPlot.payment_status / uncollected_amount backfill（#162 / #170）
 *
 * 移行（05-contract-plot）では payment_status='unpaid' / uncollected_amount=0 固定で投入している。
 * Billing / Payment 投入後に、契約区画ごとに「請求額 vs 入金額」を集計して
 * payment_status（paid / partial_paid / unpaid）と未収金額（請求額 − 入金額）を再計算する。
 *
 * 判定ロジックはランタイム（src/plots/services/paymentStatusLogic）と共有している。
 *  - 解約済み請求（terminated）は債務消滅扱いで集計から除外
 *  - overdue（延滞）は期限超過の業務定義が未確定のため自動付与しない
 *  - 未収金額 = max(0, 請求額 − 入金額)（#170）
 *
 * 冪等性:
 *   payment_status='unpaid' かつ uncollected=0（＝移行初期値）に収束する区画は更新不要（no-op）。
 *   「請求あり・入金0」の区画は status=unpaid のままだが未収>0 になるため更新対象（#170 の主因）。
 *   何度実行しても同じ結果に収束する。
 */

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export const stepPaymentStatus: MigrationStep = {
  name: 'paymentStatus',
  dependsOn: ['billing', 'payment'],
  async run({ prisma, logger, dryRun }) {
    // 解約済みを除いた請求を契約区画単位で集計（請求額 / 入金額）
    const grouped = await prisma.billing.groupBy({
      by: ['contract_plot_id'],
      where: { deleted_at: null, terminated: false },
      _sum: { amount: true, paid_amount: true },
    });

    // (payment_status, uncollected) の組ごとに区画 ID をまとめて updateMany を最小化する。
    // 移行初期値（unpaid / 0）に一致する区画は更新不要（no-op）なので除外する。
    const buckets = new Map<
      string,
      { status: PaymentStatus; uncollected: number; ids: string[] }
    >();
    let setPaid = 0;
    let setPartial = 0;
    let setUncollected = 0;
    let leftAtInitial = 0;

    for (const g of grouped) {
      const totalAmount = g._sum.amount ?? 0;
      const totalPaid = g._sum.paid_amount ?? 0;
      const status = paymentStatusFromTotals(totalAmount, totalPaid);
      const uncollected = uncollectedFromTotals(totalAmount, totalPaid, status);

      if (status === 'unpaid' && uncollected === 0) {
        leftAtInitial += 1;
        continue; // 移行初期値と同じ（no-op）
      }
      if (status === 'paid') setPaid += 1;
      if (status === 'partial_paid') setPartial += 1;
      if (uncollected > 0) setUncollected += 1;

      const key = `${status}|${uncollected}`;
      const bucket = buckets.get(key);
      if (bucket) bucket.ids.push(g.contract_plot_id);
      else buckets.set(key, { status, uncollected, ids: [g.contract_plot_id] });
    }

    const updated = grouped.length - leftAtInitial;

    if (dryRun) {
      const notes: Record<string, number> = {
        contract_plots_with_billing: grouped.length,
        would_set_paid: setPaid,
        would_set_partial_paid: setPartial,
        would_set_uncollected: setUncollected,
      };
      logger.info(notes, 'paymentStatus/uncollected backfill (dry-run)');
      return { inserted: 0, skipped: leftAtInitial, notes };
    }

    for (const { status, uncollected, ids } of buckets.values()) {
      for (const idChunk of chunk(ids, 1000)) {
        await prisma.contractPlot.updateMany({
          where: { id: { in: idChunk }, deleted_at: null },
          data: { payment_status: status, uncollected_amount: uncollected },
        });
      }
    }

    const notes: Record<string, number> = {
      contract_plots_with_billing: grouped.length,
      set_paid: setPaid,
      set_partial_paid: setPartial,
      set_uncollected: setUncollected,
      left_at_initial: leftAtInitial,
    };
    return { inserted: updated, skipped: leftAtInitial, notes };
  },
};
