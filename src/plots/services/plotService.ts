/**
 * 物理区画サービス
 * PhysicalPlotに関する共通処理を提供
 */

import { PrismaClient, Prisma } from '@prisma/client';

/**
 * 物理区画をIDで検索（論理削除を除外）
 * @param prisma - PrismaClientインスタンス
 * @param id - 物理区画ID
 * @returns 物理区画またはnull
 */
export async function findPhysicalPlotById(
  prisma: PrismaClient | Prisma.TransactionClient,
  id: string
) {
  return prisma.physicalPlot.findUnique({
    where: { id, deleted_at: null },
  });
}

/**
 * 物理区画をIDで検索（契約情報を含む）
 * @param prisma - PrismaClientインスタンス
 * @param id - 物理区画ID
 * @returns 物理区画（契約情報付き）またはnull
 */
export async function findPhysicalPlotWithContracts(
  prisma: PrismaClient | Prisma.TransactionClient,
  id: string
) {
  return prisma.physicalPlot.findUnique({
    where: { id, deleted_at: null },
    include: {
      contractPlots: {
        where: { deleted_at: null },
        include: {
          saleContractRoles: {
            where: { deleted_at: null },
            include: {
              customer: {
                select: {
                  id: true,
                  name: true,
                  name_kana: true,
                  phone_number: true,
                },
              },
            },
          },
          usageFee: true,
          managementFee: true,
        },
        orderBy: { created_at: 'desc' },
      },
    },
  });
}

/**
 * 物理区画の存在を検証
 * @param prisma - PrismaClientインスタンス
 * @param id - 物理区画ID
 * @returns 物理区画
 * @throws 物理区画が見つからない場合にエラー
 */
export async function validatePhysicalPlotExists(
  prisma: PrismaClient | Prisma.TransactionClient,
  id: string
) {
  const plot = await findPhysicalPlotById(prisma, id);
  if (!plot) {
    throw new Error('指定された物理区画が見つかりません');
  }
  return plot;
}

/**
 * 物理区画レスポンスの構築
 * @param physicalPlot - 物理区画データ
 * @returns フォーマット済みレスポンス
 */
export function buildPhysicalPlotResponse(physicalPlot: any) {
  return {
    id: physicalPlot.id,
    plotNumber: physicalPlot.plot_number,
    areaName: physicalPlot.area_name,
    areaSqm: physicalPlot.area_sqm.toNumber(),
    status: physicalPlot.status,
    notes: physicalPlot.notes,
    createdAt: physicalPlot.created_at,
    updatedAt: physicalPlot.updated_at,
  };
}

/**
 * 物理区画の契約サマリーを構築
 * @param contracts - 契約区画の配列
 * @returns サマリー情報
 */
export function buildContractsSummary(contracts: any[]) {
  const totalContracts = contracts.length;
  const totalAllocatedArea = contracts.reduce(
    (sum, contract) => sum + contract.contract_area_sqm.toNumber(),
    0
  );

  return {
    totalContracts,
    totalAllocatedArea,
  };
}
