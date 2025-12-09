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
