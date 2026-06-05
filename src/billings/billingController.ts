import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import type { BillingSummaryResponse } from '@komine/types';
import prisma from '../db/prisma';
import { NotFoundError, ValidationError } from '../middleware/errorHandler';
import { recalculateContractPlotPaymentStatus } from '../plots/services/paymentStatusService';
import {
  createBillingSchema,
  updateBillingSchema,
  listBillingsQuerySchema,
  billingSummaryQuerySchema,
} from '../validations/billingValidation';

type BillingWithRelations = Prisma.BillingGetPayload<{
  include: {
    customer: { select: { id: true; name: true; name_kana: true } };
    contractPlot: {
      select: {
        id: true;
        physicalPlot: { select: { id: true; plot_number: true; area_name: true } };
      };
    };
  };
}>;

const toDateOrNull = (s?: string | null): Date | null => (s ? new Date(`${s}T00:00:00Z`) : null);

const formatBilling = (b: BillingWithRelations) => ({
  id: b.id,
  contractPlotId: b.contract_plot_id,
  customerId: b.customer_id,
  category: b.category,
  amount: b.amount,
  useStartYear: b.use_start_year,
  useEndYear: b.use_end_year,
  targetMonth: b.target_month,
  billingYears: b.billing_years,
  contractDate: b.contract_date?.toISOString().split('T')[0] ?? null,
  billingDate: b.billing_date?.toISOString().split('T')[0] ?? null,
  paidAmount: b.paid_amount,
  lastPaymentDate: b.last_payment_date?.toISOString().split('T')[0] ?? null,
  terminated: b.terminated,
  terminatedDate: b.terminated_date?.toISOString().split('T')[0] ?? null,
  status: b.status,
  applicationType: b.application_type,
  billingType: b.billing_type,
  notes: b.notes,
  legacySeikyuCd: b.legacy_seikyu_cd,
  customer: b.customer
    ? { id: b.customer.id, name: b.customer.name, nameKana: b.customer.name_kana }
    : null,
  plotNumber: b.contractPlot?.physicalPlot.plot_number ?? null,
  areaName: b.contractPlot?.physicalPlot.area_name ?? null,
  createdAt: b.created_at.toISOString(),
  updatedAt: b.updated_at.toISOString(),
});

const includeRelations = {
  customer: { select: { id: true, name: true, name_kana: true } },
  contractPlot: {
    select: {
      id: true,
      physicalPlot: { select: { id: true, plot_number: true, area_name: true } },
    },
  },
} satisfies Prisma.BillingInclude;

/**
 * 請求一覧取得
 */
export const getBillings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsed = listBillingsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid query');
    }
    const q = parsed.data;
    const skip = (q.page - 1) * q.limit;

    const where: Prisma.BillingWhereInput = { deleted_at: null };
    if (q.contractPlotId) where.contract_plot_id = q.contractPlotId;
    if (q.customerId) where.customer_id = q.customerId;
    if (q.category) where.category = q.category;
    if (q.status) where.status = q.status;
    if (q.billingDateFrom || q.billingDateTo) {
      where.billing_date = {
        ...(q.billingDateFrom && { gte: new Date(`${q.billingDateFrom}T00:00:00Z`) }),
        ...(q.billingDateTo && { lte: new Date(`${q.billingDateTo}T23:59:59Z`) }),
      };
    }

    const [items, totalCount] = await Promise.all([
      prisma.billing.findMany({
        where,
        skip,
        take: q.limit,
        orderBy: { [q.sortBy]: q.sortOrder },
        include: includeRelations,
      }),
      prisma.billing.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        items: items.map(formatBilling),
        pagination: {
          page: q.page,
          limit: q.limit,
          totalCount,
          totalPages: Math.ceil(totalCount / q.limit),
        },
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      next(new ValidationError(error.issues[0]?.message ?? 'Invalid query'));
      return;
    }
    next(error);
  }
};

