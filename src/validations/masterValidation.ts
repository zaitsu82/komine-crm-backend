import { z } from 'zod';

export const createMasterSchema = z.object({
  code: z.string().max(20, 'コードは20文字以内で入力してください').optional(),
  name: z.string().min(1, '名称は必須です').max(50, '名称は50文字以内で入力してください'),
  description: z.string().max(200, '説明は200文字以内で入力してください').nullable().optional(),
  sortOrder: z.number().int().nullable().optional(),
  isActive: z.boolean().optional(),
  taxRate: z.number().min(0).max(100).nullable().optional(),
  period: z.string().min(1).max(20).optional(),
});

export const updateMasterSchema = z.object({
  code: z
    .string()
    .min(1, 'コードは必須です')
    .max(20, 'コードは20文字以内で入力してください')
    .optional(),
  name: z
    .string()
    .min(1, '名称は必須です')
    .max(50, '名称は50文字以内で入力してください')
    .optional(),
  description: z.string().max(200, '説明は200文字以内で入力してください').nullable().optional(),
  sortOrder: z.number().int().nullable().optional(),
  isActive: z.boolean().optional(),
  taxRate: z.number().min(0).max(100).nullable().optional(),
  period: z.string().min(1).max(20).optional(),
});

export type CreateMasterInput = z.infer<typeof createMasterSchema>;
export type UpdateMasterInput = z.infer<typeof updateMasterSchema>;

export const VALID_MASTER_TYPES = [
  'cemetery-type',
  'payment-method',
  'tax-type',
  'calc-type',
  'billing-type',
  'account-type',
  'recipient-type',
  'construction-type',
  'section-name',
] as const;

export type MasterType = (typeof VALID_MASTER_TYPES)[number];

export const isValidMasterType = (type: string): type is MasterType => {
  return VALID_MASTER_TYPES.includes(type as MasterType);
};
