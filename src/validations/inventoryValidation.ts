import { z } from 'zod';

// 期の定義
export const PlotPeriodEnum = z.enum(['1期', '2期', '3期', '4期']);
export type PlotPeriod = z.infer<typeof PlotPeriodEnum>;

// ステータスの定義
export const PlotStatusEnum = z.enum(['available', 'partially_sold', 'sold_out']);
export type PlotStatus = z.infer<typeof PlotStatusEnum>;

// ソートキー（セクション別）
export const SectionSortKeyEnum = z.enum([
  'period',
  'section',
  'totalCount',
  'usedCount',
  'remainingCount',
  'usageRate',
]);
export type SectionSortKey = z.infer<typeof SectionSortKeyEnum>;

// ソートキー（面積別）
export const AreaSortKeyEnum = z.enum([
  'period',
  'areaSqm',
  'totalCount',
  'usedCount',
  'remainingCount',
  'remainingAreaSqm',
  'plotType',
]);
export type AreaSortKey = z.infer<typeof AreaSortKeyEnum>;

// ソート順
export const SortOrderEnum = z.enum(['asc', 'desc']);
export type SortOrder = z.infer<typeof SortOrderEnum>;

// 全体サマリー用クエリスキーマ（パラメータなし）
export const inventorySummaryQuerySchema = z.object({});

// 期別サマリー用クエリスキーマ
export const inventoryPeriodsQuerySchema = z.object({
  period: PlotPeriodEnum.optional(),
});

// セクション別集計用クエリスキーマ
export const inventorySectionsQuerySchema = z.object({
  period: PlotPeriodEnum.optional(),
  status: PlotStatusEnum.optional(),
  search: z.string().optional(),
  sortBy: SectionSortKeyEnum.optional().default('period'),
  sortOrder: SortOrderEnum.optional().default('asc'),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

// 面積別集計用クエリスキーマ
export const inventoryAreasQuerySchema = z.object({
  period: PlotPeriodEnum.optional(),
  search: z.string().optional(),
  sortBy: AreaSortKeyEnum.optional().default('period'),
  sortOrder: SortOrderEnum.optional().default('asc'),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

// レスポンス型定義
export interface InventorySummaryData {
  totalCount: number;
  usedCount: number;
  remainingCount: number;
  usageRate: number;
  totalAreaSqm: number;
  remainingAreaSqm: number;
  lastUpdated: string;
}

export interface PeriodSummaryItem {
  period: PlotPeriod;
  totalCount: number;
  usedCount: number;
  remainingCount: number;
  usageRate: number;
}

export interface InventoryPeriodsData {
  periods: PeriodSummaryItem[];
}

export interface SectionInventoryItem {
  period: string;
  section: string;
  totalCount: number;
  usedCount: number;
  remainingCount: number;
  usageRate: number;
  category?: string;
}

export interface InventorySectionsData {
  items: SectionInventoryItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AreaInventoryItem {
  period: string;
  areaSqm: number;
  totalCount: number;
  usedCount: number;
  remainingCount: number;
  remainingAreaSqm: number;
  plotType: string;
}

export interface InventoryAreasData {
  items: AreaInventoryItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
