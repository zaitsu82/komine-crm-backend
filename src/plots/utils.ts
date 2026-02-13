/**
 * 在庫管理ユーティリティ
 *
 * 物理区画の在庫計算と契約可能面積の検証を行います
 */

import { PrismaClient } from '@prisma/client';

/**
 * 物理区画の利用可能面積を計算
 * @param prisma Prismaクライアント（トランザクション対応）
 * @param physicalPlotId 物理区画ID
 * @returns 利用可能面積（㎡）
 */
export async function calculateAvailableArea(
  prisma: PrismaClient | any,
  physicalPlotId: string
): Promise<number> {
  const physicalPlot = await prisma.physicalPlot.findUnique({
    where: { id: physicalPlotId },
    include: {
      contractPlots: {
        where: {
          deleted_at: null,
        },
        select: {
          contract_area_sqm: true,
        },
      },
    },
  });

  if (!physicalPlot) {
    throw new Error(`Physical plot not found: ${physicalPlotId}`);
  }

  // 総面積
  const totalArea = physicalPlot.area_sqm.toNumber();

  // 契約済み面積の合計
  const contractedArea = (physicalPlot.contractPlots || []).reduce(
    (sum: number, contract: any) => sum + contract.contract_area_sqm.toNumber(),
    0
  );

  // 利用可能面積 = 総面積 - 契約済み面積
  const availableArea = totalArea - contractedArea;

  return Math.max(0, availableArea); // 負の値にならないように
}

/**
 * 契約面積が物理区画の利用可能面積内か検証
 * @param prisma Prismaクライアント（トランザクション対応）
 * @param physicalPlotId 物理区画ID
 * @param requestedArea 希望契約面積（㎡）
 * @param excludeContractPlotId 除外する契約区画ID（更新時に使用）
 * @returns 契約可能かどうか
 */
export async function validateContractArea(
  prisma: PrismaClient | any,
  physicalPlotId: string,
  requestedArea: number,
  excludeContractPlotId?: string
): Promise<{
  isValid: boolean;
  availableArea: number;
  message?: string;
}> {
  const physicalPlot = await prisma.physicalPlot.findUnique({
    where: { id: physicalPlotId },
    include: {
      contractPlots: {
        where: {
          deleted_at: null,
          ...(excludeContractPlotId && { id: { not: excludeContractPlotId } }),
        },
        select: {
          contract_area_sqm: true,
        },
      },
    },
  });

  if (!physicalPlot) {
    return {
      isValid: false,
      availableArea: 0,
      message: '物理区画が見つかりません',
    };
  }

  const totalArea = physicalPlot.area_sqm.toNumber();
  const contractedArea = (physicalPlot.contractPlots || []).reduce(
    (sum: number, contract: any) => sum + contract.contract_area_sqm.toNumber(),
    0
  );
  const availableArea = totalArea - contractedArea;

  if (requestedArea > availableArea) {
    return {
      isValid: false,
      availableArea,
      message: `契約面積${requestedArea}㎡が利用可能面積${availableArea}㎡を超えています`,
    };
  }

  if (requestedArea <= 0) {
    return {
      isValid: false,
      availableArea,
      message: '契約面積は0より大きい値を指定してください',
    };
  }

  return {
    isValid: true,
    availableArea,
  };
}

/**
 * 物理区画のステータスを自動更新
 * 契約状況に基づいて available / partially_sold / sold_out を設定
 * @param prisma Prismaクライアント（トランザクション対応）
 * @param physicalPlotId 物理区画ID
 * @returns 更新後のステータス
 */
export async function updatePhysicalPlotStatus(
  prisma: PrismaClient | any,
  physicalPlotId: string
): Promise<'available' | 'partially_sold' | 'sold_out'> {
  const availableArea = await calculateAvailableArea(prisma, physicalPlotId);

  const physicalPlot = await prisma.physicalPlot.findUnique({
    where: { id: physicalPlotId },
    select: { area_sqm: true },
  });

  if (!physicalPlot) {
    throw new Error(`Physical plot not found: ${physicalPlotId}`);
  }

  const totalArea = physicalPlot.area_sqm.toNumber();

  let newStatus: 'available' | 'partially_sold' | 'sold_out';

  if (availableArea === totalArea) {
    newStatus = 'available';
  } else if (availableArea > 0) {
    newStatus = 'partially_sold';
  } else {
    newStatus = 'sold_out';
  }

  await prisma.physicalPlot.update({
    where: { id: physicalPlotId },
    data: { status: newStatus },
  });

  return newStatus;
}

/**
 * 物理区画が完全に利用可能か（契約がない状態）
 * @param prisma Prismaクライアント（トランザクション対応）
 * @param physicalPlotId 物理区画ID
 * @returns 完全に利用可能かどうか
 */
export async function isFullyAvailable(
  prisma: PrismaClient | any,
  physicalPlotId: string
): Promise<boolean> {
  const physicalPlot = await prisma.physicalPlot.findUnique({
    where: { id: physicalPlotId },
    include: {
      contractPlots: {
        where: { deleted_at: null },
      },
    },
  });

  if (!physicalPlot) {
    return false;
  }

  return physicalPlot.contractPlots.length === 0;
}

/**
 * 物理区画が完全に売却済みか
 * @param prisma Prismaクライアント（トランザクション対応）
 * @param physicalPlotId 物理区画ID
 * @returns 完全に売却済みかどうか
 */
export async function isFullySold(
  prisma: PrismaClient | any,
  physicalPlotId: string
): Promise<boolean> {
  const availableArea = await calculateAvailableArea(prisma, physicalPlotId);
  return availableArea === 0;
}

/**
 * 契約可能な面積の選択肢を取得
 * 物理区画の利用可能面積に基づいて、契約可能な面積パターンを返す
 * @param prisma Prismaクライアント（トランザクション対応）
 * @param physicalPlotId 物理区画ID
 * @returns 契約可能な面積パターン（例: [1.8, 3.6]）
 */
export async function getAvailableAreaOptions(
  prisma: PrismaClient | any,
  physicalPlotId: string
): Promise<number[]> {
  const availableArea = await calculateAvailableArea(prisma, physicalPlotId);

  const options: number[] = [];

  // 標準的な契約面積パターン
  const standardSizes = [1.8, 3.6];

  for (const size of standardSizes) {
    if (size <= availableArea) {
      options.push(size);
    }
  }

  return options;
}
