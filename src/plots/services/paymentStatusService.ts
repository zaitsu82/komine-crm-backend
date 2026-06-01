import { PaymentStatus, Prisma } from '@prisma/client';

import prisma from '../../db/prisma';

import { deriveContractPlotPaymentStatus } from './paymentStatusLogic';

export { deriveContractPlotPaymentStatus, paymentStatusFromTotals } from './paymentStatusLogic';

type PaymentStatusClient = Prisma.TransactionClient | typeof prisma;

/**
 * 指定 ContractPlot について、紐付く Billing 群（の入金集計 paid_amount）から
 * payment_status を再計算して更新する。
 *
 * Payment / Billing の作成・更新・削除時に呼ばれ、
 * ContractPlot.payment_status を「請求 vs 入金」の派生値として常に最新に保つ。
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

  const status = deriveContractPlotPaymentStatus(billings, contractPlot.payment_status);

  await client.contractPlot.update({
    where: { id: contractPlotId },
    data: { payment_status: status },
  });

  return status;
};
