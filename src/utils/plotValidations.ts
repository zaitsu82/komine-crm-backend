/**
 * 区画バリデーションユーティリティ
 *
 * 物理区画・契約区画に関するバリデーションロジックを提供します
 */

import { PrismaClient } from '@prisma/client';
import { ValidationError } from '../middleware/errorHandler';

/**
 * 区画番号の形式検証
 * 形式: {エリア名}-{番号} (例: A-56, B-23)
 * @param plotNumber 区画番号
 * @returns 妥当性
 */
export function validatePlotNumberFormat(plotNumber: string): boolean {
  const plotNumberRegex = /^[A-Z]-\d+$/;
  return plotNumberRegex.test(plotNumber);
}

/**
 * 区画番号の重複チェック
 * @param prisma Prismaクライアント（トランザクション対応）
 * @param plotNumber 区画番号
 * @param excludeId 除外するID（更新時に使用）
 * @returns 重複しているかどうか
 */
export async function isPlotNumberDuplicate(
  prisma: PrismaClient | any,
  plotNumber: string,
  excludeId?: string
): Promise<boolean> {
  const existingPlot = await prisma.physicalPlot.findFirst({
    where: {
      plot_number: plotNumber,
      deleted_at: null,
      ...(excludeId && { id: { not: excludeId } }),
    },
  });

  return existingPlot !== null;
}

/**
 * 面積の妥当性検証
 * @param areaSqm 面積（㎡）
 * @returns 妥当性
 */
export function validateAreaSize(areaSqm: number): {
  isValid: boolean;
  message?: string;
} {
  if (areaSqm <= 0) {
    return {
      isValid: false,
      message: '面積は0より大きい値を指定してください',
    };
  }

  // 最小面積: 1.8㎡
  if (areaSqm < 1.8) {
    return {
      isValid: false,
      message: '面積は1.8㎡以上を指定してください',
    };
  }

  // 最大面積: 10㎡（ビジネスルール）
  if (areaSqm > 10) {
    return {
      isValid: false,
      message: '面積は10㎡以下を指定してください',
    };
  }

  return { isValid: true };
}

/**
 * 契約面積が標準サイズか検証
 * 標準サイズ: 1.8㎡ または 3.6㎡
 * @param areaSqm 契約面積（㎡）
 * @returns 標準サイズかどうか
 */
export function isStandardContractSize(areaSqm: number): boolean {
  const standardSizes = [1.8, 3.6];
  return standardSizes.includes(areaSqm);
}

/**
 * 契約面積が物理区画面積の妥当な分割か検証
 * 例: 3.6㎡の物理区画は 1.8㎡×2 に分割可能
 * @param physicalPlotAreaSqm 物理区画面積
 * @param contractAreaSqm 契約面積
 * @returns 妥当な分割かどうか
 */
export function isValidAreaDivision(
  physicalPlotAreaSqm: number,
  contractAreaSqm: number
): {
  isValid: boolean;
  message?: string;
} {
  // 契約面積が物理区画面積を超える
  if (contractAreaSqm > physicalPlotAreaSqm) {
    return {
      isValid: false,
      message: '契約面積が物理区画面積を超えています',
    };
  }

  // 3.6㎡の区画は 1.8㎡×2 または 3.6㎡×1 のみ
  if (physicalPlotAreaSqm === 3.6) {
    if (contractAreaSqm !== 1.8 && contractAreaSqm !== 3.6) {
      return {
        isValid: false,
        message: '3.6㎡の物理区画は1.8㎡または3.6㎡の契約のみ可能です',
      };
    }
  }

  return { isValid: true };
}

/**
 * 物理区画の削除可能性チェック
 * 契約が存在する場合は削除不可
 * @param prisma Prismaクライアント（トランザクション対応）
 * @param physicalPlotId 物理区画ID
 * @returns 削除可能かどうか
 */
export async function canDeletePhysicalPlot(
  prisma: PrismaClient | any,
  physicalPlotId: string
): Promise<{
  canDelete: boolean;
  reason?: string;
}> {
  const physicalPlot = await prisma.physicalPlot.findUnique({
    where: { id: physicalPlotId },
    include: {
      ContractPlots: {
        where: { deleted_at: null },
      },
    },
  });

  if (!physicalPlot) {
    return {
      canDelete: false,
      reason: '物理区画が見つかりません',
    };
  }

  if (physicalPlot.ContractPlots.length > 0) {
    return {
      canDelete: false,
      reason: '契約が存在するため削除できません',
    };
  }

  return { canDelete: true };
}

/**
 * 契約区画の削除可能性チェック
 * 販売契約が存在する場合は削除不可
 * @param prisma Prismaクライアント（トランザクション対応）
 * @param contractPlotId 契約区画ID
 * @returns 削除可能かどうか
 */
