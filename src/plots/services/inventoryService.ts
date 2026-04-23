import { PrismaClient, Prisma } from '@prisma/client';
import {
  InventorySummaryData,
  PeriodSummaryItem,
  SectionInventoryItem,
  AreaInventoryItem,
  PlotPeriod,
  PlotStatus,
  SectionSortKey,
  AreaSortKey,
  SortOrder,
} from '../../validations/inventoryValidation';

// 期の定義（区画名一覧.md / SectionNameMasterのperiodに準拠）
export const PERIODS: PlotPeriod[] = ['第1期', '第2期', '第3期', '第3期樹林部', '第4期'];

// Prisma Decimalまたは数値を数値に変換するヘルパー
function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (
    typeof value === 'object' &&
    'toNumber' in value &&
    typeof (value as { toNumber: () => number }).toNumber === 'function'
  ) {
    return (value as { toNumber: () => number }).toNumber();
  }
  const num = Number(value);
  return isNaN(num) ? 0 : num;
}

/**
 * plot_number からセクション名を抽出する。
 *
 * 暫定仕様（業務ヒアリング待ち / issue #64 項目 #1）:
 *   plot_number は `<section>-<連番>` の単純形式を前提とする。
 *     例: "A-56" → "A", "吉相-10" → "吉相", "1.5-3" → "1.5",
 *         "るり庵テラス-1" → "るり庵テラス", "天空K-5" → "天空K"
 *   区画名一覧（komine-docs/区画名一覧.md）に従い、セクション名自体には
 *   ハイフンを含めない前提。期名（area_name）は別カラムで管理し、
 *   plot_number には含めない。
 *   末尾に `-<連番>` が無いフォーマット（例: "A", "吉相"）は、
 *   セクション単独表記として扱い、そのまま返す。
 */
export function extractSection(plotNumber: string): string {
  const match = plotNumber.match(/^(.+)-\d+$/);
  return match && match[1] ? match[1] : plotNumber;
}

/**
 * セクションを特殊区画カテゴリに分類する。
 *
 * 暫定仕様（業務ヒアリング待ち / issue #64 項目 #5）:
 *   区画名一覧（komine-docs/区画名一覧.md）の第3期樹林部のセクション
 *   （樹林, 天空K）を「樹林・天空」カテゴリに分類する。
 *   素の "天空" セクションは区画名一覧に存在しないが、将来 "天空-N" のような
 *   区画が追加された場合に備えて互換で残している。
 */
export function categorizeSection(section: string): string | undefined {
  const categoryMap: Record<string, string> = {
    樹林: '樹林・天空',
    天空: '樹林・天空',
    天空K: '樹林・天空',
  };
  return categoryMap[section];
}

/**
 * セクション名から区画タイプ（表示用分類）を判定する。
 *
 * 暫定仕様（業務ヒアリング待ち / issue #64 項目 #6）:
 *   区画名一覧（komine-docs/区画名一覧.md）に準拠する。
 *     - 吉相 → "吉相"
 *     - 樹林 → "樹林"
 *     - "天空" を含む（天空K等） → "天空"
 *     - "るり庵" を含む（るり庵テラス, るり庵テラスⅡ等） → "るり庵"
 *     - 想 → "るり庵"（区画名一覧の備考より、もり庵テラス関連の区画として暫定で "るり庵" 扱い）
 *     - 墳墓 → "墳墓"（区画名一覧には無いが将来用に残置）
 *     - 憩 / 恵 → "特別区"
 *     - その他（A〜P, 1〜8, 1.5, 2.4, 3, 4, 5, 8.4 等） → "自由"
 */
export function determinePlotType(section: string, _areaSqm: number): string {
  if (section === '吉相') return '吉相';
  if (section === '樹林') return '樹林';
  if (section.includes('天空')) return '天空';
  if (section.includes('るり庵')) return 'るり庵';
  if (section === '想') return 'るり庵';
  if (section === '墳墓') return '墳墓';
  if (section === '憩' || section === '恵') return '特別区';
  return '自由';
}

interface GetInventoryOptions {
  period?: PlotPeriod;
  status?: PlotStatus;
  search?: string;
  sortBy?: SectionSortKey | AreaSortKey;
  sortOrder?: SortOrder;
  page?: number;
  limit?: number;
}

