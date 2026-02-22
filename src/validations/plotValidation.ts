import { z } from 'zod';
import {
  uuidSchema,
  dateSchema,
  emailSchema,
  phoneSchema,
  requiredPhoneSchema,
  paginationSchema,
  katakanaSchema,
  yearMonthSchema,
} from '../middleware/validation';

/**
 * Plot検索クエリのバリデーションスキーマ
 */
export const plotSearchQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  status: z.enum(['available', 'partially_sold', 'sold_out']).optional(), // PhysicalPlotStatus ENUM
  cemeteryType: z.string().optional(),
  paymentStatus: z
    .enum(['unpaid', 'partial_paid', 'paid', 'overdue', 'refunded', 'cancelled'])
    .optional(),
  sortBy: z
    .enum([
      'plotNumber',
      'customerName',
      'contractDate',
      'paymentStatus',
      'managementFee',
      'createdAt',
    ])
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  nameKanaPrefix: z.string().max(5).optional(),
});

/**
 * Plot IDパラメータのバリデーションスキーマ
 */
export const plotIdParamsSchema = z.object({
  id: uuidSchema,
});

/**
 * 物理区画情報のバリデーションスキーマ
 */
const physicalPlotSchema = z.object({
  id: uuidSchema.optional(),
  plotNumber: z
    .string()
    .max(50, '区画番号は50文字以内で入力してください')
    .regex(/^[A-Z0-9-]+$/, '区画番号は大文字英数字とハイフンのみ使用できます')
    .optional(),
  areaName: z.string().max(100, '区域名は100文字以内で入力してください').optional(),
  areaSqm: z.number().positive('面積は正の数値で入力してください').optional(),
  notes: z.string().max(1000).optional().or(z.literal('')),
});

/**
 * 家族連絡先のバリデーションスキーマ
 * 将来的に家族連絡先管理エンドポイントで使用予定
 */
export const familyContactSchema = z.object({
  id: uuidSchema.optional(),
  _delete: z.boolean().optional(),
  customerId: uuidSchema.optional(),
  name: z.string().max(100).optional().or(z.literal('')),
  nameKana: z.string().max(100).optional().or(z.literal('')),
  birthDate: dateSchema.optional().or(z.literal('')),
  relationship: z.string().max(50).optional().or(z.literal('')),
  address: z.string().max(200).optional().or(z.literal('')),
  phoneNumber: requiredPhoneSchema,
  phoneNumber2: z.string().max(15).optional().or(z.literal('')),
  faxNumber: phoneSchema,
  email: emailSchema.optional().or(z.literal('')),
  registeredAddress: z.string().max(200).optional().or(z.literal('')),
  mailingType: z.string().max(50).optional().or(z.literal('')),
  workCompanyName: z.string().max(100).optional().or(z.literal('')),
  workCompanyNameKana: z.string().max(100).optional().or(z.literal('')),
  workAddress: z.string().max(200).optional().or(z.literal('')),
  workPhoneNumber: z.string().max(15).optional().or(z.literal('')),
  contactMethod: z.string().max(50).optional().or(z.literal('')),
  useWorkContact: z.boolean().optional(),
  workContactNotes: z.string().max(200).optional().or(z.literal('')),
  notes: z.string().max(500).optional().or(z.literal('')),
});

/**
 * 緊急連絡先のバリデーションスキーマ
 * 将来的に緊急連絡先管理エンドポイントで使用予定
 */
export const emergencyContactSchema = z
  .object({
    name: z.string().max(100).optional().or(z.literal('')),
    relationship: z.string().max(50).optional().or(z.literal('')),
    phoneNumber: phoneSchema,
  })
  .optional();

/**
 * 埋葬者情報のバリデーションスキーマ
 * 将来的に埋葬者管理エンドポイントで使用予定
 */
export const buriedPersonSchema = z.object({
  id: uuidSchema.optional(),
  _delete: z.boolean().optional(),
  name: z.string().max(100).optional().or(z.literal('')),
  nameKana: z.string().max(100).optional().or(z.literal('')),
  relationship: z.string().max(50).optional().or(z.literal('')),
  birthDate: dateSchema.optional().or(z.literal('')).or(z.null()),
  deathDate: dateSchema.optional().or(z.literal('')),
  age: z.number().int().nonnegative().optional().or(z.literal(null)),
  gender: z.enum(['male', 'female', 'other']).optional().or(z.literal('')),
  burialDate: dateSchema.optional().or(z.literal('')),
  posthumousName: z.string().max(200).optional().or(z.literal('')),
  reportDate: dateSchema.optional().or(z.literal('')).or(z.null()),
  religion: z.string().max(50).optional().or(z.literal('')),
  graveNumber: z.string().max(50).optional().or(z.literal('')),
  notes: z.string().max(500).optional().or(z.literal('')),
});

