import { PaymentStatus } from '@prisma/client';

/**
 * ContractPlot.payment_status の派生ロジック（DB 非依存の純関数）。
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
 * ContractPlot の請求群から payment_status を導出する。
 *
 * 解約済み請求（terminated）は債務が消滅しているため集計から除外する。
 * これにより「解約前に全額入金 → 解約」の区画が誤って未入金扱いになるのを防ぐ。
 */
export const deriveContractPlotPaymentStatus = (
  billings: { amount: number; paid_amount: number; terminated: boolean }[],
  currentStatus?: PaymentStatus
): PaymentStatus => {
  const active = billings.filter((b) => !b.terminated);
  const totalAmount = active.reduce((sum, b) => sum + b.amount, 0);
  const totalPaid = active.reduce((sum, b) => sum + b.paid_amount, 0);
  return paymentStatusFromTotals(totalAmount, totalPaid, currentStatus);
};
