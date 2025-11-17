import { z } from 'zod';
import {
  uuidSchema,
  dateSchema,
  emailSchema,
  phoneSchema,
  paginationSchema,
  katakanaSchema,
  yearMonthSchema,
  areaSchema,
} from '../middleware/validation';

/**
 * Plot検索クエリのバリデーションスキーマ
 */
export const plotSearchQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  usageStatus: z.string().optional(),
  cemeteryType: z.string().optional(),
});

/**
 * Plot IDパラメータのバリデーションスキーマ
 */
export const plotIdParamsSchema = z.object({
  id: uuidSchema,
});

/**
 * 申込者情報のバリデーションスキーマ
 */
const applicantSchema = z
  .object({
    name: z
      .string()
      .min(1, '申込者名は必須です')
      .max(100, '申込者名は100文字以内で入力してください'),
    nameKana: katakanaSchema('申込者名（カナ）').max(
      100,
      '申込者名（カナ）は100文字以内で入力してください'
    ),
    birthDate: dateSchema.optional().or(z.literal('')),
    gender: z.enum(['male', 'female', 'other']).optional().or(z.literal('')),
    phoneNumber: phoneSchema,
    faxNumber: phoneSchema,
    email: emailSchema.optional().or(z.literal('')),
    address: z
      .string()
      .max(200, '住所は200文字以内で入力してください')
      .optional()
      .or(z.literal('')),
    registeredAddress: z
      .string()
      .max(200, '登録住所は200文字以内で入力してください')
      .optional()
      .or(z.literal('')),
  })
  .optional();

/**
 * 契約者情報のバリデーションスキーマ
 */
const contractorSchema = z
  .object({
    name: z
      .string()
      .min(1, '契約者名は必須です')
      .max(100, '契約者名は100文字以内で入力してください'),
    nameKana: katakanaSchema('契約者名（カナ）').max(
      100,
      '契約者名（カナ）は100文字以内で入力してください'
    ),
    birthDate: dateSchema.optional().or(z.literal('')),
    gender: z.enum(['male', 'female', 'other']).optional().or(z.literal('')),
    phoneNumber: phoneSchema,
    faxNumber: phoneSchema,
    email: emailSchema.optional().or(z.literal('')),
    address: z
      .string()
      .max(200, '住所は200文字以内で入力してください')
      .optional()
      .or(z.literal('')),
    registeredAddress: z
      .string()
      .max(200, '登録住所は200文字以内で入力してください')
      .optional()
      .or(z.literal('')),
  })
  .optional();

/**
 * 使用料情報のバリデーションスキーマ
 */
const usageFeeSchema = z
  .object({
    calculationType: z.string().max(50).optional().or(z.literal('')),
    taxType: z.string().max(50).optional().or(z.literal('')),
    billingType: z.string().max(50).optional().or(z.literal('')),
    billingYears: z.string().max(50).optional().or(z.literal('')),
    area: z.string().max(50).optional().or(z.literal('')),
    unitPrice: z.string().max(50).optional().or(z.literal('')),
    usageFee: z.string().max(50).optional().or(z.literal('')),
    paymentMethod: z.string().max(50).optional().or(z.literal('')),
  })
  .optional();

/**
 * 管理料情報のバリデーションスキーマ
 */
const managementFeeSchema = z
  .object({
    calculationType: z.string().max(50).optional().or(z.literal('')),
    taxType: z.string().max(50).optional().or(z.literal('')),
    billingType: z.string().max(50).optional().or(z.literal('')),
    billingYears: z.string().max(50).optional().or(z.literal('')),
    area: z.string().max(50).optional().or(z.literal('')),
    billingMonth: z.string().max(50).optional().or(z.literal('')),
    managementFee: z.string().max(50).optional().or(z.literal('')),
    unitPrice: z.string().max(50).optional().or(z.literal('')),
    lastBillingMonth: yearMonthSchema,
    paymentMethod: z.string().max(50).optional().or(z.literal('')),
  })
  .optional();

/**
 * 請求情報のバリデーションスキーマ
 */
