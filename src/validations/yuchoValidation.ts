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
// ゆうちょ自動払込みCSVは委託者ヘッダを持たないため、ヘッダ系パラメータ
// (transferDate / clientCode / clientName / bankCode / branchCode) は不要。
export const yuchoExportQuerySchema = z.object({
  year: yearSchema,
  month: monthSchema.optional(),
  category: YuchoCategoryEnum.optional().default('all'),
  status: YuchoStatusEnum.optional().default('unbilled'),
  format: YuchoFormatEnum.optional().default('zengin'),
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
  /** 請求対象の総件数（口座未登録を含む） */
  totalCount: number;
  /** 請求対象の総額（口座未登録を含む） */
  totalAmount: number;
  /** 実際にCSV（振替ファイル）へ出力される件数（口座登録あり・金額>0）。CSVのデータ行数と一致する */
  exportableCount: number;
  /** 実際にCSVへ出力される金額の合計。CSVトレーラーの合計金額と一致する */
  exportableAmount: number;
  /** 口座未登録のため振替ファイルから除外される件数（請求漏れ検知用） */
  excludedNoAccountCount: number;
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
