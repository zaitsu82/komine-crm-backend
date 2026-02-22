import { Request, Response } from 'express';
import prisma from '../db/prisma';
import {
  createMasterSchema,
  updateMasterSchema,
  isValidMasterType,
  MasterType,
} from '../validations/masterValidation';

/**
 * マスターデータの共通レスポンス型
 */
interface MasterData {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  sortOrder?: number | null;
  isActive: boolean;
}

interface TaxTypeMasterData extends MasterData {
  taxRate?: string | null;
}

/**
 * 墓地タイプマスタ取得
 * GET /api/v1/masters/cemetery-type
 */
export const getCemeteryTypeMaster = async (_req: Request, res: Response) => {
  try {
    const data = await prisma.cemeteryTypeMaster.findMany({
      where: { is_active: true },
      orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
    });

    const formatted: MasterData[] = data.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      description: item.description,
      sortOrder: item.sort_order,
      isActive: item.is_active,
    }));

    res.status(200).json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    console.error('Error fetching cemetery type master:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '墓地タイプマスタの取得に失敗しました',
      },
    });
  }
};

/**
 * 支払方法マスタ取得
 * GET /api/v1/masters/payment-method
 */
export const getPaymentMethodMaster = async (_req: Request, res: Response) => {
  try {
    const data = await prisma.paymentMethodMaster.findMany({
      where: { is_active: true },
      orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
    });

    const formatted: MasterData[] = data.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      description: item.description,
      sortOrder: item.sort_order,
      isActive: item.is_active,
    }));

    res.status(200).json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    console.error('Error fetching payment method master:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '支払方法マスタの取得に失敗しました',
      },
    });
  }
};

/**
 * 税タイプマスタ取得
 * GET /api/v1/masters/tax-type
 */
export const getTaxTypeMaster = async (_req: Request, res: Response) => {
  try {
    const data = await prisma.taxTypeMaster.findMany({
      where: { is_active: true },
      orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
    });

    const formatted: TaxTypeMasterData[] = data.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      description: item.description,
      sortOrder: item.sort_order,
      isActive: item.is_active,
      taxRate: item.tax_rate?.toString() || null,
    }));

    res.status(200).json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    console.error('Error fetching tax type master:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '税タイプマスタの取得に失敗しました',
      },
    });
  }
};

/**
 * 計算タイプマスタ取得
 * GET /api/v1/masters/calc-type
 */
export const getCalcTypeMaster = async (_req: Request, res: Response) => {
  try {
    const data = await prisma.calcTypeMaster.findMany({
      where: { is_active: true },
      orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
    });

    const formatted: MasterData[] = data.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      description: item.description,
      sortOrder: item.sort_order,
      isActive: item.is_active,
    }));

    res.status(200).json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    console.error('Error fetching calc type master:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '計算タイプマスタの取得に失敗しました',
      },
    });
  }
};

/**
 * 請求タイプマスタ取得
 * GET /api/v1/masters/billing-type
 */
export const getBillingTypeMaster = async (_req: Request, res: Response) => {
  try {
    const data = await prisma.billingTypeMaster.findMany({
      where: { is_active: true },
      orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
    });

    const formatted: MasterData[] = data.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      description: item.description,
      sortOrder: item.sort_order,
      isActive: item.is_active,
    }));

    res.status(200).json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    console.error('Error fetching billing type master:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '請求タイプマスタの取得に失敗しました',
      },
    });
  }
};

/**
 * 口座タイプマスタ取得
 * GET /api/v1/masters/account-type
 */
export const getAccountTypeMaster = async (_req: Request, res: Response) => {
  try {
    const data = await prisma.accountTypeMaster.findMany({
      where: { is_active: true },
      orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
    });

    const formatted: MasterData[] = data.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      description: item.description,
      sortOrder: item.sort_order,
      isActive: item.is_active,
    }));

    res.status(200).json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    console.error('Error fetching account type master:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '口座タイプマスタの取得に失敗しました',
      },
    });
  }
};

/**
 * 受取人タイプマスタ取得
 * GET /api/v1/masters/recipient-type
 */
export const getRecipientTypeMaster = async (_req: Request, res: Response) => {
  try {
    const data = await prisma.recipientTypeMaster.findMany({
      where: { is_active: true },
      orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
    });

    const formatted: MasterData[] = data.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      description: item.description,
      sortOrder: item.sort_order,
      isActive: item.is_active,
    }));

    res.status(200).json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    console.error('Error fetching recipient type master:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '受取人タイプマスタの取得に失敗しました',
      },
    });
  }
};

/**
 * 工事タイプマスタ取得
 * GET /api/v1/masters/construction-type
 */