const billingInfoSchema = z
  .object({
    id: uuidSchema.optional(),
    _delete: z.boolean().optional(),
    accountType: z.string().max(50).optional().or(z.literal('')),
    bankName: z.string().max(100).optional().or(z.literal('')),
    branchName: z.string().max(100).optional().or(z.literal('')),
    accountNumber: z.string().max(20).optional().or(z.literal('')),
    accountHolder: z.string().max(100).optional().or(z.literal('')),
    recipientType: z.string().max(50).optional().or(z.literal('')),
    recipientName: z.string().max(100).optional().or(z.literal('')),
  })
  .optional();

/**
 * 家族連絡先のバリデーションスキーマ
 */
const familyContactSchema = z.object({
  id: uuidSchema.optional(),
  _delete: z.boolean().optional(),
  name: z.string().max(100).optional().or(z.literal('')),
  birthDate: dateSchema.optional().or(z.literal('')),
  relationship: z.string().max(50).optional().or(z.literal('')),
  address: z.string().max(200).optional().or(z.literal('')),
  phoneNumber: phoneSchema,
  faxNumber: phoneSchema,
  email: emailSchema.optional().or(z.literal('')),
  registeredAddress: z.string().max(200).optional().or(z.literal('')),
  mailingType: z.string().max(50).optional().or(z.literal('')),
  companyName: z.string().max(100).optional().or(z.literal('')),
  companyNameKana: z.string().max(100).optional().or(z.literal('')),
  companyAddress: z.string().max(200).optional().or(z.literal('')),
  companyPhone: phoneSchema,
  notes: z.string().max(500).optional().or(z.literal('')),
});

/**
 * 緊急連絡先のバリデーションスキーマ
 */
const emergencyContactSchema = z
  .object({
    name: z.string().max(100).optional().or(z.literal('')),
    relationship: z.string().max(50).optional().or(z.literal('')),
    phoneNumber: phoneSchema,
  })
  .optional();

/**
 * 埋葬者情報のバリデーションスキーマ
 */
const buriedPersonSchema = z.object({
  id: uuidSchema.optional(),
  _delete: z.boolean().optional(),
  name: z.string().max(100).optional().or(z.literal('')),
  nameKana: z.string().max(100).optional().or(z.literal('')),
  relationship: z.string().max(50).optional().or(z.literal('')),
  deathDate: dateSchema.optional().or(z.literal('')),
  age: z.number().int().nonnegative().optional().or(z.literal(null)),
  gender: z.enum(['male', 'female', 'other']).optional().or(z.literal('')),
  burialDate: dateSchema.optional().or(z.literal('')),
  graveNumber: z.string().max(50).optional().or(z.literal('')),
  notes: z.string().max(500).optional().or(z.literal('')),
});

/**
 * 墓石情報のバリデーションスキーマ
 */
const gravestoneInfoSchema = z
  .object({
    gravestoneBase: z.string().max(100).optional().or(z.literal('')),
    enclosurePosition: z.string().max(100).optional().or(z.literal('')),
    gravestoneDealer: z.string().max(100).optional().or(z.literal('')),
    gravestoneType: z.string().max(100).optional().or(z.literal('')),
    surroundingArea: z.string().max(100).optional().or(z.literal('')),
    establishmentDeadline: dateSchema.optional().or(z.literal('')),
    establishmentDate: dateSchema.optional().or(z.literal('')),
  })
  .optional();

/**
 * 工事情報のバリデーションスキーマ
 */
