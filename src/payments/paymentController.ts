import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import prisma from '../db/prisma';
import { NotFoundError, ValidationError } from '../middleware/errorHandler';
import {
  createPaymentSchema,
  updatePaymentSchema,
  listPaymentsQuerySchema,
} from '../validations/paymentValidation';
import { recalculateBillingPayments } from '../billings/billingService';

type PaymentWithRelations = Prisma.PaymentGetPayload<{
  include: {
    billing: {
      select: {
        id: true;
        category: true;
        amount: true;
        billing_date: true;
        status: true;
      };
    };
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

const formatPayment = (p: PaymentWithRelations) => ({
  id: p.id,
  billingId: p.billing_id,
  customerId: p.customer_id,
  contractPlotId: p.contract_plot_id,
  scheduledDate: p.scheduled_date?.toISOString().split('T')[0] ?? null,
  scheduledAmount: p.scheduled_amount,
  paymentDate: p.payment_date?.toISOString().split('T')[0] ?? null,
  paymentAmount: p.payment_amount,
  feeType: p.fee_type,
  applicationType: p.application_type,
  billingType: p.billing_type,
  staffInCharge: p.staff_in_charge,
  notes: p.notes,
  legacyNyukinCd: p.legacy_nyukin_cd,
  billing: p.billing
    ? {
        id: p.billing.id,
        category: p.billing.category,
        amount: p.billing.amount,
        billingDate: p.billing.billing_date?.toISOString().split('T')[0] ?? null,
        status: p.billing.status,
      }
    : null,
  customer: p.customer
    ? { id: p.customer.id, name: p.customer.name, nameKana: p.customer.name_kana }
    : null,
  plotNumber: p.contractPlot?.physicalPlot.plot_number ?? null,
  areaName: p.contractPlot?.physicalPlot.area_name ?? null,
  createdAt: p.created_at.toISOString(),
  updatedAt: p.updated_at.toISOString(),
});

const includeRelations = {
  billing: {
    select: {
      id: true,
      category: true,
      amount: true,
      billing_date: true,
      status: true,
    },
  },
  customer: { select: { id: true, name: true, name_kana: true } },
  contractPlot: {
    select: {
      id: true,
      physicalPlot: { select: { id: true, plot_number: true, area_name: true } },
    },
  },
} satisfies Prisma.PaymentInclude;

/**
 * 入金一覧取得
 */
export const getPayments = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsed = listPaymentsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid query');
    }
    const q = parsed.data;
    const skip = (q.page - 1) * q.limit;

    const where: Prisma.PaymentWhereInput = { deleted_at: null };
    if (q.billingId) where.billing_id = q.billingId;
    if (q.customerId) where.customer_id = q.customerId;
    if (q.contractPlotId) where.contract_plot_id = q.contractPlotId;
    if (q.orphan === true) where.billing_id = null;
    if (q.orphan === false) where.billing_id = { not: null };
    if (q.paymentDateFrom || q.paymentDateTo) {
      where.payment_date = {
        ...(q.paymentDateFrom && { gte: new Date(`${q.paymentDateFrom}T00:00:00Z`) }),
        ...(q.paymentDateTo && { lte: new Date(`${q.paymentDateTo}T23:59:59Z`) }),
      };
    }

    const [items, totalCount] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip,
        take: q.limit,
        orderBy: { [q.sortBy]: q.sortOrder },
        include: includeRelations,
      }),
      prisma.payment.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        items: items.map(formatPayment),
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
 * 入金詳細取得
 */
export const getPaymentById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params as Record<string, string>;
    const payment = await prisma.payment.findFirst({
      where: { id, deleted_at: null },
      include: includeRelations,
    });
    if (!payment) throw new NotFoundError('入金が見つかりません');

    res.status(200).json({ success: true, data: formatPayment(payment) });
  } catch (error) {
    next(error);
  }
};

/**
 * 入金作成
 *
 * billing_id 紐付けがある場合: 紐付け先 Billing を再集計する。
 * 孤児入金（billing_id なし）: customer_id or contract_plot_id のいずれかが必須（schema レベル）。
 */