export const getConstructionTypeMaster = async (_req: Request, res: Response) => {
  try {
    const data = await prisma.constructionTypeMaster.findMany({
      where: { is_active: true },
      orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
    });

    const formatted: MasterData[] = data.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      description: item.description,
      sortOrder: item.sort_order,
      isActive: item.is_active,
    }));

    res.status(200).json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    console.error('Error fetching construction type master:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '工事タイプマスタの取得に失敗しました',
      },
    });
  }
};

/**
 * マスタタイプからPrismaモデルデリゲートを取得
 */
const getMasterDelegate = (masterType: MasterType) => {
  const delegateMap: Record<MasterType, any> = {
    'cemetery-type': prisma.cemeteryTypeMaster,
    'payment-method': prisma.paymentMethodMaster,
    'tax-type': prisma.taxTypeMaster,
    'calc-type': prisma.calcTypeMaster,
    'billing-type': prisma.billingTypeMaster,
    'account-type': prisma.accountTypeMaster,
    'recipient-type': prisma.recipientTypeMaster,
    'construction-type': prisma.constructionTypeMaster,
  };
  return delegateMap[masterType];
};

const masterTypeLabels: Record<MasterType, string> = {
  'cemetery-type': '墓地タイプ',
  'payment-method': '支払方法',
  'tax-type': '税タイプ',
  'calc-type': '計算タイプ',
  'billing-type': '請求タイプ',
  'account-type': '口座タイプ',
  'recipient-type': '受取人タイプ',
  'construction-type': '工事タイプ',
};

/**
 * マスタデータ作成
 * POST /api/v1/masters/:masterType
 */
export const createMaster = async (req: Request, res: Response) => {
  const { masterType } = req.params;

  if (!isValidMasterType(masterType)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: `無効なマスタタイプです: ${masterType}`,
        details: [],
      },
    });
  }

  const parsed = createMasterSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'バリデーションエラー',
        details: parsed.error.issues.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      },
    });
  }

  try {
    const delegate = getMasterDelegate(masterType);
    const { taxRate, sortOrder, isActive, ...rest } = parsed.data;

    const createData: any = {
      ...rest,
      sort_order: sortOrder ?? null,
      is_active: isActive ?? true,
    };

    if (masterType === 'tax-type' && taxRate !== undefined) {
      createData.tax_rate = taxRate;
    }

    const created = await delegate.create({ data: createData });
    const label = masterTypeLabels[masterType];

    const formatted: any = {
      id: created.id,
      code: created.code,
      name: created.name,
      description: created.description,
      sortOrder: created.sort_order,
      isActive: created.is_active,
    };
    if (masterType === 'tax-type' && 'tax_rate' in created) {
      formatted.taxRate = created.tax_rate?.toString() || null;
    }

    res.status(201).json({
      success: true,
      data: formatted,
      message: `${label}マスタを作成しました`,
    });
  } catch (error: any) {
    const label = masterTypeLabels[masterType];

    if (error?.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: `${label}マスタのコードが重複しています`,
          details: [],
        },
      });
    }

    console.error(`Error creating ${masterType} master:`, error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: `${label}マスタの作成に失敗しました`,
      },
    });
  }
};

/**
 * マスタデータ更新
 * PUT /api/v1/masters/:masterType/:id
 */
export const updateMaster = async (req: Request, res: Response) => {
  const { masterType, id } = req.params;

  if (!isValidMasterType(masterType)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: `無効なマスタタイプです: ${masterType}`,
        details: [],
      },
    });
  }

  const masterId = parseInt(id, 10);
  if (isNaN(masterId)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: '無効なIDです',
        details: [],
      },
    });
  }

  const parsed = updateMasterSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'バリデーションエラー',
        details: parsed.error.issues.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      },
    });
  }

  try {
    const delegate = getMasterDelegate(masterType);
    const { taxRate, sortOrder, isActive, ...rest } = parsed.data;

    const updateData: any = { ...rest };
    if (sortOrder !== undefined) updateData.sort_order = sortOrder;
    if (isActive !== undefined) updateData.is_active = isActive;
    if (masterType === 'tax-type' && taxRate !== undefined) {
      updateData.tax_rate = taxRate;
    }

    const updated = await delegate.update({
      where: { id: masterId },
      data: updateData,
    });

    const label = masterTypeLabels[masterType];
    const formatted: any = {
      id: updated.id,
      code: updated.code,
      name: updated.name,
      description: updated.description,
      sortOrder: updated.sort_order,
      isActive: updated.is_active,
    };
    if (masterType === 'tax-type' && 'tax_rate' in updated) {
      formatted.taxRate = updated.tax_rate?.toString() || null;
    }

    res.status(200).json({
      success: true,
      data: formatted,
      message: `${label}マスタを更新しました`,
    });
  } catch (error: any) {
    const label = masterTypeLabels[masterType];

    if (error?.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `${label}マスタが見つかりません (ID: ${id})`,
          details: [],
        },
      });
    }

    if (error?.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: `${label}マスタのコードが重複しています`,
          details: [],
        },
      });
    }

    console.error(`Error updating ${masterType} master:`, error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: `${label}マスタの更新に失敗しました`,
      },
    });
  }
};

