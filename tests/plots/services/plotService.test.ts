/**
 * plotService.tsのテスト
 */

import { PrismaClient } from '@prisma/client';
import {
  findPhysicalPlotById,
  findPhysicalPlotWithContracts,
  validatePhysicalPlotExists,
  buildPhysicalPlotResponse,
  buildContractsSummary,
} from '../../../src/plots/services/plotService';

// Prismaクライアントのモック
jest.mock('@prisma/client');

describe('plotService', () => {
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      physicalPlot: {
        findUnique: jest.fn(),
      },
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findPhysicalPlotById', () => {
    it('物理区画をIDで検索できること', async () => {
      const mockPlot = {
        id: 'plot-1',
        plot_number: 'A-01',
        area_name: '一般墓地A',
        area_sqm: 3.6,
        status: 'available',
        deleted_at: null,
      };

      mockPrisma.physicalPlot.findUnique.mockResolvedValue(mockPlot);

      const result = await findPhysicalPlotById(mockPrisma, 'plot-1');

      expect(mockPrisma.physicalPlot.findUnique).toHaveBeenCalledWith({
        where: { id: 'plot-1', deleted_at: null },
      });
      expect(result).toEqual(mockPlot);
    });

    it('存在しない物理区画の場合nullを返すこと', async () => {
      mockPrisma.physicalPlot.findUnique.mockResolvedValue(null);

      const result = await findPhysicalPlotById(mockPrisma, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findPhysicalPlotWithContracts', () => {
    it('物理区画を契約情報とともに検索できること', async () => {
      const mockPlotWithContracts = {
        id: 'plot-1',
        plot_number: 'A-01',
        ContractPlots: [
          {
            id: 'contract-1',
            contract_area_sqm: 1.8,
            SaleContract: {
              Customer: {
                id: 'customer-1',
                name: '山田太郎',
              },
            },
          },
        ],
      };

      mockPrisma.physicalPlot.findUnique.mockResolvedValue(mockPlotWithContracts);

      const result = await findPhysicalPlotWithContracts(mockPrisma, 'plot-1');

      expect(mockPrisma.physicalPlot.findUnique).toHaveBeenCalledWith({
        where: { id: 'plot-1', deleted_at: null },
        include: {
          ContractPlots: {
            where: { deleted_at: null },
            include: {
              SaleContract: {
                include: {
                  SaleContractRoles: {
                    where: { deleted_at: null, is_primary: true },
                    include: {
                      Customer: {
                        select: {
                          id: true,
                          name: true,
                          name_kana: true,
                          phone_number: true,
                        },
                      },
                    },
                  },
                },
              },
              UsageFee: true,
              ManagementFee: true,
            },
            orderBy: { created_at: 'desc' },
          },
        },
      });
      expect(result).toEqual(mockPlotWithContracts);
    });
  });

  describe('validatePhysicalPlotExists', () => {
    it('物理区画が存在する場合、区画を返すこと', async () => {
      const mockPlot = {
        id: 'plot-1',
        plot_number: 'A-01',
        deleted_at: null,
      };

      mockPrisma.physicalPlot.findUnique.mockResolvedValue(mockPlot);

      const result = await validatePhysicalPlotExists(mockPrisma, 'plot-1');

      expect(result).toEqual(mockPlot);
    });

    it('物理区画が存在しない場合、エラーをスローすること', async () => {
      mockPrisma.physicalPlot.findUnique.mockResolvedValue(null);

      await expect(validatePhysicalPlotExists(mockPrisma, 'nonexistent')).rejects.toThrow(
        '指定された物理区画が見つかりません'
      );
    });
  });

  describe('buildPhysicalPlotResponse', () => {
    it('物理区画レスポンスを正しくフォーマットすること', () => {
      const mockPlot = {
        id: 'plot-1',
        plot_number: 'A-01',
        area_name: '一般墓地A',
        area_sqm: { toNumber: () => 3.6 },
        status: 'available',
        notes: 'テスト備考',
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-02'),
      };

      const result = buildPhysicalPlotResponse(mockPlot);

      expect(result).toEqual({
        id: 'plot-1',
        plotNumber: 'A-01',
        areaName: '一般墓地A',
        areaSqm: 3.6,
        status: 'available',
        notes: 'テスト備考',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      });
    });
  });

  describe('buildContractsSummary', () => {
    it('契約サマリーを正しく計算すること', () => {
      const mockContracts = [
        { contract_area_sqm: { toNumber: () => 1.8 } },
        { contract_area_sqm: { toNumber: () => 1.2 } },
        { contract_area_sqm: { toNumber: () => 0.6 } },
      ];

      const result = buildContractsSummary(mockContracts);

      expect(result).toEqual({
        totalContracts: 3,
        totalAllocatedArea: 3.6,
      });
    });

    it('契約がない場合、合計0を返すこと', () => {
      const result = buildContractsSummary([]);

      expect(result).toEqual({
        totalContracts: 0,
        totalAllocatedArea: 0,
      });
    });
  });
});
