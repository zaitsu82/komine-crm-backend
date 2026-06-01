import { PaymentStatus, Prisma } from '@prisma/client';

import prisma from '../../db/prisma';

import { deriveContractPlotPayment } from './paymentStatusLogic';

export {
  deriveContractPlotPayment,
  deriveContractPlotPaymentStatus,
  paymentStatusFromTotals,
  uncollectedFromTotals,
} from './paymentStatusLogic';

type PaymentStatusClient = Prisma.TransactionClient | typeof prisma;

/**
 * 指定 ContractPlot について、紐付く Billing 群（請求額 amount と入金集計 paid_amount）から
 * payment_status と uncollected_amount を再計算して更新する。
 *
 * Payment / Billing の作成・更新・削除時に呼ばれ、
 * ContractPlot.payment_status と未収金額を「請求 vs 入金」の派生値として常に最新に保つ（#170）。
 *
 * @returns 更新後のステータス。区画が見つからなければ null。
 */
export const recalculateContractPlotPaymentStatus = async (
  client: PaymentStatusClient,
  contractPlotId: string
): Promise<PaymentStatus | null> => {
  const contractPlot = await client.contractPlot.findFirst({
    where: { id: contractPlotId, deleted_at: null },
    select: { payment_status: true },
  });
  if (!contractPlot) return null;

  const billings = await client.billing.findMany({
    where: { contract_plot_id: contractPlotId, deleted_at: null },
    select: { amount: true, paid_amount: true, terminated: true },
  });

  const { status, uncollectedAmount } = deriveContractPlotPayment(
    billings,
    contractPlot.payment_status
  );

  await client.contractPlot.update({
    where: { id: contractPlotId },
    data: { payment_status: status, uncollected_amount: uncollectedAmount },
  });

  return status;
};