export const createPayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsed = createPaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid body');
    }
    const input = parsed.data;

    // 紐付け先の存在チェック
    if (input.billingId) {
      const billing = await prisma.billing.findFirst({
        where: { id: input.billingId, deleted_at: null },
        select: { id: true },
      });
      if (!billing) throw new NotFoundError('指定の請求が見つかりません');
    }
    if (input.customerId) {
      const customer = await prisma.customer.findFirst({
        where: { id: input.customerId, deleted_at: null },
        select: { id: true },
      });
      if (!customer) throw new NotFoundError('指定の顧客が見つかりません');
    }
    if (input.contractPlotId) {
      const plot = await prisma.contractPlot.findFirst({
        where: { id: input.contractPlotId, deleted_at: null },
        select: { id: true },
      });
      if (!plot) throw new NotFoundError('指定の契約区画が見つかりません');
    }

    const created = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          billing_id: input.billingId ?? null,
          customer_id: input.customerId ?? null,
          contract_plot_id: input.contractPlotId ?? null,
          scheduled_date: toDateOrNull(input.scheduledDate),
          scheduled_amount: input.scheduledAmount ?? null,
          payment_date: toDateOrNull(input.paymentDate),
          payment_amount: input.paymentAmount,
          fee_type: input.feeType ?? null,
          application_type: input.applicationType ?? null,
          billing_type: input.billingType ?? null,
          staff_in_charge: input.staffInCharge ?? null,
          notes: input.notes ?? null,
        },
        include: includeRelations,
      });
      if (input.billingId) {
        await recalculateBillingPayments(tx, input.billingId);
      }
      return payment;
    });

    res.status(201).json({ success: true, data: formatPayment(created) });
  } catch (error) {
    if (error instanceof ZodError) {
      next(new ValidationError(error.issues[0]?.message ?? 'Invalid body'));
      return;
    }
    next(error);
  }
};

/**
 * 入金更新
 *
 * billing_id を変更した場合は、変更前後両方の Billing を再集計する。
 */
export const updatePayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params as Record<string, string>;
    const parsed = updatePaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid body');
    }
    const input = parsed.data;

    const existing = await prisma.payment.findFirst({ where: { id, deleted_at: null } });
    if (!existing) throw new NotFoundError('入金が見つかりません');

    const data: Prisma.PaymentUpdateInput = {};
    if (input.billingId !== undefined) {
      data.billing = input.billingId ? { connect: { id: input.billingId } } : { disconnect: true };
    }
    if (input.customerId !== undefined) {
      data.customer = input.customerId
        ? { connect: { id: input.customerId } }
        : { disconnect: true };
    }
    if (input.contractPlotId !== undefined) {
      data.contractPlot = input.contractPlotId
        ? { connect: { id: input.contractPlotId } }
        : { disconnect: true };
    }
    if (input.scheduledDate !== undefined) data.scheduled_date = toDateOrNull(input.scheduledDate);
    if (input.scheduledAmount !== undefined) data.scheduled_amount = input.scheduledAmount;
    if (input.paymentDate !== undefined) data.payment_date = toDateOrNull(input.paymentDate);
    if (input.paymentAmount !== undefined) data.payment_amount = input.paymentAmount;
    if (input.feeType !== undefined) data.fee_type = input.feeType;
    if (input.applicationType !== undefined) data.application_type = input.applicationType;
    if (input.billingType !== undefined) data.billing_type = input.billingType;
    if (input.staffInCharge !== undefined) data.staff_in_charge = input.staffInCharge;
    if (input.notes !== undefined) data.notes = input.notes;

    const updated = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.update({ where: { id }, data, include: includeRelations });

      // 影響を受ける Billing 群を再集計（変更前後で異なる場合は両方）
      const affectedBillingIds = new Set<string>();
      if (existing.billing_id) affectedBillingIds.add(existing.billing_id);
      if (payment.billing_id) affectedBillingIds.add(payment.billing_id);
      for (const bId of affectedBillingIds) {
        await recalculateBillingPayments(tx, bId);
      }
      return payment;
    });

    res.status(200).json({ success: true, data: formatPayment(updated) });
  } catch (error) {
    if (error instanceof ZodError) {
      next(new ValidationError(error.issues[0]?.message ?? 'Invalid body'));
      return;
    }
    next(error);
  }
};

/**
 * 入金削除（論理削除）
 *
 * 紐付く Billing を削除後に再集計する。
 */
export const deletePayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params as Record<string, string>;
    const existing = await prisma.payment.findFirst({ where: { id, deleted_at: null } });
    if (!existing) throw new NotFoundError('入金が見つかりません');

    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id },
        data: { deleted_at: new Date() },
      });
      if (existing.billing_id) {
        await recalculateBillingPayments(tx, existing.billing_id);
      }
    });

    res.status(200).json({ success: true, data: { message: '入金を削除しました' } });
  } catch (error) {
    next(error);
  }
};