/**
 * 請求サマリー集計取得
 *
 * フィルタ一致の「全件」を集計する（GET /billings/summary）。
 * 一覧はページネーションされるため、画面上部の請求総額/入金済/未入金/
 * 延滞件数 StatCard をページ分の reduce で出すと誤読される
 * （frontend #225）。サーバ側で aggregate して返す。
 */
export const getBillingsSummary = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsed = billingSummaryQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid query');
    }
    const q = parsed.data;

    const where: Prisma.BillingWhereInput = { deleted_at: null };
    if (q.contractPlotId) where.contract_plot_id = q.contractPlotId;
    if (q.customerId) where.customer_id = q.customerId;
    if (q.category) where.category = q.category;
    if (q.status) where.status = q.status;
    if (q.billingDateFrom || q.billingDateTo) {
      where.billing_date = {
        ...(q.billingDateFrom && { gte: new Date(`${q.billingDateFrom}T00:00:00Z`) }),
        ...(q.billingDateTo && { lte: new Date(`${q.billingDateTo}T23:59:59Z`) }),
      };
    }

    const [sums, totalCount, overdueCount] = await Promise.all([
      prisma.billing.aggregate({
        where,
        _sum: { amount: true, paid_amount: true },
      }),
      prisma.billing.count({ where }),
      prisma.billing.count({ where: { ...where, status: 'overdue' } }),
    ]);

    const totalAmount = sums._sum.amount ?? 0;
    const paidAmount = sums._sum.paid_amount ?? 0;
    const data: BillingSummaryResponse = {
      totalAmount,
      paidAmount,
      unpaidAmount: totalAmount - paidAmount,
      overdueCount,
      totalCount,
    };

    res.status(200).json({ success: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      next(new ValidationError(error.issues[0]?.message ?? 'Invalid query'));
      return;
    }
    next(error);
  }
};

/**
 * 請求詳細取得（紐付く入金一覧を含む）
 */
