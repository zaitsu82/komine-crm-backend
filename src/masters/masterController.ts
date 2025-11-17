import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

interface PrefectureMasterData extends MasterData {
  nameKana?: string | null;
}

/**
 * 使用状況マスタ取得
 * GET /api/v1/masters/usage-status
 */
export const getUsageStatusMaster = async (_req: Request, res: Response) => {
  try {
    const data = await prisma.usageStatusMaster.findMany({
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
    console.error('Error fetching usage status master:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '使用状況マスタの取得に失敗しました',
      },
    });
  }
};

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
 * 宗派マスタ取得
 * GET /api/v1/masters/denomination
 */
export const getDenominationMaster = async (_req: Request, res: Response) => {
  try {
    const data = await prisma.denominationMaster.findMany({
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
    console.error('Error fetching denomination master:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '宗派マスタの取得に失敗しました',
      },
    });
  }
};

/**
 * 性別マスタ取得
 * GET /api/v1/masters/gender
 */
export const getGenderMaster = async (_req: Request, res: Response) => {
  try {
    const data = await prisma.genderMaster.findMany({
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
    console.error('Error fetching gender master:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '性別マスタの取得に失敗しました',
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
 * 続柄マスタ取得
 * GET /api/v1/masters/relation
 */
export const getRelationMaster = async (_req: Request, res: Response) => {
  try {
    const data = await prisma.relationMaster.findMany({
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
    console.error('Error fetching relation master:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '続柄マスタの取得に失敗しました',
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
 * 更新タイプマスタ取得
 * GET /api/v1/masters/update-type
 */
export const getUpdateTypeMaster = async (_req: Request, res: Response) => {
  try {
    const data = await prisma.updateTypeMaster.findMany({
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
    console.error('Error fetching update type master:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '更新タイプマスタの取得に失敗しました',
      },
    });
  }
};

/**
 * 都道府県マスタ取得
 * GET /api/v1/masters/prefecture
 */
export const getPrefectureMaster = async (_req: Request, res: Response) => {
  try {
    const data = await prisma.prefectureMaster.findMany({
      where: { is_active: true },
      orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
    });

    const formatted: PrefectureMasterData[] = data.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      description: null,
      sortOrder: item.sort_order,
      isActive: item.is_active,
      nameKana: item.name_kana,
    }));

    res.status(200).json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    console.error('Error fetching prefecture master:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '都道府県マスタの取得に失敗しました',
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
      usageStatus,
      cemeteryType,
      denomination,
      gender,
      paymentMethod,
      taxType,
      calcType,
      billingType,
      accountType,
      recipientType,
      relation,
      constructionType,
      updateType,
      prefecture,
    ] = await Promise.all([
      prisma.usageStatusMaster.findMany({
        where: { is_active: true },
        orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
      }),
      prisma.cemeteryTypeMaster.findMany({
        where: { is_active: true },
        orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
      }),
      prisma.denominationMaster.findMany({
        where: { is_active: true },
        orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
      }),
      prisma.genderMaster.findMany({
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
      prisma.relationMaster.findMany({
        where: { is_active: true },
        orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
      }),
      prisma.constructionTypeMaster.findMany({
        where: { is_active: true },
        orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
      }),
      prisma.updateTypeMaster.findMany({
        where: { is_active: true },
        orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
      }),
      prisma.prefectureMaster.findMany({
        where: { is_active: true },
        orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
      }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        usageStatus: usageStatus.map((item) => ({
          id: item.id,
          code: item.code,
          name: item.name,
          description: item.description,
          sortOrder: item.sort_order,
          isActive: item.is_active,
        })),
        cemeteryType: cemeteryType.map((item) => ({
          id: item.id,
          code: item.code,
          name: item.name,
          description: item.description,
          sortOrder: item.sort_order,
          isActive: item.is_active,
        })),
        denomination: denomination.map((item) => ({
          id: item.id,
          code: item.code,
          name: item.name,
          description: item.description,
          sortOrder: item.sort_order,
          isActive: item.is_active,
        })),
        gender: gender.map((item) => ({
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
        relation: relation.map((item) => ({
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
        updateType: updateType.map((item) => ({
          id: item.id,
          code: item.code,
          name: item.name,
          description: item.description,
          sortOrder: item.sort_order,
          isActive: item.is_active,
        })),
        prefecture: prefecture.map((item) => ({
          id: item.id,
          code: item.code,
          name: item.name,
          description: null,
          sortOrder: item.sort_order,
          isActive: item.is_active,
          nameKana: item.name_kana,
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
