import type { PaymentStatus } from '@prisma/client';

import { paymentStatusFromTotals } from '../../../src/plots/services/paymentStatusLogic';
import type { MigrationStep } from '../types';

/**
 * ContractPlot.payment_status backfill（#162）
 *
 * 移行（05-contract-plot）では payment_status を全件 'unpaid' 固定で投入している。
 * Billing / Payment 投入後に、契約区画ごとに「請求額 vs 入金額」を集計して
 * 'paid' / 'partial_paid' / 'unpaid' を再計算する。
 *
 * 判定ロジックはランタイム（src/plots/services/paymentStatusLogic）と共有している。
 *  - 解約済み請求（terminated）は債務消滅扱いで集計から除外
 *  - overdue（延滞）は期限超過の業務定義が未確定のため自動付与しない
 *
 * 冪等性:
 *   再計算結果（paid / partial_paid）に該当する区画のみ更新する。
 *   移行直後は全区画が 'unpaid' なので、未入金の区画は更新不要（no-op）。
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

    // 算出ステータスごとに区画 ID をバケツ分け
    const byStatus: Record<PaymentStatus, string[]> = {
      unpaid: [],
      partial_paid: [],
      paid: [],
      overdue: [],
      refunded: [],
    };

    for (const g of grouped) {
      const totalAmount = g._sum.amount ?? 0;
      const totalPaid = g._sum.paid_amount ?? 0;
      const status = paymentStatusFromTotals(totalAmount, totalPaid);
      byStatus[status].push(g.contract_plot_id);
    }

    // 'unpaid' は移行初期値と同じなので更新不要。paid / partial_paid のみ反映。
    const paidIds = byStatus.paid;
    const partialIds = byStatus.partial_paid;
    const updated = paidIds.length + partialIds.length;

    if (dryRun) {
      const notes: Record<string, number> = {
        contract_plots_with_billing: grouped.length,
        would_set_paid: paidIds.length,
        would_set_partial_paid: partialIds.length,
      };
      logger.info(notes, 'paymentStatus backfill (dry-run)');
      return { inserted: 0, skipped: grouped.length - updated, notes };
    }

    const targets: Array<{ status: PaymentStatus; ids: string[] }> = [
      { status: 'paid', ids: paidIds },
      { status: 'partial_paid', ids: partialIds },
    ];
    for (const { status, ids } of targets) {
      for (const idChunk of chunk(ids, 1000)) {
        await prisma.contractPlot.updateMany({
          where: { id: { in: idChunk }, deleted_at: null },
          data: { payment_status: status },
        });
      }
    }

    const notes: Record<string, number> = {
      contract_plots_with_billing: grouped.length,
      set_paid: paidIds.length,
      set_partial_paid: partialIds.length,
      left_unpaid: byStatus.unpaid.length,
    };
    return { inserted: updated, skipped: grouped.length - updated, notes };
  },
};