export async function canDeleteContractPlot(
  prisma: PrismaClient | any,
  contractPlotId: string
): Promise<{
  canDelete: boolean;
  reason?: string;
}> {
  const contractPlot = await prisma.contractPlot.findUnique({
    where: { id: contractPlotId },
    include: {
      SaleContract: true,
    },
  });

  if (!contractPlot) {
    return {
      canDelete: false,
      reason: '契約区画が見つかりません',
    };
  }

  if (contractPlot.SaleContract && contractPlot.SaleContract.deleted_at === null) {
    return {
      canDelete: false,
      reason: '販売契約が存在するため削除できません',
    };
  }

  return { canDelete: true };
}

/**
 * 販売ステータスの妥当性検証
 * @param status 販売ステータス
 * @returns 妥当性
 */
export function validateSaleStatus(status: string): boolean {
  const validStatuses = ['available', 'reserved', 'contracted', 'cancelled'];
  return validStatuses.includes(status);
}

/**
 * 物理区画ステータスの妥当性検証
 * @param status 物理区画ステータス
 * @returns 妥当性
 */
export function validatePhysicalPlotStatus(status: string): boolean {
  const validStatuses = ['available', 'partially_sold', 'sold_out'];
  return validStatuses.includes(status);
}

/**
 * 契約日の妥当性検証
 * 未来の日付は不可
 * @param contractDate 契約日
 * @returns 妥当性
 */
export function validateContractDate(contractDate: Date): {
  isValid: boolean;
  message?: string;
} {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const inputDate = new Date(contractDate);
  inputDate.setHours(0, 0, 0, 0);

  if (inputDate > today) {
    return {
      isValid: false,
      message: '契約日は本日以前の日付を指定してください',
    };
  }

  return { isValid: true };
}

/**
 * 顧客ロールの妥当性検証
 * @param role 顧客ロール
 * @returns 妥当性
 */
export function validateCustomerRole(role: string): boolean {
  const validRoles = ['applicant', 'contractor', 'heir'];
  return validRoles.includes(role);
}

/**
 * 物理区画バリデーション（作成時）
 * @param prisma Prismaクライアント（トランザクション対応）
 * @param plotNumber 区画番号
 * @param areaSqm 面積
 * @throws ValidationError
 */
export async function validatePhysicalPlotCreate(
  prisma: PrismaClient | any,
  plotNumber: string,
  areaSqm: number
): Promise<void> {
  // 区画番号の形式チェック
  if (!validatePlotNumberFormat(plotNumber)) {
    throw new ValidationError('区画番号の形式が正しくありません（例: A-56）', [
      { field: 'plotNumber', message: '形式: {エリア名}-{番号}' },
    ]);
  }

  // 区画番号の重複チェック
  const isDuplicate = await isPlotNumberDuplicate(prisma, plotNumber);
  if (isDuplicate) {
    throw new ValidationError('この区画番号は既に使用されています', [
      { field: 'plotNumber', message: `${plotNumber} は既に存在します` },
    ]);
  }

  // 面積の妥当性チェック
  const areaValidation = validateAreaSize(areaSqm);
  if (!areaValidation.isValid) {
    throw new ValidationError(areaValidation.message || '面積が不正です', [
      { field: 'areaSqm', message: areaValidation.message || '' },
    ]);
  }
}

/**
 * 物理区画バリデーション（更新時）
 * @param prisma Prismaクライアント（トランザクション対応）
 * @param id 物理区画ID
 * @param plotNumber 区画番号（更新する場合）
 * @param areaSqm 面積（更新する場合）
 * @throws ValidationError
 */
export async function validatePhysicalPlotUpdate(
  prisma: PrismaClient | any,
  id: string,
  plotNumber?: string,
  areaSqm?: number
): Promise<void> {
  // 区画番号を更新する場合
  if (plotNumber) {
    if (!validatePlotNumberFormat(plotNumber)) {
      throw new ValidationError('区画番号の形式が正しくありません（例: A-56）', [
        { field: 'plotNumber', message: '形式: {エリア名}-{番号}' },
      ]);
    }

    const isDuplicate = await isPlotNumberDuplicate(prisma, plotNumber, id);
    if (isDuplicate) {
      throw new ValidationError('この区画番号は既に使用されています', [
        { field: 'plotNumber', message: `${plotNumber} は既に存在します` },
      ]);
    }
  }

  // 面積を更新する場合
  if (areaSqm !== undefined) {
    const areaValidation = validateAreaSize(areaSqm);
    if (!areaValidation.isValid) {
      throw new ValidationError(areaValidation.message || '面積が不正です', [
        { field: 'areaSqm', message: areaValidation.message || '' },
      ]);
    }

    // 既存の契約との整合性チェック
    const physicalPlot = await prisma.physicalPlot.findUnique({
      where: { id },
      include: {
        ContractPlots: {
          where: { deleted_at: null },
        },
      },
    });

    if (physicalPlot) {
      const totalContractedArea = (physicalPlot.ContractPlots || []).reduce(
        (sum: number, contract: any) => sum + contract.contract_area_sqm.toNumber(),
        0
      );

      if (areaSqm < totalContractedArea) {
        throw new ValidationError('物理区画面積が契約済み面積より小さくなります', [
          {
            field: 'areaSqm',
            message: `契約済み面積: ${totalContractedArea}㎡`,
          },
        ]);
      }
    }
  }
}
