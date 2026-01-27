/**
 * 合祀管理コントローラー
 */

import { Request, Response, NextFunction } from 'express';
import { PrismaClient, BillingStatus } from '@prisma/client';
import { NotFoundError, ValidationError } from '../middleware/errorHandler';

const prisma = new PrismaClient();

/**
 * 合祀一覧取得
 */
export const getCollectiveBurialList = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      page = '1',
      limit = '50',
      search,
      billingStatus,
      year,
      sortBy = 'billing_scheduled_date',
      sortOrder = 'asc',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    // 検索条件の構築
    const where: Record<string, unknown> = {
      deleted_at: null,
    };

    // 請求ステータスフィルター
    if (billingStatus && ['pending', 'billed', 'paid'].includes(billingStatus as string)) {
      where['billing_status'] = billingStatus as BillingStatus;
    }

    // 年フィルター（請求予定年）
    if (year) {
      const yearNum = parseInt(year as string, 10);
      if (!isNaN(yearNum)) {
        where['billing_scheduled_date'] = {
          gte: new Date(`${yearNum}-01-01`),
          lt: new Date(`${yearNum + 1}-01-01`),
        };
      }
    }

    // 検索クエリ（顧客名、区画番号で検索）
    if (search) {
      where['contractPlot'] = {
        OR: [
          {
            physicalPlot: {
              plot_number: { contains: search as string, mode: 'insensitive' },
            },
          },
          {
            saleContractRoles: {
              some: {
                customer: {
                  OR: [
                    { name: { contains: search as string, mode: 'insensitive' } },
                    { name_kana: { contains: search as string, mode: 'insensitive' } },
                  ],
                },
              },
            },
          },
        ],
      };
    }

    // ソート条件
    const validSortFields = ['billing_scheduled_date', 'current_burial_count', 'created_at'];
    const sortField = validSortFields.includes(sortBy as string)
      ? (sortBy as string)
      : 'billing_scheduled_date';
    const order = sortOrder === 'desc' ? 'desc' : 'asc';

    // データ取得
    const [items, totalCount] = await Promise.all([
      prisma.collectiveBurial.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { [sortField]: order },
        include: {
          contractPlot: {
            include: {
              physicalPlot: true,
              saleContractRoles: {
                where: { deleted_at: null, role: 'applicant' },
                include: {
                  customer: true,
                },
                take: 1,
              },
              buriedPersons: {
                where: { deleted_at: null },
                select: { id: true, name: true, burial_date: true },
              },
            },
          },
        },
      }),
      prisma.collectiveBurial.count({ where }),
    ]);

    // レスポンス形式に変換
    const formattedItems = items.map((item) => {
      const applicant = item.contractPlot.saleContractRoles[0]?.customer;
      return {
        id: item.id,
        contractPlotId: item.contract_plot_id,
        plotNumber: item.contractPlot.physicalPlot.plot_number,
        areaName: item.contractPlot.physicalPlot.area_name,
        applicantName: applicant?.name || null,
        applicantNameKana: applicant?.name_kana || null,
        burialCapacity: item.burial_capacity,
        currentBurialCount: item.current_burial_count,
        capacityReachedDate: item.capacity_reached_date?.toISOString().split('T')[0] || null,
        validityPeriodYears: item.validity_period_years,
        billingScheduledDate: item.billing_scheduled_date?.toISOString().split('T')[0] || null,
        billingStatus: item.billing_status,
        billingAmount: item.billing_amount,
        notes: item.notes,
        buriedPersons: item.contractPlot.buriedPersons.map((bp) => ({
          id: bp.id,
          name: bp.name,
          burialDate: bp.burial_date?.toISOString().split('T')[0] || null,
        })),
        createdAt: item.created_at.toISOString(),
        updatedAt: item.updated_at.toISOString(),
      };
    });

    res.status(200).json({
      success: true,
      data: {
        items: formattedItems,
        pagination: {
          page: pageNum,
          limit: limitNum,
          totalCount,
          totalPages: Math.ceil(totalCount / limitNum),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 合祀詳細取得
 */
export const getCollectiveBurialById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const collectiveBurial = await prisma.collectiveBurial.findFirst({
      where: { id, deleted_at: null },
      include: {
        contractPlot: {
          include: {
            physicalPlot: true,
            saleContractRoles: {
              where: { deleted_at: null },
              include: {
                customer: {
                  include: {
                    billingInfo: true,
                  },
                },
              },
            },
            buriedPersons: {
              where: { deleted_at: null },
              orderBy: { burial_date: 'desc' },
            },
          },
        },
      },
    });

    if (!collectiveBurial) {
      throw new NotFoundError('合祀情報が見つかりません');
    }

    const applicant = collectiveBurial.contractPlot.saleContractRoles.find(
      (r) => r.role === 'applicant'
    )?.customer;

    res.status(200).json({
      success: true,
      data: {
        id: collectiveBurial.id,
        contractPlotId: collectiveBurial.contract_plot_id,
        plotNumber: collectiveBurial.contractPlot.physicalPlot.plot_number,
        areaName: collectiveBurial.contractPlot.physicalPlot.area_name,
        contractDate: collectiveBurial.contractPlot.contract_date.toISOString().split('T')[0],
        applicant: applicant
          ? {
              id: applicant.id,
              name: applicant.name,
              nameKana: applicant.name_kana,
              phone: applicant.phone_number,
              email: applicant.email,
              postalCode: applicant.postal_code,
              address: applicant.address,
            }
          : null,
        burialCapacity: collectiveBurial.burial_capacity,
        currentBurialCount: collectiveBurial.current_burial_count,
        capacityReachedDate:
          collectiveBurial.capacity_reached_date?.toISOString().split('T')[0] || null,
        validityPeriodYears: collectiveBurial.validity_period_years,
        billingScheduledDate:
          collectiveBurial.billing_scheduled_date?.toISOString().split('T')[0] || null,
        billingStatus: collectiveBurial.billing_status,
        billingAmount: collectiveBurial.billing_amount,
        notes: collectiveBurial.notes,
        buriedPersons: collectiveBurial.contractPlot.buriedPersons.map((bp) => ({
          id: bp.id,
          name: bp.name,
          nameKana: bp.name_kana,
          relationship: bp.relationship,
          deathDate: bp.death_date?.toISOString().split('T')[0] || null,
          age: bp.age,
          gender: bp.gender,
          burialDate: bp.burial_date?.toISOString().split('T')[0] || null,
          notes: bp.notes,
        })),
        createdAt: collectiveBurial.created_at.toISOString(),
        updatedAt: collectiveBurial.updated_at.toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 合祀情報作成
 */
export const createCollectiveBurial = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { contractPlotId, burialCapacity, validityPeriodYears, billingAmount, notes } = req.body;

    // バリデーション
    if (!contractPlotId) {
      throw new ValidationError('契約区画IDは必須です');
    }
    if (!burialCapacity || burialCapacity < 1) {
      throw new ValidationError('埋葬上限人数は1以上の整数で指定してください');
    }
    if (!validityPeriodYears || validityPeriodYears < 1) {
      throw new ValidationError('有効期間（年）は1以上の整数で指定してください');
    }

    // 契約区画の存在確認
    const contractPlot = await prisma.contractPlot.findFirst({
      where: { id: contractPlotId, deleted_at: null },
      include: {
        collectiveBurial: true,
      },
    });

    if (!contractPlot) {
      throw new NotFoundError('契約区画が見つかりません');
    }

    // 既存の合祀情報がないか確認
    if (contractPlot.collectiveBurial) {
      throw new ValidationError('この契約区画には既に合祀情報が登録されています');
    }

    // 合祀情報作成
    const collectiveBurial = await prisma.collectiveBurial.create({
      data: {
        contract_plot_id: contractPlotId,
        burial_capacity: burialCapacity,
        current_burial_count: 0,
        validity_period_years: validityPeriodYears,
        billing_status: 'pending',
        billing_amount: billingAmount || null,
        notes: notes || null,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        id: collectiveBurial.id,
        contractPlotId: collectiveBurial.contract_plot_id,
        burialCapacity: collectiveBurial.burial_capacity,
        currentBurialCount: collectiveBurial.current_burial_count,
        validityPeriodYears: collectiveBurial.validity_period_years,
        billingStatus: collectiveBurial.billing_status,
        billingAmount: collectiveBurial.billing_amount,
        notes: collectiveBurial.notes,
        createdAt: collectiveBurial.created_at.toISOString(),
        updatedAt: collectiveBurial.updated_at.toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 合祀情報更新
 */
export const updateCollectiveBurial = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      burialCapacity,
      validityPeriodYears,
      capacityReachedDate,
      billingScheduledDate,
      billingStatus,
      billingAmount,
      notes,
    } = req.body;

    // 存在確認
    const existing = await prisma.collectiveBurial.findFirst({
      where: { id, deleted_at: null },
    });

    if (!existing) {
      throw new NotFoundError('合祀情報が見つかりません');
    }

    // バリデーション
    if (burialCapacity !== undefined && burialCapacity < 1) {
      throw new ValidationError('埋葬上限人数は1以上の整数で指定してください');
    }
    if (validityPeriodYears !== undefined && validityPeriodYears < 1) {
      throw new ValidationError('有効期間（年）は1以上の整数で指定してください');
    }
    if (billingStatus && !['pending', 'billed', 'paid'].includes(billingStatus)) {
      throw new ValidationError('無効な請求ステータスです');
    }

    // 更新データの構築
    const updateData: Record<string, unknown> = {};
    if (burialCapacity !== undefined) updateData['burial_capacity'] = burialCapacity;
    if (validityPeriodYears !== undefined)
      updateData['validity_period_years'] = validityPeriodYears;
    if (capacityReachedDate !== undefined) {
      updateData['capacity_reached_date'] = capacityReachedDate
        ? new Date(capacityReachedDate)
        : null;
    }
    if (billingScheduledDate !== undefined) {
      updateData['billing_scheduled_date'] = billingScheduledDate
        ? new Date(billingScheduledDate)
        : null;
    }
    if (billingStatus !== undefined) updateData['billing_status'] = billingStatus;
    if (billingAmount !== undefined) updateData['billing_amount'] = billingAmount;
    if (notes !== undefined) updateData['notes'] = notes;

    // 更新実行
    const updated = await prisma.collectiveBurial.update({
      where: { id },
      data: updateData,
      include: {
        contractPlot: {
          include: {
            physicalPlot: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      data: {
        id: updated.id,
        contractPlotId: updated.contract_plot_id,
        plotNumber: updated.contractPlot.physicalPlot.plot_number,
        burialCapacity: updated.burial_capacity,
        currentBurialCount: updated.current_burial_count,
        capacityReachedDate: updated.capacity_reached_date?.toISOString().split('T')[0] || null,
        validityPeriodYears: updated.validity_period_years,
        billingScheduledDate: updated.billing_scheduled_date?.toISOString().split('T')[0] || null,
        billingStatus: updated.billing_status,
        billingAmount: updated.billing_amount,
        notes: updated.notes,
        createdAt: updated.created_at.toISOString(),
        updatedAt: updated.updated_at.toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 請求ステータス更新
 */
export const updateBillingStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { billingStatus, billingAmount } = req.body;

    // バリデーション
    if (!billingStatus || !['pending', 'billed', 'paid'].includes(billingStatus)) {
      throw new ValidationError('有効な請求ステータス（pending, billed, paid）を指定してください');
    }

    // 存在確認
    const existing = await prisma.collectiveBurial.findFirst({
      where: { id, deleted_at: null },
    });

    if (!existing) {
      throw new NotFoundError('合祀情報が見つかりません');
    }

    // 更新
    const updated = await prisma.collectiveBurial.update({
      where: { id },
      data: {
        billing_status: billingStatus,
        ...(billingAmount !== undefined && { billing_amount: billingAmount }),
      },
    });

    res.status(200).json({
      success: true,
      data: {
        id: updated.id,
        billingStatus: updated.billing_status,
        billingAmount: updated.billing_amount,
        updatedAt: updated.updated_at.toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 合祀情報削除（論理削除）
 */
export const deleteCollectiveBurial = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    // 存在確認
    const existing = await prisma.collectiveBurial.findFirst({
      where: { id, deleted_at: null },
    });

    if (!existing) {
      throw new NotFoundError('合祀情報が見つかりません');
    }

    // 論理削除
    await prisma.collectiveBurial.update({
      where: { id },
      data: { deleted_at: new Date() },
    });

    res.status(200).json({
      success: true,
      data: {
        message: '合祀情報を削除しました',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 埋葬人数同期（BuriedPersonsから自動集計）
 */
export const syncBurialCount = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    // 合祀情報取得
    const collectiveBurial = await prisma.collectiveBurial.findFirst({
      where: { id, deleted_at: null },
      include: {
        contractPlot: {
          include: {
            buriedPersons: {
              where: { deleted_at: null },
            },
          },
        },
      },
    });

    if (!collectiveBurial) {
      throw new NotFoundError('合祀情報が見つかりません');
    }

    const newCount = collectiveBurial.contractPlot.buriedPersons.length;
    const capacityReached = newCount >= collectiveBurial.burial_capacity;

    // 更新データ
    const updateData: Record<string, unknown> = {
      current_burial_count: newCount,
    };

    // 上限到達時の処理
    if (capacityReached && !collectiveBurial.capacity_reached_date) {
      const now = new Date();
      updateData['capacity_reached_date'] = now;
      // 請求予定日を計算（上限到達日 + 有効期間）
      const billingDate = new Date(now);
      billingDate.setFullYear(billingDate.getFullYear() + collectiveBurial.validity_period_years);
      updateData['billing_scheduled_date'] = billingDate;
    }

    // 更新
    const updated = await prisma.collectiveBurial.update({
      where: { id },
      data: updateData,
    });

    res.status(200).json({
      success: true,
      data: {
        id: updated.id,
        currentBurialCount: updated.current_burial_count,
        burialCapacity: updated.burial_capacity,
        capacityReached,
        capacityReachedDate: updated.capacity_reached_date?.toISOString().split('T')[0] || null,
        billingScheduledDate: updated.billing_scheduled_date?.toISOString().split('T')[0] || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 年別統計取得
 */
export const getStatsByYear = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 請求予定年ごとの集計
    const stats = await prisma.$queryRaw<
      Array<{
        year: number;
        count: bigint;
        pending_count: bigint;
        billed_count: bigint;
        paid_count: bigint;
      }>
    >`
      SELECT
        EXTRACT(YEAR FROM billing_scheduled_date)::integer as year,
        COUNT(*)::bigint as count,
        COUNT(CASE WHEN billing_status = 'pending' THEN 1 END)::bigint as pending_count,
        COUNT(CASE WHEN billing_status = 'billed' THEN 1 END)::bigint as billed_count,
        COUNT(CASE WHEN billing_status = 'paid' THEN 1 END)::bigint as paid_count
      FROM collective_burials
      WHERE deleted_at IS NULL
        AND billing_scheduled_date IS NOT NULL
      GROUP BY EXTRACT(YEAR FROM billing_scheduled_date)
      ORDER BY year
    `;

    res.status(200).json({
      success: true,
      data: stats.map((s) => ({
        year: s.year,
        count: Number(s.count),
        pendingCount: Number(s.pending_count),
        billedCount: Number(s.billed_count),
        paidCount: Number(s.paid_count),
      })),
    });
  } catch (error) {
    next(error);
  }
};
