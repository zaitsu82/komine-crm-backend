import { z } from 'zod';

/**
 * ゆうちょ連携バリデーション
 *
 * 管理料・合祀料金の請求データ取得とCSV生成に関するクエリパラメータを検証する。
 */

// 請求対象カテゴリ
export const YuchoCategoryEnum = z.enum(['management', 'collective', 'all']);
export type YuchoCategory = z.infer<typeof YuchoCategoryEnum>;

// 請求ステータスフィルタ
//   unbilled: 未請求 (ManagementFee → 未集金/未払い相当, CollectiveBurial → pending)
//   billed:   請求済 (CollectiveBurial.billing_status = billed)
//   paid:     支払済 (CollectiveBurial.billing_status = paid)
//   all:      全て
export const YuchoStatusEnum = z.enum(['unbilled', 'billed', 'paid', 'all']);
export type YuchoStatus = z.infer<typeof YuchoStatusEnum>;

// CSV形式
export const YuchoFormatEnum = z.enum(['zengin']);
export type YuchoFormat = z.infer<typeof YuchoFormatEnum>;

const yearSchema = z.coerce.number().int().min(1900).max(2999);
const monthSchema = z.coerce.number().int().min(1).max(12);

// 請求データ取得用クエリスキーマ
export const yuchoBillingQuerySchema = z.object({
  year: yearSchema,
  month: monthSchema.optional(),
  category: YuchoCategoryEnum.optional().default('all'),
  status: YuchoStatusEnum.optional().default('unbilled'),
});

export type YuchoBillingQuery = z.infer<typeof yuchoBillingQuerySchema>;

// CSV エクスポート用クエリスキーマ
//   transferDate: 引落日（MMDDフォーマット用）
//   clientCode:   委託者コード（10桁）
//   clientName:   委託者名（半角40文字以内）
//   bankCode:     金融機関コード（4桁、デフォルト 9900 = ゆうちょ）
//   branchCode:   支店コード（3桁、デフォルト 000）
export const yuchoExportQuerySchema = z.object({
  year: yearSchema,
  month: monthSchema.optional(),
  category: YuchoCategoryEnum.optional().default('all'),
  status: YuchoStatusEnum.optional().default('unbilled'),
  format: YuchoFormatEnum.optional().default('zengin'),
  transferDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'transferDate must be YYYY-MM-DD'),
  clientCode: z.string().regex(/^\d{1,10}$/, 'clientCode must be up to 10 digits'),
  clientName: z.string().min(1).max(40),
  bankCode: z
    .string()
    .regex(/^\d{4}$/, 'bankCode must be 4 digits')
    .optional()
    .default('9900'),
  branchCode: z
    .string()
    .regex(/^\d{3}$/, 'branchCode must be 3 digits')
    .optional()
    .default('000'),
});

export type YuchoExportQuery = z.infer<typeof yuchoExportQuerySchema>;

// =============================================================================
// レスポンス型定義
// =============================================================================

export interface YuchoBillingItem {
  category: 'management' | 'collective';
  sourceId: string;
  contractPlotId: string;
  plotNumber: string;
  areaName: string;
  contractDate: string;
  customerId: string | null;
  customerName: string | null;
  customerNameKana: string | null;
  billingAmount: number;
  billingStatus: string;
  scheduledDate: string | null;
  billingMonth: number | null;
  billingInfo: {
    bankName: string | null;
    branchName: string | null;
    accountType: string | null;
    accountNumber: string | null;
    accountHolder: string | null;
  } | null;
}

export interface YuchoBillingSummary {
  totalCount: number;
  totalAmount: number;
  byCategory: {
    management: { count: number; amount: number };
    collective: { count: number; amount: number };
  };
}

export interface YuchoBillingResponse {
  period: { year: number; month: number | null };
  items: YuchoBillingItem[];
  summary: YuchoBillingSummary;
}
