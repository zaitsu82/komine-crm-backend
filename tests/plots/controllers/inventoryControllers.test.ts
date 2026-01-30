/**
 * 在庫管理コントローラーのテスト
 */

import { Request, Response } from 'express';
import { getInventorySummary } from '../../../src/plots/controllers/getInventorySummary';
import { getInventoryPeriods } from '../../../src/plots/controllers/getInventoryPeriods';
import { getInventorySections } from '../../../src/plots/controllers/getInventorySections';
import { getInventoryAreas } from '../../../src/plots/controllers/getInventoryAreas';
import * as inventoryService from '../../../src/plots/services/inventoryService';

// Express Request type extension for tests
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        name: string;
        role: string;
        is_active: boolean;
        supabase_uid: string;
      };
    }
  }
}

// inventoryServiceのモック
jest.mock('../../../src/plots/services/inventoryService');

// PrismaClientのモック
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({})),
}));

describe('Inventory Controllers', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn().mockReturnThis();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    mockResponse = {
      status: statusMock,
      json: jsonMock,
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getInventorySummary', () => {
    beforeEach(() => {
      mockRequest = {
        query: {},
      };
    });

    it('全体サマリーを正常に返すこと', async () => {
      const mockSummary = {
        totalCount: 100,
        usedCount: 80,
        remainingCount: 20,
        usageRate: 80.0,
        totalAreaSqm: 360.0,
        remainingAreaSqm: 72.0,
        lastUpdated: '2025-01-01T00:00:00.000Z',
      };

      (inventoryService.getOverallSummary as jest.Mock).mockResolvedValue(mockSummary);

      await getInventorySummary(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: mockSummary,
      });
    });

    it('エラー時に500を返すこと', async () => {
      (inventoryService.getOverallSummary as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      await getInventorySummary(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '在庫サマリーの取得中にエラーが発生しました',
        },
      });
    });
  });

  describe('getInventoryPeriods', () => {
    it('全期のサマリーを返すこと', async () => {
      mockRequest = {
        query: {},
      };

      const mockPeriods = [
        { period: '1期', totalCount: 50, usedCount: 40, remainingCount: 10, usageRate: 80.0 },
        { period: '2期', totalCount: 30, usedCount: 25, remainingCount: 5, usageRate: 83.3 },
      ];

      (inventoryService.getPeriodSummaries as jest.Mock).mockResolvedValue(mockPeriods);

      await getInventoryPeriods(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: {
          periods: mockPeriods,
        },
      });
    });

    it('特定期のサマリーを返すこと', async () => {
      mockRequest = {
        query: { period: '1期' },
      };

      const mockPeriods = [
        { period: '1期', totalCount: 50, usedCount: 40, remainingCount: 10, usageRate: 80.0 },
      ];

      (inventoryService.getPeriodSummaries as jest.Mock).mockResolvedValue(mockPeriods);

      await getInventoryPeriods(mockRequest as Request, mockResponse as Response);

      expect(inventoryService.getPeriodSummaries).toHaveBeenCalledWith(expect.anything(), '1期');
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it('エラー時に500を返すこと', async () => {
      mockRequest = { query: {} };
      (inventoryService.getPeriodSummaries as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      await getInventoryPeriods(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe('getInventorySections', () => {
    it('セクション別集計を返すこと', async () => {
      mockRequest = {
        query: {
          page: '1',
          limit: '20',
        },
      };

      const mockItems = [
        {
          period: '1期',
          section: 'A',
          totalCount: 10,
          usedCount: 8,
          remainingCount: 2,
          usageRate: 80.0,
        },
      ];

      (inventoryService.getSectionInventory as jest.Mock).mockResolvedValue({
        items: mockItems,
        total: 1,
      });

      await getInventorySections(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: {
          items: mockItems,
          pagination: {
            page: 1,
            limit: 20,
            total: 1,
            totalPages: 1,
          },
        },
      });
    });

    it('フィルタリングパラメータを正しく渡すこと', async () => {
      mockRequest = {
        query: {
          period: '1期',
          status: 'available',
          search: 'A',
          sortBy: 'usageRate',
          sortOrder: 'desc',
          page: '2',
          limit: '10',
        },
      };

      (inventoryService.getSectionInventory as jest.Mock).mockResolvedValue({
        items: [],
        total: 0,
      });

      await getInventorySections(mockRequest as Request, mockResponse as Response);

      expect(inventoryService.getSectionInventory).toHaveBeenCalledWith(expect.anything(), {
        period: '1期',
        status: 'available',
        search: 'A',
        sortBy: 'usageRate',
        sortOrder: 'desc',
        page: 2,
        limit: 10,
      });
    });

    it('ページネーションが正しく計算されること', async () => {
      mockRequest = {
        query: {
          page: '2',
          limit: '10',
        },
      };

      (inventoryService.getSectionInventory as jest.Mock).mockResolvedValue({
        items: [],
        total: 25,
      });

      await getInventorySections(mockRequest as Request, mockResponse as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: {
          items: [],
          pagination: {
            page: 2,
            limit: 10,
            total: 25,
            totalPages: 3,
          },
        },
      });
    });

    it('エラー時に500を返すこと', async () => {
      mockRequest = { query: {} };
      (inventoryService.getSectionInventory as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      await getInventorySections(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe('getInventoryAreas', () => {
    it('面積別集計を返すこと', async () => {
      mockRequest = {
        query: {
          page: '1',
          limit: '20',
        },
      };

      const mockItems = [
        {
          period: '1期',
          areaSqm: 3.6,
          totalCount: 10,
          usedCount: 8,
          remainingCount: 2,
          remainingAreaSqm: 7.2,
          plotType: '自由',
        },
      ];

      (inventoryService.getAreaInventory as jest.Mock).mockResolvedValue({
        items: mockItems,
        total: 1,
      });

      await getInventoryAreas(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: {
          items: mockItems,
          pagination: {
            page: 1,
            limit: 20,
            total: 1,
            totalPages: 1,
          },
        },
      });
    });

    it('フィルタリングパラメータを正しく渡すこと', async () => {
      mockRequest = {
        query: {
          period: '2期',
          search: '3.6',
          sortBy: 'areaSqm',
          sortOrder: 'asc',
          page: '1',
          limit: '15',
        },
      };

      (inventoryService.getAreaInventory as jest.Mock).mockResolvedValue({
        items: [],
        total: 0,
      });

      await getInventoryAreas(mockRequest as Request, mockResponse as Response);

      expect(inventoryService.getAreaInventory).toHaveBeenCalledWith(expect.anything(), {
        period: '2期',
        search: '3.6',
        sortBy: 'areaSqm',
        sortOrder: 'asc',
        page: 1,
        limit: 15,
      });
    });

    it('エラー時に500を返すこと', async () => {
      mockRequest = { query: {} };
      (inventoryService.getAreaInventory as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      await getInventoryAreas(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });
});