type DbClient = PrismaClient | Prisma.TransactionClient;

/**
 * 全体サマリーを取得
 */
export async function getOverallSummary(prisma: DbClient): Promise<InventorySummaryData> {
  // 全物理区画を取得（削除されていないもの）
  const physicalPlots = await prisma.physicalPlot.findMany({
    where: { deleted_at: null },
    include: {
      contractPlots: {
        where: { deleted_at: null },
        select: { contract_area_sqm: true },
      },
    },
  });

  let totalCount = 0;
  let usedCount = 0;
  let totalAreaSqm = 0;
  let usedAreaSqm = 0;

  for (const plot of physicalPlots) {
    totalCount += 1;
    const plotArea = plot.area_sqm ? toNumber(plot.area_sqm) : 3.6;
    totalAreaSqm += plotArea;

    // 契約面積の合計
    const contractedArea = plot.contractPlots.reduce(
      (sum, cp) => sum + toNumber(cp.contract_area_sqm),
      0
    );

    // ステータスに基づいてカウント
    if (plot.status === 'sold_out') {
      usedCount += 1;
      usedAreaSqm += plotArea;
    } else if (plot.status === 'partially_sold' && contractedArea > 0) {
      // 部分的に売却されている場合、面積比率で計算
      usedAreaSqm += contractedArea;
      // カウントは部分的としてカウント
      usedCount += contractedArea / plotArea;
    }
  }

  const remainingCount = totalCount - usedCount;
  const remainingAreaSqm = totalAreaSqm - usedAreaSqm;
  const usageRate = totalCount > 0 ? (usedCount / totalCount) * 100 : 0;

  return {
    totalCount: Math.round(totalCount),
    usedCount: Math.round(usedCount),
    remainingCount: Math.round(remainingCount),
    usageRate: Math.round(usageRate * 10) / 10,
    totalAreaSqm: Math.round(totalAreaSqm * 100) / 100,
    remainingAreaSqm: Math.round(remainingAreaSqm * 100) / 100,
    // issue #64 項目 #3: API は常に ISO8601 (UTC) で返す。表示整形はフロント責務。
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * 期別サマリーを取得
 * 最適化: N+1クエリを1クエリに統合
 */
export async function getPeriodSummaries(
  prisma: DbClient,
  period?: PlotPeriod
): Promise<PeriodSummaryItem[]> {
  const periodsToQuery = period ? [period] : PERIODS;

  // 単一クエリで全期間のデータを取得
  const physicalPlots = await prisma.physicalPlot.findMany({
    where: {
      deleted_at: null,
      area_name: { in: periodsToQuery },
    },
    include: {
      contractPlots: {
        where: { deleted_at: null },
        select: { contract_area_sqm: true },
      },
    },
  });

  // 期別にグルーピング
  const plotsByPeriod = new Map<string, { totalCount: number; usedCount: number }>();

  // 対象期間を初期化
  for (const p of periodsToQuery) {
    plotsByPeriod.set(p, { totalCount: 0, usedCount: 0 });
  }

  // データを集計
  for (const plot of physicalPlots) {
    const periodData = plotsByPeriod.get(plot.area_name);
    if (!periodData) continue;

    periodData.totalCount += 1;
    const plotArea = plot.area_sqm ? toNumber(plot.area_sqm) : 3.6;

    const contractedArea = plot.contractPlots.reduce(
      (sum, cp) => sum + toNumber(cp.contract_area_sqm),
      0
    );

    if (plot.status === 'sold_out') {
      periodData.usedCount += 1;
    } else if (plot.status === 'partially_sold' && contractedArea > 0) {
      periodData.usedCount += contractedArea / plotArea;
    }
  }

  // 結果を配列に変換
  const results: PeriodSummaryItem[] = periodsToQuery.map((p) => {
    const data = plotsByPeriod.get(p)!;
    const remainingCount = data.totalCount - data.usedCount;
    const usageRate = data.totalCount > 0 ? (data.usedCount / data.totalCount) * 100 : 0;

    return {
      period: p,
      totalCount: Math.round(data.totalCount),
      usedCount: Math.round(data.usedCount),
      remainingCount: Math.round(remainingCount),
      usageRate: Math.round(usageRate * 10) / 10,
    };
  });

  return results;
}

/**
 * セクション別集計を取得
 */
export async function getSectionInventory(
  prisma: DbClient,
  options: GetInventoryOptions = {}
): Promise<{ items: SectionInventoryItem[]; total: number }> {
  const {
    period,
    status,
    search,
    sortBy = 'period',
    sortOrder = 'asc',
    page = 1,
    limit = 20,
  } = options;

  // 条件に合う物理区画を取得
  const whereClause: Prisma.PhysicalPlotWhereInput = {
    deleted_at: null,
  };

  if (period) {
    whereClause.area_name = period;
  }

  if (status) {
    whereClause.status = status;
  }

  const physicalPlots = await prisma.physicalPlot.findMany({
    where: whereClause,
    include: {
      contractPlots: {
        where: { deleted_at: null },
        select: { contract_area_sqm: true },
      },
    },
  });

  // セクション別に集計
  const sectionMap = new Map<
    string,
    {
      period: string;
      section: string;
      totalCount: number;
      usedCount: number;
      category?: string;
    }
  >();

  for (const plot of physicalPlots) {
    const section = extractSection(plot.plot_number);
    const key = `${plot.area_name}-${section}`;
    const plotArea = plot.area_sqm ? toNumber(plot.area_sqm) : 3.6;

    const contractedArea = plot.contractPlots.reduce(
      (sum, cp) => sum + toNumber(cp.contract_area_sqm),
      0
    );

    let usedPortion = 0;
    if (plot.status === 'sold_out') {
      usedPortion = 1;
    } else if (plot.status === 'partially_sold' && contractedArea > 0) {
      usedPortion = contractedArea / plotArea;
    }

    if (sectionMap.has(key)) {
      const existing = sectionMap.get(key)!;
      existing.totalCount += 1;
      existing.usedCount += usedPortion;
    } else {
      sectionMap.set(key, {
        period: plot.area_name,
        section,
        totalCount: 1,
        usedCount: usedPortion,
        category: categorizeSection(section),
      });
    }
  }

  // 結果を配列に変換
  let items: SectionInventoryItem[] = Array.from(sectionMap.values()).map((item) => {
    const remainingCount = item.totalCount - item.usedCount;
    const usageRate = item.totalCount > 0 ? (item.usedCount / item.totalCount) * 100 : 0;

    return {
      period: item.period,
      section: item.section,
      totalCount: Math.round(item.totalCount),
      usedCount: Math.round(item.usedCount),
      remainingCount: Math.round(remainingCount),
      usageRate: Math.round(usageRate * 10) / 10,
      category: item.category,
    };
  });

  // 検索フィルタ
  if (search) {
    const searchLower = search.toLowerCase();
    items = items.filter(
      (item) =>
        item.period.toLowerCase().includes(searchLower) ||
        item.section.toLowerCase().includes(searchLower) ||
        (item.category && item.category.toLowerCase().includes(searchLower))
    );
  }

  // ソート
  items.sort((a, b) => {
    let comparison = 0;
    switch (sortBy as SectionSortKey) {
      case 'period':
        comparison = a.period.localeCompare(b.period);
        break;
      case 'section':
        comparison = a.section.localeCompare(b.section);
        break;
      case 'totalCount':
        comparison = a.totalCount - b.totalCount;
        break;
      case 'usedCount':
        comparison = a.usedCount - b.usedCount;
        break;
      case 'remainingCount':
        comparison = a.remainingCount - b.remainingCount;
        break;
      case 'usageRate':
        comparison = a.usageRate - b.usageRate;
        break;
      default:
        comparison = a.period.localeCompare(b.period);
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const total = items.length;

  // ページネーション
  const startIndex = (page - 1) * limit;
  const paginatedItems = items.slice(startIndex, startIndex + limit);

  return { items: paginatedItems, total };
}

/**
 * 面積別集計を取得
 */
export async function getAreaInventory(
  prisma: DbClient,
  options: GetInventoryOptions = {}
): Promise<{ items: AreaInventoryItem[]; total: number }> {
  const { period, search, sortBy = 'period', sortOrder = 'asc', page = 1, limit = 20 } = options;

  // 条件に合う物理区画を取得
  const whereClause: Prisma.PhysicalPlotWhereInput = {
    deleted_at: null,
  };

  if (period) {
    whereClause.area_name = period;
  }

  const physicalPlots = await prisma.physicalPlot.findMany({
    where: whereClause,
    include: {
      contractPlots: {
        where: { deleted_at: null },
        select: { contract_area_sqm: true },
      },
    },
  });

  // 面積・期・タイプ別に集計
  const areaMap = new Map<
    string,
    {
      period: string;
      areaSqm: number;
      plotType: string;
      totalCount: number;
      usedCount: number;
      totalAreaSqm: number;
      usedAreaSqm: number;
    }
  >();

  for (const plot of physicalPlots) {
    const section = extractSection(plot.plot_number);
    const plotArea = plot.area_sqm ? toNumber(plot.area_sqm) : 3.6;
    const plotType = determinePlotType(section, plotArea);
    const key = `${plot.area_name}-${plotArea}-${plotType}`;

    const contractedArea = plot.contractPlots.reduce(
      (sum, cp) => sum + toNumber(cp.contract_area_sqm),
      0
    );

    let usedPortion = 0;
    let usedAreaForPlot = 0;
    if (plot.status === 'sold_out') {
      usedPortion = 1;
      usedAreaForPlot = plotArea;
    } else if (plot.status === 'partially_sold' && contractedArea > 0) {
      usedPortion = contractedArea / plotArea;
      usedAreaForPlot = contractedArea;
    }

    if (areaMap.has(key)) {
      const existing = areaMap.get(key)!;
      existing.totalCount += 1;
      existing.usedCount += usedPortion;
      existing.totalAreaSqm += plotArea;
      existing.usedAreaSqm += usedAreaForPlot;
    } else {
      areaMap.set(key, {
        period: plot.area_name,
        areaSqm: plotArea,
        plotType,
        totalCount: 1,
        usedCount: usedPortion,
        totalAreaSqm: plotArea,
        usedAreaSqm: usedAreaForPlot,
      });
    }
  }

  // 結果を配列に変換
  let items: AreaInventoryItem[] = Array.from(areaMap.values()).map((item) => {
    const remainingCount = item.totalCount - item.usedCount;
    const remainingAreaSqm = item.totalAreaSqm - item.usedAreaSqm;

    return {
      period: item.period,
      areaSqm: item.areaSqm,
      totalCount: Math.round(item.totalCount),
      usedCount: Math.round(item.usedCount),
      remainingCount: Math.round(remainingCount),
      remainingAreaSqm: Math.round(remainingAreaSqm * 100) / 100,
      plotType: item.plotType,
    };
  });

  // 検索フィルタ
  if (search) {
    const searchLower = search.toLowerCase();
    items = items.filter(
      (item) =>
        item.period.toLowerCase().includes(searchLower) ||
        item.plotType.toLowerCase().includes(searchLower) ||
        item.areaSqm.toString().includes(searchLower)
    );
  }

  // ソート
  items.sort((a, b) => {
    let comparison = 0;
    switch (sortBy as AreaSortKey) {
      case 'period':
        comparison = a.period.localeCompare(b.period);
        break;
      case 'areaSqm':
        comparison = a.areaSqm - b.areaSqm;
        break;
      case 'totalCount':
        comparison = a.totalCount - b.totalCount;
        break;
      case 'usedCount':
        comparison = a.usedCount - b.usedCount;
        break;
      case 'remainingCount':
        comparison = a.remainingCount - b.remainingCount;
        break;
      case 'remainingAreaSqm':
        comparison = a.remainingAreaSqm - b.remainingAreaSqm;
        break;
      case 'plotType':
        comparison = a.plotType.localeCompare(b.plotType);
        break;
      default:
        comparison = a.period.localeCompare(b.period);
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const total = items.length;

  // ページネーション
  const startIndex = (page - 1) * limit;
  const paginatedItems = items.slice(startIndex, startIndex + limit);

  return { items: paginatedItems, total };
}
