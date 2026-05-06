import { BillingRecordStatus, Prisma } from '@prisma/client';
import prisma from '../db/prisma';

/**
 * 請求 (Billing) のステータスを入金合計から自動計算する。
 *
 * 遷移ロジック:
 *  - written_off (貸倒処理): 自動遷移しない（手動設定を尊重）
 *  - terminated=true: 'terminated'
 *  - 入金合計 >= 請求額 (請求額 > 0): 'paid'
 *  - 入金合計 > 0: 'partial_paid'
 *  - 現状 overdue: 'overdue' を維持（手動で設定された延滞ステータスを尊重）
 *  - billing_date 設定済: 'billed'
 *  - それ以外: 'pending'
 */
export const computeBillingStatus = (
  billing: {
    amount: number;
    billing_date: Date | null;
    terminated: boolean;
    status: BillingRecordStatus;
  },
  paidAmount: number
): BillingRecordStatus => {
  if (billing.status === 'written_off') return 'written_off';
  if (billing.terminated) return 'terminated';
  if (billing.amount > 0 && paidAmount >= billing.amount) return 'paid';
  if (paidAmount > 0) return 'partial_paid';
  if (billing.status === 'overdue') return 'overdue';
  if (billing.billing_date) return 'billed';
  return 'pending';
};

type BillingClient = Prisma.TransactionClient | typeof prisma;

/**
 * 指定の Billing について、紐付く Payment 群から
 *  - paid_amount（入金合計）
 *  - last_payment_date（最終入金日）
 *  - status（自動算出）
 * を再集計して更新する。
 *
 * Payment の作成・更新・削除時に呼ばれる。
 */
export const recalculateBillingPayments = async (
  client: BillingClient,
  billingId: string
): Promise<void> => {
  const billing = await client.billing.findFirst({
    where: { id: billingId, deleted_at: null },
  });
  if (!billing) return;

  const payments = await client.payment.findMany({
    where: { billing_id: billingId, deleted_at: null },
    select: { payment_amount: true, payment_date: true },
  });

  const paidAmount = payments.reduce((sum, p) => sum + p.payment_amount, 0);
  const lastPaymentDate = payments.reduce<Date | null>((latest, p) => {
    if (!p.payment_date) return latest;
    if (!latest) return p.payment_date;
    return p.payment_date > latest ? p.payment_date : latest;
  }, null);

  const status = computeBillingStatus(billing, paidAmount);

  await client.billing.update({
    where: { id: billingId },
    data: {
      paid_amount: paidAmount,
      last_payment_date: lastPaymentDate,
      status,
    },
  });
};
