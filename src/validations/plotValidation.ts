import { z } from 'zod';
import {
  customerSchema as sharedCustomerSchema,
  familyContactSchema as sharedFamilyContactSchema,
  buriedPersonSchema as sharedBuriedPersonSchema,
  gravestoneInfoSchema as sharedGravestoneInfoSchema,
  constructionInfoSchema as sharedConstructionInfoSchema,
  collectiveBurialSchema as sharedCollectiveBurialSchema,
  usageFeeSchema as sharedUsageFeeSchema,
  managementFeeSchema as sharedManagementFeeSchema,
  saleContractSchema as sharedSaleContractSchema,
  contractPlotSchema as sharedContractPlotSchema,
  physicalPlotSchema as sharedPhysicalPlotSchema,
} from '@komine/types';
import {
  uuidSchema,
  dateSchema,
  optionalDateSchema,
  phoneSchema,
  paginationSchema,
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
 * 物理区画情報のバリデーションスキーマ（作成用）
 * 共有スキーマ（@komine/types/validations）をベースに、作成時のid任意付与に対応。
 */
const physicalPlotSchema = sharedPhysicalPlotSchema
  .extend({
    id: uuidSchema.optional(),
  })
  .partial({
    // 作成時は既存動作との互換性のためフィールドを任意化
    plotNumber: true,
    areaName: true,
    areaSqm: true,
  });

/**
 * 物理区画情報の更新バリデーションスキーマ
 * PUT /plots/:id の input.physicalPlot で利用
 * 全フィールドオプショナル（部分更新）
 */
const physicalPlotUpdateSchema = sharedPhysicalPlotSchema
  .extend({
    status: z.string().max(20).optional(),
  })
  .partial();

/**
 * 家族連絡先のバリデーションスキーマ
 * 共有スキーマをベースに、バックエンド固有フィールド（_delete, customerId, useWorkContact 等）を追加。
 * バルク登録でのスキップ判定（controller 側が必須フィールド欠落行をスキップ）と整合させるため、
 * 共有スキーマで必須になっている name / relationship / address / phoneNumber を任意化する。
 */
export const familyContactSchema = sharedFamilyContactSchema.extend({
  id: uuidSchema.optional(),
  _delete: z.boolean().optional(),
  customerId: uuidSchema.optional(),
  useWorkContact: z.boolean().optional(),
  workContactNotes: z.string().max(200).optional().or(z.literal('')),
  name: z.string().max(100).optional().or(z.literal('')),
  relationship: z.string().max(50).optional().or(z.literal('')),
  address: z.string().max(200).optional().or(z.literal('')),
  phoneNumber: z.string().max(20).optional().or(z.literal('')),
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
 * 共有スキーマをベースに、バックエンド固有フィールド（_delete, graveNumber）を追加。
 * 共有スキーマで必須になっている name は、バルク登録でのスキップ判定のため任意化する。
 */
export const buriedPersonSchema = sharedBuriedPersonSchema.extend({
  id: uuidSchema.optional(),
  _delete: z.boolean().optional(),
  graveNumber: z.string().max(50).optional().or(z.literal('')),
  name: z.string().max(100).optional().or(z.literal('')),
});

/**
 * 墓石情報のバリデーションスキーマ
 * 共有スキーマをベースに、ルートが optional な APIペイロード形式に合わせる。
 */
export const gravestoneInfoSchema = sharedGravestoneInfoSchema.optional();

/**
 * 工事情報のバリデーションスキーマ
 * 共有スキーマをベースに、optional 配列要素として使用。
 */
export const constructionInfoSchema = sharedConstructionInfoSchema.optional();

/**
 * 工事情報の更新バリデーションスキーマ
 * PUT /plots/:id の input.constructionInfos[] で利用
 */
const constructionInfoUpdateSchema = sharedConstructionInfoSchema.extend({
  id: uuidSchema.optional(),
});

/**
 * 契約区画情報のバリデーションスキーマ
 * 共有スキーマをベース。
 */
const contractPlotSchema = sharedContractPlotSchema;

/**
 * 顧客役割情報における役割のバリデーションスキーマ
 */
const saleContractRoleSchema = z.object({
  customerId: uuidSchema.optional(), // 既存顧客を参照する場合（新規顧客の場合は不要）
  role: z.string().max(20, '役割は20文字以内で入力してください'), // applicant, contractor, heir, co_contractor など
  isPrimary: z.boolean().optional(), // 主たる役割かどうか
  roleStartDate: optionalDateSchema.nullable(),
  roleEndDate: optionalDateSchema.nullable(),
  notes: z.string().max(500).optional().or(z.literal('')),
});

/**
 * 販売契約情報のバリデーションスキーマ
 * 共有スキーマをベースに、バックエンド固有フィールド（customerRole, roles, uncollectedAmount）を追加。
 * paymentStatus は既存API互換性のため string を受け付ける（shared は nativeEnum）。
 */
const saleContractSchema = sharedSaleContractSchema.omit({ paymentStatus: true }).extend({
  paymentStatus: z.string().max(50).optional().or(z.literal('')),
  customerRole: z.string().max(50).optional().or(z.literal('')), // 後方互換性のため残す（deprecated）
  roles: z.array(saleContractRoleSchema).optional(), // 複数役割サポート（新方式）
  uncollectedAmount: z
    .number()
    .int()
    .nonnegative('未集金額は0以上の整数で入力してください')
    .optional(),
});

/**
 * 顧客情報のバリデーションスキーマ
 * 共有スキーマをベースに、バックエンド固有の要件（role は saleContract.roles で管理）に合わせる。
 */
const customerSchema = sharedCustomerSchema.omit({ role: true });

/**
 * 勤務先情報のバリデーションスキーマ
 * バックエンドでは最小サブセットのみ受け付ける（shared workInfoSchema と構造が異なるため独自定義）。
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
 * 共有スキーマをベースに、フロントが各フィールドを null/空文字として送信するケースを許容。
 */
const contractPlotUsageFeeSchema = sharedUsageFeeSchema.optional().or(z.null());

/**
 * 管理料情報のバリデーションスキーマ（ContractPlot用）
 * 共有スキーマをベースに、フロントが各フィールドを null/空文字として送信するケースを許容。
 */
const contractPlotManagementFeeSchema = sharedManagementFeeSchema.optional().or(z.null());

/**
 * 合祀設定のバリデーションスキーマ
 * 共有スキーマをベースに、ルート optional/null を許容。
 */
const collectiveBurialSchema = sharedCollectiveBurialSchema.optional().or(z.literal(null));

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
  collectiveBurial: collectiveBurialSchema,
});

/**
 * ContractPlot更新リクエストのバリデーションスキーマ
 * すべてのフィールドがオプション
 */
export const updatePlotSchema = z.object({
  physicalPlot: physicalPlotUpdateSchema.optional(),
  contractPlot: contractPlotSchema.partial().optional(),
  saleContract: saleContractSchema.partial().optional(),
  customer: customerSchema.partial().optional(),
  workInfo: workInfoSchema,
  billingInfo: contractPlotBillingInfoSchema,
  usageFee: contractPlotUsageFeeSchema,
  managementFee: contractPlotManagementFeeSchema,
  buriedPersons: z.array(buriedPersonSchema).optional(),
  constructionInfos: z.array(constructionInfoUpdateSchema).optional(),
  collectiveBurial: collectiveBurialSchema,
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

// dateSchema も従来通り再エクスポート（他モジュールからの参照互換性維持）
export { dateSchema };
