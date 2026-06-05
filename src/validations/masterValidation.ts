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

/**
 * 区画名（section-name）マスタ作成専用スキーマ。
 * schema.prisma 上 section_name_master.period は NOT NULL のため、
 * 共通スキーマ（period 任意）のままだと未指定で Prisma の NOT NULL 違反になり
 * 一律 500 になってしまう。作成時のみ period を必須にして 400 VALIDATION_ERROR を返す。
 */
export const createSectionNameMasterSchema = createMasterSchema.extend({
  period: z.string().min(1, '期は必須です').max(20, '期は20文字以内で入力してください'),
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
export type CreateSectionNameMasterInput = z.infer<typeof createSectionNameMasterSchema>;
export type UpdateMasterInput = z.infer<typeof updateMasterSchema>;

export const VALID_MASTER_TYPES = [
  'cemetery-type',
  'payment-method',
  'tax-type',
  'calc-type',
  'billing-type',
  'recipient-type',
  'construction-type',
  'section-name',
  'relationship',
  'contractor',
  'direction',
  'position',
] as const;

export type MasterType = (typeof VALID_MASTER_TYPES)[number];

export const isValidMasterType = (type: string): type is MasterType => {
  return VALID_MASTER_TYPES.includes(type as MasterType);
};