/**
 * マスタデータ削除
 * DELETE /api/v1/masters/:masterType/:id
 */
export const deleteMaster = async (req: Request, res: Response) => {
  const { masterType, id } = req.params;

  if (!isValidMasterType(masterType)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: `無効なマスタタイプです: ${masterType}`,
        details: [],
      },
    });
  }

  const masterId = parseInt(id, 10);
  if (isNaN(masterId)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: '無効なIDです',
        details: [],
      },
    });
  }

  try {
    const delegate = getMasterDelegate(masterType);
    const label = masterTypeLabels[masterType];

    await delegate.delete({ where: { id: masterId } });

    res.status(200).json({
      success: true,
      message: `${label}マスタを削除しました`,
    });
  } catch (error: any) {
    const label = masterTypeLabels[masterType];

    if (error?.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `${label}マスタが見つかりません (ID: ${id})`,
          details: [],
        },
      });
    }

    console.error(`Error deleting ${masterType} master:`, error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: `${label}マスタの削除に失敗しました`,
      },
    });
  }
};

/**
 * 全マスタデータ一括取得
 * GET /api/v1/masters/all
 */
export const getAllMasters = async (_req: Request, res: Response) => {
  try {
    const [
      cemeteryType,
      paymentMethod,
      taxType,
      calcType,
      billingType,
      accountType,
      recipientType,
      constructionType,
    ] = await Promise.all([
      prisma.cemeteryTypeMaster.findMany({
        where: { is_active: true },
        orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
      }),
      prisma.paymentMethodMaster.findMany({
        where: { is_active: true },
        orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
      }),
      prisma.taxTypeMaster.findMany({
        where: { is_active: true },
        orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
      }),
      prisma.calcTypeMaster.findMany({
        where: { is_active: true },
        orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
      }),
      prisma.billingTypeMaster.findMany({
        where: { is_active: true },
        orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
      }),
      prisma.accountTypeMaster.findMany({
        where: { is_active: true },
        orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
      }),
      prisma.recipientTypeMaster.findMany({
        where: { is_active: true },
        orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
      }),
      prisma.constructionTypeMaster.findMany({
        where: { is_active: true },
        orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
      }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        cemeteryType: cemeteryType.map((item) => ({
          id: item.id,
          code: item.code,
          name: item.name,
          description: item.description,
          sortOrder: item.sort_order,
          isActive: item.is_active,
        })),
        paymentMethod: paymentMethod.map((item) => ({
          id: item.id,
          code: item.code,
          name: item.name,
          description: item.description,
          sortOrder: item.sort_order,
          isActive: item.is_active,
        })),
        taxType: taxType.map((item) => ({
          id: item.id,
          code: item.code,
          name: item.name,
          description: item.description,
          sortOrder: item.sort_order,
          isActive: item.is_active,
          taxRate: item.tax_rate?.toString() || null,
        })),
        calcType: calcType.map((item) => ({
          id: item.id,
          code: item.code,
          name: item.name,
          description: item.description,
          sortOrder: item.sort_order,
          isActive: item.is_active,
        })),
        billingType: billingType.map((item) => ({
          id: item.id,
          code: item.code,
          name: item.name,
          description: item.description,
          sortOrder: item.sort_order,
          isActive: item.is_active,
        })),
        accountType: accountType.map((item) => ({
          id: item.id,
          code: item.code,
          name: item.name,
          description: item.description,
          sortOrder: item.sort_order,
          isActive: item.is_active,
        })),
        recipientType: recipientType.map((item) => ({
          id: item.id,
          code: item.code,
          name: item.name,
          description: item.description,
          sortOrder: item.sort_order,
          isActive: item.is_active,
        })),
        constructionType: constructionType.map((item) => ({
          id: item.id,
          code: item.code,
          name: item.name,
          description: item.description,
          sortOrder: item.sort_order,
          isActive: item.is_active,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching all masters:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '全マスタデータの取得に失敗しました',
      },
    });
  }
};
