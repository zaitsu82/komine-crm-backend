/**
 * inventoryService.tsのテスト
 */

import {
  extractSection,
  categorizeSection,
  determinePlotType,
  getOverallSummary,
  getPeriodSummaries,
  getSectionInventory,
  getAreaInventory,
} from '../../../src/plots/services/inventoryService';

// Prismaクライアントのモック
jest.mock('@prisma/client');

describe('inventoryService', () => {
  describe('extractSection', () => {
    it('標準形式（アルファベット-数字）からセクションを抽出できること', () => {
      expect(extractSection('A-56')).toBe('A');
      expect(extractSection('B-123')).toBe('B');
      expect(extractSection('P-1')).toBe('P');
    });

    it('日本語を含む形式からセクションを抽出できること', () => {
      expect(extractSection('吉相-10')).toBe('吉相');
      expect(extractSection('るり庵テラス-1')).toBe('るり庵テラス');
      expect(extractSection('樹林-5')).toBe('樹林');
      expect(extractSection('天空K-3')).toBe('天空K');
    });

    it('数字のみのセクションを抽出できること', () => {
      expect(extractSection('1-45')).toBe('1');
      expect(extractSection('10-2')).toBe('10');
    });

    it('ハイフンがない場合はそのまま返すこと', () => {
      expect(extractSection('A')).toBe('A');
      expect(extractSection('吉相')).toBe('吉相');
    });
  });

  describe('categorizeSection', () => {
    it('樹林・天空カテゴリを正しく判定すること', () => {
      expect(categorizeSection('樹林')).toBe('樹林・天空');
      expect(categorizeSection('天空')).toBe('樹林・天空');
      expect(categorizeSection('天空K')).toBe('樹林・天空');
    });

    it('カテゴリがない場合undefinedを返すこと', () => {
      expect(categorizeSection('A')).toBeUndefined();
      expect(categorizeSection('吉相')).toBeUndefined();
      expect(categorizeSection('1')).toBeUndefined();
    });
  });

  describe('determinePlotType', () => {
    it('特殊区画タイプを正しく判定すること', () => {
      expect(determinePlotType('吉相', 3.6)).toBe('吉相');
      expect(determinePlotType('樹林', 1.8)).toBe('樹林');
      expect(determinePlotType('天空K', 3.6)).toBe('天空');
      expect(determinePlotType('天空', 1.8)).toBe('天空');
      expect(determinePlotType('るり庵テラス', 3.6)).toBe('るり庵');
      expect(determinePlotType('るり庵Ⅱ', 1.8)).toBe('るり庵');
      expect(determinePlotType('墳墓', 3.6)).toBe('墳墓');
    });

    it('特別区を正しく判定すること', () => {
      expect(determinePlotType('憩', 3.6)).toBe('特別区');
      expect(determinePlotType('恵', 1.8)).toBe('特別区');
    });

    it('通常区画は自由タイプを返すこと', () => {
      expect(determinePlotType('A', 3.6)).toBe('自由');
      expect(determinePlotType('B', 1.8)).toBe('自由');
      expect(determinePlotType('10', 3.6)).toBe('自由');
    });
  });

  describe('getOverallSummary', () => {
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        physicalPlot: {
          findMany: jest.fn(),
        },
      };
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('全体サマリーを正しく計算すること', async () => {
      mockPrisma.physicalPlot.findMany.mockResolvedValue([
        {
          id: 'plot-1',
          plot_number: 'A-1',
          area_sqm: { toNumber: () => 3.6 },
          status: 'available',
          contractPlots: [],
        },
        {
          id: 'plot-2',
          plot_number: 'A-2',
          area_sqm: { toNumber: () => 3.6 },
          status: 'sold_out',
          contractPlots: [{ contract_area_sqm: { toNumber: () => 3.6 } }],
        },
        {
          id: 'plot-3',
          plot_number: 'A-3',
          area_sqm: { toNumber: () => 3.6 },
          status: 'partially_sold',
          contractPlots: [{ contract_area_sqm: { toNumber: () => 1.8 } }],
        },
      ]);

      const result = await getOverallSummary(mockPrisma);

      expect(result.totalCount).toBe(3);
      expect(result.usedCount).toBe(2); // 1 sold_out + 0.5 partially_sold → rounds to 2
      expect(result.remainingCount).toBe(2); // 3 - 1.5 = 1.5 → rounds to 2
      expect(result.totalAreaSqm).toBe(10.8);
      expect(result.usageRate).toBeCloseTo(50, 0);
      expect(result.lastUpdated).toBeDefined();
    });

    it('区画が存在しない場合、0を返すこと', async () => {
      mockPrisma.physicalPlot.findMany.mockResolvedValue([]);

      const result = await getOverallSummary(mockPrisma);

      expect(result.totalCount).toBe(0);
      expect(result.usedCount).toBe(0);
      expect(result.remainingCount).toBe(0);
      expect(result.usageRate).toBe(0);
    });
  });

  describe('getPeriodSummaries', () => {
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        physicalPlot: {
          findMany: jest.fn(),
        },
      };
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('全期のサマリーを取得できること', async () => {
      // 各期に対してfindManyが呼ばれる
      mockPrisma.physicalPlot.findMany
        .mockResolvedValueOnce([
          // 1期
          {
            id: 'plot-1',
            area_sqm: { toNumber: () => 3.6 },
            status: 'available',
            contractPlots: [],
          },
        ])
        .mockResolvedValueOnce([
          // 2期
          {
            id: 'plot-2',
            area_sqm: { toNumber: () => 3.6 },
            status: 'sold_out',
            contractPlots: [{ contract_area_sqm: { toNumber: () => 3.6 } }],
          },
        ])
        .mockResolvedValueOnce([]) // 3期
        .mockResolvedValueOnce([]); // 4期

      const result = await getPeriodSummaries(mockPrisma);

      expect(result).toHaveLength(4);
      expect(result[0].period).toBe('1期');
      expect(result[0].totalCount).toBe(1);
      expect(result[0].remainingCount).toBe(1);
      expect(result[1].period).toBe('2期');
      expect(result[1].usedCount).toBe(1);
    });

    it('特定の期のみのサマリーを取得できること', async () => {
      mockPrisma.physicalPlot.findMany.mockResolvedValue([
        {
          id: 'plot-1',
          area_sqm: { toNumber: () => 3.6 },
          status: 'sold_out',
          contractPlots: [{ contract_area_sqm: { toNumber: () => 3.6 } }],
        },
        {
          id: 'plot-2',
          area_sqm: { toNumber: () => 3.6 },
          status: 'available',
          contractPlots: [],
        },
      ]);

      const result = await getPeriodSummaries(mockPrisma, '1期');

      expect(result).toHaveLength(1);
      expect(result[0].period).toBe('1期');
      expect(result[0].totalCount).toBe(2);
      expect(result[0].usedCount).toBe(1);
      expect(result[0].remainingCount).toBe(1);
      expect(result[0].usageRate).toBe(50);
    });
  });

  describe('getSectionInventory', () => {
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        physicalPlot: {
          findMany: jest.fn(),
        },
      };
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('セクション別集計を取得できること', async () => {
      mockPrisma.physicalPlot.findMany.mockResolvedValue([
        {
          id: 'plot-1',
          plot_number: 'A-1',
          area_name: '1期',
          area_sqm: { toNumber: () => 3.6 },
          status: 'available',
          contractPlots: [],
        },
        {
          id: 'plot-2',
          plot_number: 'A-2',
          area_name: '1期',
          area_sqm: { toNumber: () => 3.6 },
          status: 'sold_out',
          contractPlots: [{ contract_area_sqm: { toNumber: () => 3.6 } }],
        },
        {
          id: 'plot-3',
          plot_number: 'B-1',
          area_name: '1期',
          area_sqm: { toNumber: () => 3.6 },
          status: 'available',
          contractPlots: [],
        },
      ]);

      const result = await getSectionInventory(mockPrisma);

      expect(result.items.length).toBeGreaterThan(0);
      expect(result.total).toBeGreaterThan(0);

      // Aセクションのチェック
      const sectionA = result.items.find((i) => i.section === 'A');
      expect(sectionA).toBeDefined();
      expect(sectionA!.totalCount).toBe(2);
      expect(sectionA!.usedCount).toBe(1);

      // Bセクションのチェック
      const sectionB = result.items.find((i) => i.section === 'B');
      expect(sectionB).toBeDefined();
      expect(sectionB!.totalCount).toBe(1);
      expect(sectionB!.remainingCount).toBe(1);
    });

    it('期でフィルタリングできること', async () => {
      mockPrisma.physicalPlot.findMany.mockResolvedValue([
        {
          id: 'plot-1',
          plot_number: 'A-1',
          area_name: '1期',
          area_sqm: { toNumber: () => 3.6 },
          status: 'available',
          contractPlots: [],
        },
      ]);

      await getSectionInventory(mockPrisma, { period: '1期' });

      expect(mockPrisma.physicalPlot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ area_name: '1期' }),
        })
      );
    });

    it('検索フィルタが適用されること', async () => {
      mockPrisma.physicalPlot.findMany.mockResolvedValue([
        {
          id: 'plot-1',
          plot_number: '吉相-1',
          area_name: '1期',
          area_sqm: { toNumber: () => 3.6 },
          status: 'available',
          contractPlots: [],
        },
        {
          id: 'plot-2',
          plot_number: 'A-1',
          area_name: '1期',
          area_sqm: { toNumber: () => 3.6 },
          status: 'available',
          contractPlots: [],
        },
      ]);

      const result = await getSectionInventory(mockPrisma, { search: '吉相' });

      expect(result.items.length).toBe(1);
      expect(result.items[0].section).toBe('吉相');
    });

    it('ソートが適用されること', async () => {
      mockPrisma.physicalPlot.findMany.mockResolvedValue([
        {
          id: 'plot-1',
          plot_number: 'A-1',
          area_name: '1期',
          area_sqm: { toNumber: () => 3.6 },
          status: 'available',
          contractPlots: [],
        },
        {
          id: 'plot-2',
          plot_number: 'B-1',
          area_name: '1期',
          area_sqm: { toNumber: () => 3.6 },
          status: 'sold_out',
          contractPlots: [{ contract_area_sqm: { toNumber: () => 3.6 } }],
        },
      ]);

      const resultAsc = await getSectionInventory(mockPrisma, {
        sortBy: 'usageRate',
        sortOrder: 'asc',
      });
      const resultDesc = await getSectionInventory(mockPrisma, {
        sortBy: 'usageRate',
        sortOrder: 'desc',
      });

      expect(resultAsc.items[0].usageRate).toBeLessThanOrEqual(
        resultAsc.items[resultAsc.items.length - 1].usageRate
      );
      expect(resultDesc.items[0].usageRate).toBeGreaterThanOrEqual(
        resultDesc.items[resultDesc.items.length - 1].usageRate
      );
    });

    it('ページネーションが適用されること', async () => {
      const plots = Array.from({ length: 30 }, (_, i) => ({
        id: `plot-${i}`,
        plot_number: `${String.fromCharCode(65 + (i % 26))}-${Math.floor(i / 26) + 1}`,
        area_name: '1期',
        area_sqm: { toNumber: () => 3.6 },
        status: 'available',
        contractPlots: [],
      }));

      mockPrisma.physicalPlot.findMany.mockResolvedValue(plots);

      const result = await getSectionInventory(mockPrisma, { page: 1, limit: 10 });

      expect(result.items.length).toBeLessThanOrEqual(10);
      expect(result.total).toBeGreaterThan(10);
    });
  });

  describe('getAreaInventory', () => {
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        physicalPlot: {
          findMany: jest.fn(),
        },
      };
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('面積別集計を取得できること', async () => {
      mockPrisma.physicalPlot.findMany.mockResolvedValue([
        {
          id: 'plot-1',
          plot_number: 'A-1',
          area_name: '1期',
          area_sqm: { toNumber: () => 3.6 },
          status: 'available',
          contractPlots: [],
        },
        {
          id: 'plot-2',
          plot_number: 'A-2',
          area_name: '1期',
          area_sqm: { toNumber: () => 1.8 },
          status: 'sold_out',
          contractPlots: [{ contract_area_sqm: { toNumber: () => 1.8 } }],
        },
      ]);

      const result = await getAreaInventory(mockPrisma);

      expect(result.items.length).toBeGreaterThan(0);
      expect(result.total).toBeGreaterThan(0);

      // 3.6㎡のチェック
      const area36 = result.items.find((i) => i.areaSqm === 3.6);
      expect(area36).toBeDefined();
      expect(area36!.remainingCount).toBe(1);

      // 1.8㎡のチェック
      const area18 = result.items.find((i) => i.areaSqm === 1.8);
      expect(area18).toBeDefined();
      expect(area18!.usedCount).toBe(1);
    });

    it('期でフィルタリングできること', async () => {
      mockPrisma.physicalPlot.findMany.mockResolvedValue([]);

      await getAreaInventory(mockPrisma, { period: '2期' });

      expect(mockPrisma.physicalPlot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ area_name: '2期' }),
        })
      );
    });

    it('残面積が正しく計算されること', async () => {
      mockPrisma.physicalPlot.findMany.mockResolvedValue([
        {
          id: 'plot-1',
          plot_number: 'A-1',
          area_name: '1期',
          area_sqm: { toNumber: () => 3.6 },
          status: 'available',
          contractPlots: [],
        },
        {
          id: 'plot-2',
          plot_number: 'A-2',
          area_name: '1期',
          area_sqm: { toNumber: () => 3.6 },
          status: 'sold_out',
          contractPlots: [{ contract_area_sqm: { toNumber: () => 3.6 } }],
        },
      ]);

      const result = await getAreaInventory(mockPrisma);

      const area36 = result.items.find((i) => i.areaSqm === 3.6);
      expect(area36!.remainingAreaSqm).toBe(3.6); // 1区画分の残り
    });

    it('plotTypeが正しく設定されること', async () => {
      mockPrisma.physicalPlot.findMany.mockResolvedValue([
        {
          id: 'plot-1',
          plot_number: '吉相-1',
          area_name: '1期',
          area_sqm: { toNumber: () => 3.6 },
          status: 'available',
          contractPlots: [],
        },
        {
          id: 'plot-2',
          plot_number: 'A-1',
          area_name: '1期',
          area_sqm: { toNumber: () => 3.6 },
          status: 'available',
          contractPlots: [],
        },
      ]);

      const result = await getAreaInventory(mockPrisma);

      const kissou = result.items.find((i) => i.plotType === '吉相');
      expect(kissou).toBeDefined();

      const jiyuu = result.items.find((i) => i.plotType === '自由');
      expect(jiyuu).toBeDefined();
    });
  });
});