/**
 * 墓石情報のバリデーションスキーマ
 * 将来的に墓石情報管理エンドポイントで使用予定
 */
export const gravestoneInfoSchema = z
  .object({
    gravestoneBase: z.string().max(100).optional().or(z.literal('')),
    enclosurePosition: z.string().max(100).optional().or(z.literal('')),
    gravestoneDealer: z.string().max(100).optional().or(z.literal('')),
    gravestoneType: z.string().max(100).optional().or(z.literal('')),
    surroundingArea: z.string().max(100).optional().or(z.literal('')),
    gravestoneCost: z.number().nonnegative().optional().or(z.literal(null)),
    establishmentDeadline: dateSchema.optional().or(z.literal('')),
    establishmentDate: dateSchema.optional().or(z.literal('')),
  })
  .optional();

/**
 * 工事情報のバリデーションスキーマ
 * 将来的に工事情報管理エンドポイントで使用予定
 */
export const constructionInfoSchema = z
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
    scheduledEndDate: dateSchema.optional().or(z.literal('')).or(z.null()),
    constructionContent: z.string().max(2000).optional().or(z.literal('')),
    constructionNotes: z.string().max(500).optional().or(z.literal('')),
  })
  .optional();

/**
 * 契約区画情報のバリデーションスキーマ
 * 販売契約情報がContractPlotに統合されたため、saleStatusフィールドは削除
 */
const contractPlotSchema = z.object({
  contractAreaSqm: z.number().positive('契約面積は正の数値で入力してください'),
  locationDescription: z.string().max(200).optional().or(z.literal('')),
});

/**
 * 顧客役割情報における役割のバリデーションスキーマ
 */
const saleContractRoleSchema = z.object({
  customerId: uuidSchema.optional(), // 既存顧客を参照する場合（新規顧客の場合は不要）
  role: z.string().max(20, '役割は20文字以内で入力してください'), // applicant, contractor, heir, co_contractor など
  isPrimary: z.boolean().optional(), // 主たる役割かどうか
  roleStartDate: dateSchema.optional().or(z.literal('')).or(z.null()),
  roleEndDate: dateSchema.optional().or(z.literal('')).or(z.null()),
  notes: z.string().max(500).optional().or(z.literal('')),
});

/**
 * 販売契約情報のバリデーションスキーマ
 */
const saleContractSchema = z.object({
  contractDate: dateSchema,
  price: z.number().nonnegative('価格は0以上の数値で入力してください'),
  paymentStatus: z.string().max(50).optional().or(z.literal('')),
  customerRole: z.string().max(50).optional().or(z.literal('')), // 後方互換性のため残す（deprecated）
  roles: z.array(saleContractRoleSchema).optional(), // 複数役割サポート（新方式）
  reservationDate: dateSchema.optional().or(z.literal('')).or(z.null()),
  acceptanceNumber: z.string().max(50).optional().or(z.literal('')),
  acceptanceDate: dateSchema.optional().or(z.literal('')).or(z.null()),
  staffInCharge: z.string().max(100).optional().or(z.literal('')),
  permitDate: dateSchema.optional().or(z.literal('')).or(z.null()),
  startDate: dateSchema.optional().or(z.literal('')).or(z.null()),
  notes: z.string().max(1000).optional().or(z.literal('')),
});

/**
 * 顧客情報のバリデーションスキーマ
 */
const customerSchema = z.object({
  name: z.string().min(1, '顧客名は必須です').max(100, '顧客名は100文字以内で入力してください'),
  nameKana: katakanaSchema('顧客名（カナ）').max(
    100,
    '顧客名（カナ）は100文字以内で入力してください'
  ),
  birthDate: dateSchema.optional().or(z.literal('')).or(z.null()),
  gender: z.enum(['male', 'female', 'other']).optional().or(z.literal('')),
  postalCode: z
    .string()
    .min(1, '郵便番号は必須です')
    .max(10, '郵便番号は10文字以内で入力してください'),
  address: z.string().min(1, '住所は必須です').max(200, '住所は200文字以内で入力してください'),
  addressLine2: z
    .string()
    .max(200, '住所2は200文字以内で入力してください')
    .optional()
    .or(z.literal('')),
  registeredAddress: z
    .string()
    .max(200, '本籍地は200文字以内で入力してください')
    .optional()
    .or(z.literal('')),
  phoneNumber: requiredPhoneSchema,
  faxNumber: phoneSchema,
  email: emailSchema.optional().or(z.literal('')),
  notes: z.string().max(1000).optional().or(z.literal('')),
});