const constructionInfoSchema = z
  .object({
    constructionType: z.string().max(100).optional().or(z.literal('')),
    startDate: dateSchema.optional().or(z.literal('')),
    completionDate: dateSchema.optional().or(z.literal('')),
    contractor: z.string().max(100).optional().or(z.literal('')),
    supervisor: z.string().max(100).optional().or(z.literal('')),
    progress: z.string().max(100).optional().or(z.literal('')),
    workItem1: z.string().max(100).optional().or(z.literal('')),
    workDate1: dateSchema.optional().or(z.literal('')),
    workAmount1: z.number().nonnegative().optional().or(z.literal(null)),
    workStatus1: z.string().max(50).optional().or(z.literal('')),
    workItem2: z.string().max(100).optional().or(z.literal('')),
    workDate2: dateSchema.optional().or(z.literal('')),
    workAmount2: z.number().nonnegative().optional().or(z.literal(null)),
    workStatus2: z.string().max(50).optional().or(z.literal('')),
    permitNumber: z.string().max(50).optional().or(z.literal('')),
    applicationDate: dateSchema.optional().or(z.literal('')),
    permitDate: dateSchema.optional().or(z.literal('')),
    permitStatus: z.string().max(50).optional().or(z.literal('')),
    paymentType1: z.string().max(50).optional().or(z.literal('')),
    paymentAmount1: z.number().nonnegative().optional().or(z.literal(null)),
    paymentDate1: dateSchema.optional().or(z.literal('')),
    paymentStatus1: z.string().max(50).optional().or(z.literal('')),
    paymentType2: z.string().max(50).optional().or(z.literal('')),
    paymentAmount2: z.number().nonnegative().optional().or(z.literal(null)),
    paymentScheduledDate2: dateSchema.optional().or(z.literal('')),
    paymentStatus2: z.string().max(50).optional().or(z.literal('')),
    constructionNotes: z.string().max(500).optional().or(z.literal('')),
  })
  .optional();

/**
 * Plot作成リクエストのバリデーションスキーマ
 */
export const createPlotSchema = z.object({
  gravestoneCode: z
    .string()
    .min(1, '墓石番号は必須です')
    .max(50, '墓石番号は50文字以内で入力してください')
    .regex(/^[A-Z0-9-]+$/, '墓石番号は大文字英数字とハイフンのみ使用できます'),
  usageStatus: z.string().max(50).optional().or(z.literal('')),
  cemeteryType: z.string().max(50).optional().or(z.literal('')),
  denomination: z.string().max(50).optional().or(z.literal('')),
  contractDate: dateSchema.optional().or(z.literal('')),
  area: areaSchema,
  notes: z.string().max(1000).optional().or(z.literal('')),
  applicant: applicantSchema,
  contractor: contractorSchema,
  usageFee: usageFeeSchema,
  managementFee: managementFeeSchema,
  billingInfo: billingInfoSchema,
  familyContacts: z.array(familyContactSchema).optional(),
  emergencyContact: emergencyContactSchema,
  buriedPersons: z.array(buriedPersonSchema).optional(),
  gravestoneInfo: gravestoneInfoSchema,
  constructionInfo: constructionInfoSchema,
});

/**
 * Plot更新リクエストのバリデーションスキーマ
 * 作成時と同じだが、すべてのフィールドがオプション
 */
export const updatePlotSchema = z.object({
  gravestoneCode: z
    .string()
    .max(50, '墓石番号は50文字以内で入力してください')
    .regex(/^[A-Z0-9-]+$/, '墓石番号は大文字英数字とハイフンのみ使用できます')
    .optional(),
  usageStatus: z.string().max(50).optional().or(z.literal('')),
  cemeteryType: z.string().max(50).optional().or(z.literal('')),
  denomination: z.string().max(50).optional().or(z.literal('')),
  contractDate: dateSchema.optional().or(z.literal('')),
  area: areaSchema,
  notes: z.string().max(1000).optional().or(z.literal('')),
  applicant: applicantSchema,
  contractor: contractorSchema,
  usageFee: usageFeeSchema,
  managementFee: managementFeeSchema,
  billingInfo: billingInfoSchema,
  familyContacts: z.array(familyContactSchema).optional(),
  emergencyContact: emergencyContactSchema,
  buriedPersons: z.array(buriedPersonSchema).optional(),
  gravestoneInfo: gravestoneInfoSchema,
  constructionInfo: constructionInfoSchema,
});

/**
 * 型エクスポート
 */
export type PlotSearchQuery = z.infer<typeof plotSearchQuerySchema>;
export type PlotIdParams = z.infer<typeof plotIdParamsSchema>;
export type CreatePlotRequest = z.infer<typeof createPlotSchema>;
export type UpdatePlotRequest = z.infer<typeof updatePlotSchema>;
