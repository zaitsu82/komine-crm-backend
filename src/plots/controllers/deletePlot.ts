/**
 * 契約区画削除エンドポイント
 * DELETE /api/v1/plots/:id
 *
 * ContractPlot と関連データを論理削除します。
 * 契約キャンセル時に使用します。
 */

import { Request, Response, NextFunction } from 'express';
import { updatePhysicalPlotStatus } from '../../utils/inventoryUtils';
import prisma from '../../db/prisma';
import { NotFoundError } from '../../middleware/errorHandler';

/**
 * ContractPlot削除（論理削除）
 * 契約をキャンセルし、関連データも論理削除します。
 */
export const deletePlot = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    // ContractPlotの存在確認
    const contractPlot = await prisma.contractPlot.findUnique({
      where: { id, deleted_at: null },
      include: {
        physicalPlot: true,
        saleContractRoles: {
          where: { deleted_at: null },
          include: {
            customer: {
              include: {
                workInfo: true,
                billingInfo: true,
              },
            },
          },
        },
        usageFee: true,
        managementFee: true,
      },
    });

    if (!contractPlot) {
      throw new NotFoundError('指定された契約区画が見つかりません');
    }

    const now = new Date();
    const physicalPlotId = contractPlot.physical_plot_id;

    // トランザクション内で論理削除
    await prisma.$transaction(async (tx) => {
      // 1. ContractPlotを論理削除
      await tx.contractPlot.update({
        where: { id },
        data: { deleted_at: now },
      });

      // 2. UsageFeeを論理削除
      if (contractPlot.usageFee) {
        await tx.usageFee.update({
          where: { id: contractPlot.usageFee.id },
          data: { deleted_at: now },
        });
      }

      // 3. ManagementFeeを論理削除
      if (contractPlot.managementFee) {
        await tx.managementFee.update({
          where: { id: contractPlot.managementFee.id },
          data: { deleted_at: now },
        });
      }

      // 4-6. 各顧客のWorkInfo、BillingInfo、Customerを論理削除
      // 注: saleContractRolesを通じて顧客にアクセス
      if (contractPlot.saleContractRoles) {
        for (const role of contractPlot.saleContractRoles) {
          const customer = role.customer;

          // WorkInfoを論理削除（存在する場合）
          if (customer.workInfo) {
            await tx.workInfo.update({
              where: { id: customer.workInfo.id },
              data: { deleted_at: now },
            });
          }

          // BillingInfoを論理削除（存在する場合）
          if (customer.billingInfo) {
            await tx.billingInfo.update({
              where: { id: customer.billingInfo.id },
              data: { deleted_at: now },
            });
          }

          // この顧客を参照している他の契約を検索
          const otherRoles = await tx.saleContractRole.findMany({
            where: {
              customer_id: customer.id,
              contract_plot_id: { not: id },
              deleted_at: null,
            },
          });

          // 他の契約がない場合のみCustomerを論理削除
          if (otherRoles.length === 0) {
            await tx.customer.update({
              where: { id: customer.id },
              data: { deleted_at: now },
            });
          }
        }
      }

      // 7. PhysicalPlotのステータスを更新
      await updatePhysicalPlotStatus(tx as any, physicalPlotId);
    });

    res.status(200).json({
      success: true,
      data: {
        message: '契約区画を削除しました',
        id,
      },
    });
  } catch (error) {
    next(error);
  }
};