/**
 * 勤務先情報のバリデーションスキーマ
 */
const workInfoSchema = z
  .object({
    workPostalCode: z.string().max(10).optional().or(z.literal('')),
    workAddress: z.string().max(200).optional().or(z.literal('')),
    workPhoneNumber: phoneSchema,
  })
  .optional()
  .or(z.null());

/**
 * 請求情報のバリデーションスキーマ（ContractPlot用）
 */
const contractPlotBillingInfoSchema = z
  .object({
    billingType: z.string().max(50).optional().or(z.literal('')),
    accountType: z.string().max(50).optional().or(z.literal('')),
    bankName: z.string().max(100).optional().or(z.literal('')),
    branchName: z.string().max(100).optional().or(z.literal('')),
    accountNumber: z.string().max(20).optional().or(z.literal('')),
    accountHolder: z.string().max(100).optional().or(z.literal('')),
  })
  .optional()
  .or(z.null());

/**
 * 使用料情報のバリデーションスキーマ（ContractPlot用）
 */
const contractPlotUsageFeeSchema = z
  .object({
    calculationType: z.string().max(20).optional().or(z.literal('')),
    taxType: z.string().max(20).optional().or(z.literal('')),
    billingType: z.string().max(20).optional().or(z.literal('')),
    billingYears: z.string().max(20).optional().or(z.literal('')),
    area: z.string().max(50).optional().or(z.literal('')),
    unitPrice: z.string().max(50).optional().or(z.literal('')),
    usageFee: z.string().max(50).optional().or(z.literal('')),
    paymentMethod: z.string().max(20).optional().or(z.literal('')),
  })
  .optional()
  .or(z.null());

/**
 * 管理料情報のバリデーションスキーマ（ContractPlot用）
 */
const contractPlotManagementFeeSchema = z
  .object({
    calculationType: z.string().max(20).optional().or(z.literal('')),
    taxType: z.string().max(20).optional().or(z.literal('')),
    billingType: z.string().max(20).optional().or(z.literal('')),
    billingYears: z.string().max(20).optional().or(z.literal('')),
    area: z.string().max(50).optional().or(z.literal('')),
    billingMonth: z.string().max(20).optional().or(z.literal('')),
    managementFee: z.string().max(50).optional().or(z.literal('')),
    unitPrice: z.string().max(50).optional().or(z.literal('')),
    lastBillingMonth: yearMonthSchema,
    paymentMethod: z.string().max(20).optional().or(z.literal('')),
  })
  .optional()
  .or(z.null());

/**
 * ContractPlot作成リクエストのバリデーションスキーマ
 */
export const createPlotSchema = z.object({
  physicalPlot: physicalPlotSchema,
  contractPlot: contractPlotSchema,
  saleContract: saleContractSchema,
  customer: customerSchema,
  workInfo: workInfoSchema,
  billingInfo: contractPlotBillingInfoSchema,
  usageFee: contractPlotUsageFeeSchema,
  managementFee: contractPlotManagementFeeSchema,
});

/**
 * ContractPlot更新リクエストのバリデーションスキーマ
 * すべてのフィールドがオプション
 */
export const updatePlotSchema = z.object({
  contractPlot: contractPlotSchema.partial().optional(),
  saleContract: saleContractSchema.partial().optional(),
  customer: customerSchema.partial().optional(),
  workInfo: workInfoSchema,
  billingInfo: contractPlotBillingInfoSchema,
  usageFee: contractPlotUsageFeeSchema,
  managementFee: contractPlotManagementFeeSchema,
});

/**
 * 物理区画に新規契約追加のバリデーションスキーマ
 * POST /plots/:id/contracts
 * physicalPlotセクションは不要（URLパラメータで指定されるため）
 */
export const createPlotContractSchema = z.object({
  contractPlot: contractPlotSchema,
  saleContract: saleContractSchema,
  customer: customerSchema,
  workInfo: workInfoSchema,
  billingInfo: contractPlotBillingInfoSchema,
  usageFee: contractPlotUsageFeeSchema,
  managementFee: contractPlotManagementFeeSchema,
});

/**
 * 型エクスポート
 */
export type PlotSearchQuery = z.infer<typeof plotSearchQuerySchema>;
export type PlotIdParams = z.infer<typeof plotIdParamsSchema>;
export type CreatePlotRequest = z.infer<typeof createPlotSchema>;
export type UpdatePlotRequest = z.infer<typeof updatePlotSchema>;
export type CreatePlotContractRequest = z.infer<typeof createPlotContractSchema>;
