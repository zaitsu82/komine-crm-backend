/**
 * 在庫管理ユーティリティのテスト
 */

import { PrismaClient } from '@prisma/client';
import {
  calculateAvailableArea,
  validateContractArea,
  updatePhysicalPlotStatus,
} from '../../src/plots/utils';

// Prisma Client のモック（jest.mockの前に定義）
const mockPrismaClient = {
  physicalPlot: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock('@prisma/client', () => {
  const actualPrisma = jest.requireActual('@prisma/client');
  return {
    ...actualPrisma,
    PrismaClient: jest.fn(() => mockPrismaClient),
  };
});

describe('inventoryUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateAvailableArea', () => {
    it('契約がない場合、物理区画の全面積を返す', async () => {
      mockPrismaClient.physicalPlot.findUnique.mockResolvedValue({
        id: 'plot-1',
        area_sqm: { toNumber: () => 3.6 },
        contractPlots: [],
      });

      const result = await calculateAvailableArea(mockPrismaClient, 'plot-1');

      expect(result).toBe(3.6);
      expect(mockPrismaClient.physicalPlot.findUnique).toHaveBeenCalledWith({
        where: { id: 'plot-1' },
        include: {
          contractPlots: {
            where: { deleted_at: null, contract_status: 'active' },
            select: { contract_area_sqm: true },
          },
        },
      });
    });

    it('vacant / terminated 契約は契約済み面積に計上しない（active のみ集計, #165）', async () => {
      // DB クエリ側で active のみに絞るため、モックは active のみ返す前提。
      // ここでは集計クエリに contract_status: 'active' フィルタが渡ることを検証する。
      mockPrismaClient.physicalPlot.findUnique.mockResolvedValue({
        id: 'plot-1',
        area_sqm: { toNumber: () => 3.6 },
        contractPlots: [],
      });

      const result = await calculateAvailableArea(mockPrismaClient, 'plot-1');

      expect(result).toBe(3.6);
      expect(mockPrismaClient.physicalPlot.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            contractPlots: expect.objectContaining({
              where: expect.objectContaining({ contract_status: 'active' }),
            }),
          }),
        })
      );
    });

    it('契約がある場合、残り面積を返す', async () => {
      mockPrismaClient.physicalPlot.findUnique.mockResolvedValue({
        id: 'plot-1',
        area_sqm: { toNumber: () => 3.6 },
        contractPlots: [{ contract_area_sqm: { toNumber: () => 1.8 } }],
      });

      const result = await calculateAvailableArea(mockPrismaClient, 'plot-1');

      expect(result).toBe(1.8);
    });

    it('完全に契約済みの場合、0を返す', async () => {
      mockPrismaClient.physicalPlot.findUnique.mockResolvedValue({
        id: 'plot-1',
        area_sqm: { toNumber: () => 3.6 },
        contractPlots: [
          { contract_area_sqm: { toNumber: () => 1.8 } },
          { contract_area_sqm: { toNumber: () => 1.8 } },
        ],
      });

      const result = await calculateAvailableArea(mockPrismaClient, 'plot-1');

      expect(result).toBe(0);
    });

    it('物理区画が存在しない場合、エラーをスローする', async () => {
      mockPrismaClient.physicalPlot.findUnique.mockResolvedValue(null);

      await expect(calculateAvailableArea(mockPrismaClient, 'invalid-id')).rejects.toThrow(
        'Physical plot not found: invalid-id'
      );
    });
  });

  describe('validateContractArea', () => {
    it('利用可能面積内の契約面積は妥当', async () => {
      mockPrismaClient.physicalPlot.findUnique.mockResolvedValue({
        id: 'plot-1',
        area_sqm: { toNumber: () => 3.6 },
        contractPlots: [{ contract_area_sqm: { toNumber: () => 1.8 } }],
      });

      const result = await validateContractArea(mockPrismaClient, 'plot-1', 1.8);

      expect(result.isValid).toBe(true);
      expect(result.availableArea).toBe(1.8);
      expect(result.message).toBeUndefined();
    });

    it('利用可能面積を超える契約面積は不正', async () => {
      mockPrismaClient.physicalPlot.findUnique.mockResolvedValue({
        id: 'plot-1',
        area_sqm: { toNumber: () => 3.6 },
        contractPlots: [{ contract_area_sqm: { toNumber: () => 1.8 } }],
      });

      const result = await validateContractArea(mockPrismaClient, 'plot-1', 2.0);

      expect(result.isValid).toBe(false);
      expect(result.availableArea).toBe(1.8);
      expect(result.message).toContain('契約面積2㎡が利用可能面積1.8㎡を超えています');
    });

    it('0以下の契約面積は不正', async () => {
      mockPrismaClient.physicalPlot.findUnique.mockResolvedValue({
        id: 'plot-1',
        area_sqm: { toNumber: () => 3.6 },
        contractPlots: [],
      });

      const result = await validateContractArea(mockPrismaClient, 'plot-1', 0);

      expect(result.isValid).toBe(false);
      expect(result.message).toContain('契約面積は0より大きい値を指定してください');
    });

    it('物理区画が存在しない場合、無効を返す', async () => {
      mockPrismaClient.physicalPlot.findUnique.mockResolvedValue(null);

      const result = await validateContractArea(mockPrismaClient, 'invalid-id', 1.8);

      expect(result.isValid).toBe(false);
      expect(result.availableArea).toBe(0);
      expect(result.message).toBe('物理区画が見つかりません');
    });

    it('契約区画IDを除外して検証できる（更新時）', async () => {
      mockPrismaClient.physicalPlot.findUnique.mockResolvedValue({
        id: 'plot-1',
        area_sqm: { toNumber: () => 3.6 },
        contractPlots: [], // 除外したため空
      });

      const result = await validateContractArea(mockPrismaClient, 'plot-1', 3.6, 'contract-1');

      expect(result.isValid).toBe(true);
      expect(mockPrismaClient.physicalPlot.findUnique).toHaveBeenCalledWith({
        where: { id: 'plot-1' },
        include: {
          contractPlots: {
            where: {
              deleted_at: null,
              contract_status: 'active',
              id: { not: 'contract-1' },
            },
            select: { contract_area_sqm: true },
          },
        },
      });
    });
  });

  describe('updatePhysicalPlotStatus', () => {
    it('契約がない場合、availableに更新', async () => {
      mockPrismaClient.physicalPlot.findUnique
        .mockResolvedValueOnce({
          id: 'plot-1',
          area_sqm: { toNumber: () => 3.6 },
          contractPlots: [],
        })
        .mockResolvedValueOnce({
          area_sqm: { toNumber: () => 3.6 },
        });

      mockPrismaClient.physicalPlot.update.mockResolvedValue({
        id: 'plot-1',
        status: 'available',
      });

      const result = await updatePhysicalPlotStatus(mockPrismaClient, 'plot-1');

      expect(result).toBe('available');
      expect(mockPrismaClient.physicalPlot.update).toHaveBeenCalledWith({
        where: { id: 'plot-1' },
        data: { status: 'available' },
      });
    });

    it('一部契約済みの場合、partially_soldに更新', async () => {
      mockPrismaClient.physicalPlot.findUnique
        .mockResolvedValueOnce({
          id: 'plot-1',
          area_sqm: { toNumber: () => 3.6 },
          contractPlots: [{ contract_area_sqm: { toNumber: () => 1.8 } }],
        })
        .mockResolvedValueOnce({
          area_sqm: { toNumber: () => 3.6 },
        });

      mockPrismaClient.physicalPlot.update.mockResolvedValue({
        id: 'plot-1',
        status: 'partially_sold',
      });

      const result = await updatePhysicalPlotStatus(mockPrismaClient, 'plot-1');

      expect(result).toBe('partially_sold');
      expect(mockPrismaClient.physicalPlot.update).toHaveBeenCalledWith({
        where: { id: 'plot-1' },
        data: { status: 'partially_sold' },
      });
    });

    it('完全に契約済みの場合、sold_outに更新', async () => {
      mockPrismaClient.physicalPlot.findUnique
        .mockResolvedValueOnce({
          id: 'plot-1',
          area_sqm: { toNumber: () => 3.6 },
          contractPlots: [
            { contract_area_sqm: { toNumber: () => 1.8 } },
            { contract_area_sqm: { toNumber: () => 1.8 } },
          ],
        })
        .mockResolvedValueOnce({
          area_sqm: { toNumber: () => 3.6 },
        });

      mockPrismaClient.physicalPlot.update.mockResolvedValue({
        id: 'plot-1',
        status: 'sold_out',
      });

      const result = await updatePhysicalPlotStatus(mockPrismaClient, 'plot-1');

      expect(result).toBe('sold_out');
    });
  });
});