export const getBillingById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params as Record<string, string>;
    const billing = await prisma.billing.findFirst({
      where: { id, deleted_at: null },
      include: {
        ...includeRelations,
        payments: {
          where: { deleted_at: null },
          orderBy: { payment_date: 'desc' },
        },
      },
    });
    if (!billing) throw new NotFoundError('請求が見つかりません');

    res.status(200).json({
      success: true,
      data: {
        ...formatBilling(billing),
        payments: billing.payments.map((p) => ({
          id: p.id,
          paymentDate: p.payment_date?.toISOString().split('T')[0] ?? null,
          scheduledDate: p.scheduled_date?.toISOString().split('T')[0] ?? null,
          paymentAmount: p.payment_amount,
          scheduledAmount: p.scheduled_amount,
          feeType: p.fee_type,
          staffInCharge: p.staff_in_charge,
          notes: p.notes,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 請求作成
 */
export const createBilling = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsed = createBillingSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid body');
    }
    const input = parsed.data;

    // 紐付け先の存在チェック
    const [contractPlot, customer] = await Promise.all([
      prisma.contractPlot.findFirst({
        where: { id: input.contractPlotId, deleted_at: null },
        select: { id: true },
      }),
      prisma.customer.findFirst({
        where: { id: input.customerId, deleted_at: null },
        select: { id: true },
      }),
    ]);
    if (!contractPlot) throw new NotFoundError('指定の契約区画が見つかりません');
    if (!customer) throw new NotFoundError('指定の顧客が見つかりません');

    const created = await prisma.$transaction(async (tx) => {
      const billing = await tx.billing.create({
        data: {
          contract_plot_id: input.contractPlotId,
          customer_id: input.customerId,
          category: input.category,
          amount: input.amount,
          use_start_year: input.useStartYear ?? null,
          use_end_year: input.useEndYear ?? null,
          target_month: input.targetMonth ?? null,
          billing_years: input.billingYears ?? null,
          contract_date: toDateOrNull(input.contractDate),
          billing_date: toDateOrNull(input.billingDate),
          application_type: input.applicationType ?? null,
          billing_type: input.billingType ?? null,
          status: input.status ?? 'pending',
          notes: input.notes ?? null,
        },
        include: includeRelations,
      });
      // 請求額が増えたので ContractPlot の payment_status を再計算（#162）
      await recalculateContractPlotPaymentStatus(tx, input.contractPlotId);
      return billing;
    });

    res.status(201).json({ success: true, data: formatBilling(created) });
  } catch (error) {
    if (error instanceof ZodError) {
      next(new ValidationError(error.issues[0]?.message ?? 'Invalid body'));
      return;
    }
    next(error);
  }
};

/**
 * 請求更新（部分更新）
 */
export const updateBilling = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params as Record<string, string>;
    const parsed = updateBillingSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid body');
    }
    const input = parsed.data;

    const existing = await prisma.billing.findFirst({ where: { id, deleted_at: null } });
    if (!existing) throw new NotFoundError('請求が見つかりません');

    const data: Prisma.BillingUpdateInput = {};
    if (input.category !== undefined) data.category = input.category;
    if (input.amount !== undefined) data.amount = input.amount;
    if (input.useStartYear !== undefined) data.use_start_year = input.useStartYear;
    if (input.useEndYear !== undefined) data.use_end_year = input.useEndYear;
    if (input.targetMonth !== undefined) data.target_month = input.targetMonth;
    if (input.billingYears !== undefined) data.billing_years = input.billingYears;
    if (input.contractDate !== undefined) data.contract_date = toDateOrNull(input.contractDate);
    if (input.billingDate !== undefined) data.billing_date = toDateOrNull(input.billingDate);
    if (input.applicationType !== undefined) data.application_type = input.applicationType;
    if (input.billingType !== undefined) data.billing_type = input.billingType;
    if (input.status !== undefined) data.status = input.status;
    if (input.terminated !== undefined) data.terminated = input.terminated;
    if (input.terminatedDate !== undefined)
      data.terminated_date = toDateOrNull(input.terminatedDate);
    if (input.notes !== undefined) data.notes = input.notes;

    const updated = await prisma.$transaction(async (tx) => {
      const billing = await tx.billing.update({
        where: { id },
        data,
        include: includeRelations,
      });
      // 請求額・解約フラグの変更が入金状況に影響しうるので再計算（#162）
      await recalculateContractPlotPaymentStatus(tx, existing.contract_plot_id);
      return billing;
    });

    res.status(200).json({ success: true, data: formatBilling(updated) });
  } catch (error) {
    if (error instanceof ZodError) {
      next(new ValidationError(error.issues[0]?.message ?? 'Invalid body'));
      return;
    }
    next(error);
  }
};

/**
 * 請求削除（論理削除）
 *
 * 紐付く Payment は billing_id を null にして孤児化する（onDelete: SetNull）。
 * 物理削除ではなく soft delete のみ実装するので、Prisma の onDelete は発火しない。
 * → 紐付く Payment の billing_id は明示的に null 化する。
 */
export const deleteBilling = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params as Record<string, string>;
    const existing = await prisma.billing.findFirst({ where: { id, deleted_at: null } });
    if (!existing) throw new NotFoundError('請求が見つかりません');

    await prisma.$transaction(async (tx) => {
      await tx.payment.updateMany({
        where: { billing_id: id, deleted_at: null },
        data: { billing_id: null },
      });
      await tx.billing.update({
        where: { id },
        data: { deleted_at: new Date() },
      });
      // 請求が消えたので ContractPlot の payment_status を再計算（#162）
      await recalculateContractPlotPaymentStatus(tx, existing.contract_plot_id);
    });

    res.status(200).json({ success: true, data: { message: '請求を削除しました' } });
  } catch (error) {
    next(error);
  }
};
