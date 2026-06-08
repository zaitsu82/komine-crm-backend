/**
 * 契約区画削除エンドポイント
 * DELETE /api/v1/plots/:id
 *
 * ContractPlot と関連データを論理削除します。
 * 誤登録レコードの整理用です。契約の解約には POST /:id/terminate を
 * 使用してください（#236）。論理削除すると履歴・詳細・一覧から参照
 * 不能になり、restoreContract でも復活できません。
 */

import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { updatePhysicalPlotStatus } from '../utils';
import prisma from '../../db/prisma';
import { NotFoundError } from '../../middleware/errorHandler';
import { recordEntityDeleted, HistoryEntityType } from '../services/historyService';

/**
 * ContractPlot削除（論理削除）
 * 誤登録レコードの整理用。解約は terminateContract を使用すること。
 */
export const deletePlot = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = (req.params as Record<string, string>)['id'] as string;

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
    await prisma.$transaction(
      async (tx) => {
        // 1. ContractPlotを論理削除
        await tx.contractPlot.update({
          where: { id },
          data: { deleted_at: now },
        });
        await recordEntityDeleted(tx, {
          entityType: 'ContractPlot',
          entityId: id,
          physicalPlotId,
          contractPlotId: id,
          beforeRecord: {
            id: contractPlot.id,
            contract_area_sqm: contractPlot.contract_area_sqm.toString(),
            contract_date: contractPlot.contract_date?.toISOString(),
            price: contractPlot.price,
            payment_status: contractPlot.payment_status,
          },
          req,
        });

        // 2. UsageFeeを論理削除
        if (contractPlot.usageFee) {
          await tx.usageFee.update({
            where: { id: contractPlot.usageFee.id },
            data: { deleted_at: now },
          });
          await recordEntityDeleted(tx, {
            entityType: 'UsageFee',
            entityId: contractPlot.usageFee.id,
            physicalPlotId,
            contractPlotId: id,
            beforeRecord: {
              id: contractPlot.usageFee.id,
              usage_fee: contractPlot.usageFee.usage_fee,
            },
            req,
          });
        }

        // 3. ManagementFeeを論理削除
        if (contractPlot.managementFee) {
          await tx.managementFee.update({
            where: { id: contractPlot.managementFee.id },
            data: { deleted_at: now },
          });
          await recordEntityDeleted(tx, {
            entityType: 'ManagementFee',
            entityId: contractPlot.managementFee.id,
            physicalPlotId,
            contractPlotId: id,
            beforeRecord: {
              id: contractPlot.managementFee.id,
              management_fee: contractPlot.managementFee.management_fee,
            },
            req,
          });
        }

        // 4-6. 各顧客のWorkInfo、Customerを論理削除
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
              await recordEntityDeleted(tx, {
                entityType: 'WorkInfo',
                entityId: customer.workInfo.id,
                physicalPlotId,
                contractPlotId: id,
                beforeRecord: {
                  id: customer.workInfo.id,
                  company_name: customer.workInfo.company_name,
                },
                req,
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
              await recordEntityDeleted(tx, {
                entityType: 'Customer',
                entityId: customer.id,
                physicalPlotId,
                contractPlotId: id,
                beforeRecord: {
                  id: customer.id,
                  name: customer.name,
                },
                req,
              });
            }
          }
        }

        // 7. ContractPlot 配下の子レコードを論理削除（#358）
        // いずれも contract_plot_id で直接紐づくため、分割販売（同一物理区画に
        // 別の有効契約）でも他契約のデータには影響しない。
        // これらを消し残すと、親契約削除後も合祀管理画面に孤児レコードが残る／
        // saleContractRole が active のまま残り顧客削除判定（上記）を狂わせる。
        const childCascades: Array<{
          entityType: HistoryEntityType;
          findActive: () => Promise<Array<{ id: string }>>;
          softDelete: (childId: string) => Promise<unknown>;
        }> = [
          {
            entityType: 'CollectiveBurial',
            findActive: () =>
              tx.collectiveBurial.findMany({
                where: { contract_plot_id: id, deleted_at: null },
                select: { id: true },
              }),
            softDelete: (childId) =>
              tx.collectiveBurial.update({ where: { id: childId }, data: { deleted_at: now } }),
          },
          {
            entityType: 'BuriedPerson',
            findActive: () =>
              tx.buriedPerson.findMany({
                where: { contract_plot_id: id, deleted_at: null },
                select: { id: true },
              }),
            softDelete: (childId) =>
              tx.buriedPerson.update({ where: { id: childId }, data: { deleted_at: now } }),
          },
          {
            entityType: 'GravestoneInfo',
            findActive: () =>
              tx.gravestoneInfo.findMany({
                where: { contract_plot_id: id, deleted_at: null },
                select: { id: true },
              }),
            softDelete: (childId) =>
              tx.gravestoneInfo.update({ where: { id: childId }, data: { deleted_at: now } }),
          },
          {
            entityType: 'ConstructionInfo',
            findActive: () =>
              tx.constructionInfo.findMany({
                where: { contract_plot_id: id, deleted_at: null },
                select: { id: true },
              }),
            softDelete: (childId) =>
              tx.constructionInfo.update({ where: { id: childId }, data: { deleted_at: now } }),
          },
          {
            entityType: 'FamilyContact',
            findActive: () =>
              tx.familyContact.findMany({
                where: { contract_plot_id: id, deleted_at: null },
                select: { id: true },
              }),
            softDelete: (childId) =>
              tx.familyContact.update({ where: { id: childId }, data: { deleted_at: now } }),
          },
          {
            entityType: 'SaleContractRole',
            findActive: () =>
              tx.saleContractRole.findMany({
                where: { contract_plot_id: id, deleted_at: null },
                select: { id: true },
              }),
            softDelete: (childId) =>
              tx.saleContractRole.update({ where: { id: childId }, data: { deleted_at: now } }),
          },
          {
            entityType: 'Document',
            findActive: () =>
              tx.document.findMany({
                where: { contract_plot_id: id, deleted_at: null },
                select: { id: true },
              }),
            softDelete: (childId) =>
              tx.document.update({ where: { id: childId }, data: { deleted_at: now } }),
          },
          {
            entityType: 'Billing',
            findActive: () =>
              tx.billing.findMany({
                where: { contract_plot_id: id, deleted_at: null },
                select: { id: true },
              }),
            softDelete: (childId) =>
              tx.billing.update({ where: { id: childId }, data: { deleted_at: now } }),
          },
          {
            entityType: 'Payment',
            findActive: () =>
              tx.payment.findMany({
                where: { contract_plot_id: id, deleted_at: null },
                select: { id: true },
              }),
            softDelete: (childId) =>
              tx.payment.update({ where: { id: childId }, data: { deleted_at: now } }),
          },
        ];

        for (const cascade of childCascades) {
          const rows = await cascade.findActive();
          for (const row of rows) {
            await cascade.softDelete(row.id);
            await recordEntityDeleted(tx, {
              entityType: cascade.entityType,
              entityId: row.id,
              physicalPlotId,
              contractPlotId: id,
              beforeRecord: { id: row.id },
              req,
            });
          }
        }

        // 8. PhysicalPlotのステータスを更新
        await updatePhysicalPlotStatus(tx, physicalPlotId);
      },
      // 在庫面積・status再計算を含むため並行更新と直列化する（#278）
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

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
