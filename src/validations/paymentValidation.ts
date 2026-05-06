import { z } from 'zod';

/**
 * 入金 (Payment) バリデーションスキーマ
 *
 * t_nyukin の移行先である Payment モデルへの CRUD と一覧クエリを検証する。
 * billing_id は nullable（孤児入金 16 件のような請求未紐付けケースに対応）。
 */

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
  .optional()
  .nullable();

// 作成
// 請求紐付けあり: billingId 必須
// 孤児入金: billingId なしで customerId or contractPlotId のいずれか必須
export const createPaymentSchema = z
  .object({
    billingId: z.string().uuid().optional().nullable(),
    customerId: z.string().uuid().optional().nullable(),
    contractPlotId: z.string().uuid().optional().nullable(),
    scheduledDate: dateString,
    scheduledAmount: z.number().int().nonnegative().optional().nullable(),
    paymentDate: dateString,
    paymentAmount: z.number().int().nonnegative(),
    feeType: z.string().max(50).optional().nullable(),
    applicationType: z.number().int().optional().nullable(),
    billingType: z.number().int().optional().nullable(),
    staffInCharge: z.string().max(100).optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
  })
  .refine((v) => v.billingId || v.customerId || v.contractPlotId, {
    message: 'billingId, customerId, contractPlotId のいずれかは必須です',
    path: ['billingId'],
  });

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

// 更新（部分更新可）
export const updatePaymentSchema = z.object({
  billingId: z.string().uuid().optional().nullable(),
  customerId: z.string().uuid().optional().nullable(),
  contractPlotId: z.string().uuid().optional().nullable(),
  scheduledDate: dateString,
  scheduledAmount: z.number().int().nonnegative().optional().nullable(),
  paymentDate: dateString,
  paymentAmount: z.number().int().nonnegative().optional(),
  feeType: z.string().max(50).optional().nullable(),
  applicationType: z.number().int().optional().nullable(),
  billingType: z.number().int().optional().nullable(),
  staffInCharge: z.string().max(100).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>;

// 一覧クエリ
export const listPaymentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  billingId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  contractPlotId: z.string().uuid().optional(),
  paymentDateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  paymentDateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  orphan: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  sortBy: z
    .enum(['payment_date', 'scheduled_date', 'payment_amount', 'created_at'])
    .optional()
    .default('payment_date'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type ListPaymentsQuery = z.infer<typeof listPaymentsQuerySchema>;
