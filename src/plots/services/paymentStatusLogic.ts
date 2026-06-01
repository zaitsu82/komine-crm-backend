import { PaymentStatus } from '@prisma/client';

/**
 * ContractPlot.payment_status / uncollected_amount の派生ロジック（DB 非依存の純関数）。
 *
 * ランタイム（paymentStatusService）と移行 backfill（scripts/legacy-migration）の
 * 双方から参照され、判定ロジックの単一ソースになる。
 */

/**
 * 入金合計と請求合計から ContractPlot.payment_status を導出する。
 *
 * 遷移ロジック（billingService.computeBillingStatus と整合）:
 *  - refunded（返金済み）: 自動算出ソースが無いため手動設定を尊重して維持する
 *  - 入金合計 >= 請求額（請求額 > 0）: 'paid'
 *  - 入金合計 > 0: 'partial_paid'
 *  - overdue（延滞）: 期限超過の業務定義が未確定のため自動判定しない（#162）。
 *    既に overdue が設定済みで入金が無い場合のみ 'overdue' を維持する
 *  - それ以外: 'unpaid'
 */
export const paymentStatusFromTotals = (
  totalAmount: number,
  totalPaid: number,
  currentStatus?: PaymentStatus
): PaymentStatus => {
  if (currentStatus === PaymentStatus.refunded) return PaymentStatus.refunded;
  if (totalAmount > 0 && totalPaid >= totalAmount) return PaymentStatus.paid;
  if (totalPaid > 0) return PaymentStatus.partial_paid;
  if (currentStatus === PaymentStatus.overdue) return PaymentStatus.overdue;
  return PaymentStatus.unpaid;
};

/**
 * 請求合計と入金合計から未収金額を導出する。
 *
 * 未収金額 = active 請求の (請求額 − 入金額)。
 *  - refunded（返金済み）: 債権が消滅しているため未収 0（#170）
 *  - それ以外: max(0, totalAmount − totalPaid)（過入金でも負にしない）
 */
export const uncollectedFromTotals = (
  totalAmount: number,
  totalPaid: number,
  status: PaymentStatus
): number => {
  if (status === PaymentStatus.refunded) return 0;
  return Math.max(0, totalAmount - totalPaid);
};

/**
 * ContractPlot の請求群から payment_status と uncollected_amount を同時に導出する。
 *
 * 解約済み請求（terminated）は債務が消滅しているため集計から除外する。
 * これにより「解約前に全額入金 → 解約」の区画が誤って未入金扱いになるのを防ぐ。
 * payment_status と未収金額を同一の集計から導出することで、両者が論理的に矛盾しないことを保証する（#170）。
 */
export const deriveContractPlotPayment = (
  billings: { amount: number; paid_amount: number; terminated: boolean }[],
  currentStatus?: PaymentStatus
): { status: PaymentStatus; uncollectedAmount: number } => {
  const active = billings.filter((b) => !b.terminated);
  const totalAmount = active.reduce((sum, b) => sum + b.amount, 0);
  const totalPaid = active.reduce((sum, b) => sum + b.paid_amount, 0);
  const status = paymentStatusFromTotals(totalAmount, totalPaid, currentStatus);
  return { status, uncollectedAmount: uncollectedFromTotals(totalAmount, totalPaid, status) };
};

/**
 * ContractPlot の請求群から payment_status を導出する。
 * @deprecated 集計を二重化しないため {@link deriveContractPlotPayment} を使うこと。後方互換で残置。
 */
export const deriveContractPlotPaymentStatus = (
  billings: { amount: number; paid_amount: number; terminated: boolean }[],
  currentStatus?: PaymentStatus
): PaymentStatus => deriveContractPlotPayment(billings, currentStatus).status;
