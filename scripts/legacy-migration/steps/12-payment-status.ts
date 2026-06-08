import type { BillingCategory, PaymentStatus } from '@prisma/client';

import { deriveContractPlotPayment } from '../../../src/plots/services/paymentStatusLogic';
import type { MigrationStep } from '../types';

/**
 * ContractPlot.payment_status / uncollected_amount backfill（#162 / #170）
 *
 * 移行（05-contract-plot）では payment_status='unpaid' / uncollected_amount=0 固定で投入している。
 * Billing / Payment 投入後に、契約区画ごとに「請求額 vs 入金額」を集計して
 * payment_status（paid / partial_paid / unpaid）と未収金額（請求額 − 入金額）を再計算する。
 *
 * 判定ロジックはランタイム（src/plots/services/paymentStatusLogic の deriveContractPlotPayment）と
 * 共有している。区画×category で集計し、同関数へ渡すことで単一ソースを保つ。
 *  - 解約済み請求（terminated）は債務消滅扱いで集計から除外
 *  - overdue（延滞）は期限超過の業務定義が未確定のため自動付与しない
 *  - payment_status は全料金区分で判定
 *  - 未収金額は護持費（管理料 = management_fee）の未集金額に限定（komine-docs#10 項目2 / 業務確定）
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
    // 解約済みを除いた請求を「契約区画 × 料金区分」で集計（請求額 / 入金額）。
    // payment_status は全区分・未収金額は管理料限定で出すため category 別の内訳が必要。
    const grouped = await prisma.billing.groupBy({
      by: ['contract_plot_id', 'category'],
      where: { deleted_at: null, terminated: false },
      _sum: { amount: true, paid_amount: true },
    });

    // 区画ごとに category 別の集計を束ね、deriveContractPlotPayment（ランタイムと共有の単一ソース）へ渡す。
    const byPlot = new Map<
      string,
      { amount: number; paid_amount: number; terminated: boolean; category: BillingCategory }[]
    >();
    for (const g of grouped) {
      const list = byPlot.get(g.contract_plot_id) ?? [];
      list.push({
        amount: g._sum.amount ?? 0,
        paid_amount: g._sum.paid_amount ?? 0,
        terminated: false, // where で terminated:false 済み
        category: g.category,
      });
      byPlot.set(g.contract_plot_id, list);
    }

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

    for (const [contractPlotId, billings] of byPlot) {
      const { status, uncollectedAmount: uncollected } = deriveContractPlotPayment(billings);

      if (status === 'unpaid' && uncollected === 0) {
        leftAtInitial += 1;
        continue; // 移行初期値と同じ（no-op）
      }
      if (status === 'paid') setPaid += 1;
      if (status === 'partial_paid') setPartial += 1;
      if (uncollected > 0) setUncollected += 1;

      const key = `${status}|${uncollected}`;
      const bucket = buckets.get(key);
      if (bucket) bucket.ids.push(contractPlotId);
      else buckets.set(key, { status, uncollected, ids: [contractPlotId] });
    }

    const updated = byPlot.size - leftAtInitial;

    if (dryRun) {
      const notes: Record<string, number> = {
        contract_plots_with_billing: byPlot.size,
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
      contract_plots_with_billing: byPlot.size,
      set_paid: setPaid,
      set_partial_paid: setPartial,
      set_uncollected: setUncollected,
      left_at_initial: leftAtInitial,
    };
    return { inserted: updated, skipped: leftAtInitial, notes };
  },
};
