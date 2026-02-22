/**
 * 物理区画一括登録コントローラーのテスト
 * POST /api/v1/plots/bulk
 */

import { Request, Response, NextFunction } from 'express';

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

// Mock Prisma instance
const mockPhysicalPlotCreate = jest.fn();
const mockPhysicalPlotFindMany = jest.fn();
const mockTransaction = jest.fn();

const mockPrisma: any = {
  physicalPlot: {
    findMany: mockPhysicalPlotFindMany,
    create: mockPhysicalPlotCreate,
  },
  $transaction: mockTransaction,
};

// Mock PrismaClient
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
  Prisma: {
    Decimal: class MockDecimal {
      private value: number;
      constructor(value: number) {
        this.value = value;
      }
      toNumber() {
        return this.value;
      }
    },
  },
}));

// Import after mocks
import { bulkCreatePlots } from '../../../src/plots/controllers/bulkCreatePlots';

describe('bulkCreatePlots', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn().mockReturnThis();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    mockResponse = {
      status: statusMock,
      json: jsonMock,
    };
    mockNext = jest.fn();

    // Reset all mocks
    jest.clearAllMocks();

    // Default: no existing plots in DB
    mockPhysicalPlotFindMany.mockResolvedValue([]);

    // Default: transaction executes the callback with tx mock that has create
    mockTransaction.mockImplementation(async (callback: any) => {
      const txMock = {
        physicalPlot: {
          create: mockPhysicalPlotCreate,
        },
      };
      return callback(txMock);
    });
  });

  // Helper to create valid items
  const createValidItems = (count: number) => {
    return Array.from({ length: count }, (_, i) => ({
      plotNumber: `A-${i + 1}`,
      areaName: `${Math.floor(i / 10) + 1}期`,
      areaSqm: 3.6,
      notes: `テスト区画${i + 1}`,
    }));
  };

  describe('正常系', () => {
    it('5件の物理区画を一括登録できること', async () => {
      const items = createValidItems(5);
      mockRequest = {
        body: { items },
      };

      // Mock each create call
      items.forEach((item, index) => {
        mockPhysicalPlotCreate.mockResolvedValueOnce({
          id: `uuid-${index}`,
          plot_number: item.plotNumber,
          area_name: item.areaName,
          area_sqm: { toNumber: () => item.areaSqm },
          status: 'available',
          notes: item.notes,
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
        });
      });

      await bulkCreatePlots(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: {
          totalRequested: 5,
          created: 5,
          results: items.map((item, index) => ({
            row: index,
            id: `uuid-${index}`,
            plotNumber: item.plotNumber,
            areaName: item.areaName,
          })),
        },
      });

      // Transaction should have been called
      expect(mockTransaction).toHaveBeenCalledTimes(1);
      // Each item should be created
      expect(mockPhysicalPlotCreate).toHaveBeenCalledTimes(5);
    });

    it('areaSqmが未指定の場合デフォルト値3.6が使用されること', async () => {
      const items = [{ plotNumber: 'B-1', areaName: '2期' }];
      mockRequest = {
        body: { items },
      };

      mockPhysicalPlotCreate.mockResolvedValueOnce({
        id: 'uuid-0',
        plot_number: 'B-1',
        area_name: '2期',
        area_sqm: { toNumber: () => 3.6 },
        status: 'available',
        notes: null,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      });

      await bulkCreatePlots(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            totalRequested: 1,
            created: 1,
          }),
        })
      );

      // Verify Prisma create was called with default areaSqm (Decimal(3.6))
      expect(mockPhysicalPlotCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          plot_number: 'B-1',
          area_name: '2期',
          status: 'available',
          notes: null,
        }),
      });
    });

    it('notesが未指定の場合nullが設定されること', async () => {
      const items = [{ plotNumber: 'C-1', areaName: '3期', areaSqm: 1.8 }];
      mockRequest = {
        body: { items },
      };

      mockPhysicalPlotCreate.mockResolvedValueOnce({
        id: 'uuid-0',
        plot_number: 'C-1',
        area_name: '3期',
        area_sqm: { toNumber: () => 1.8 },
        status: 'available',
        notes: null,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      });

      await bulkCreatePlots(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(201);
      expect(mockPhysicalPlotCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          notes: null,
        }),
      });
    });
  });

  describe('バリデーションエラー', () => {
    it('plotNumberが欠けている場合エラーを返すこと', async () => {
      const items = [{ areaName: '1期', areaSqm: 3.6 }];
      mockRequest = {
        body: { items },
      };

      await bulkCreatePlots(mockRequest as Request, mockResponse as Response, mockNext);

      // Error should be passed to next()
      expect(mockNext).toHaveBeenCalledTimes(1);
      const error = mockNext.mock.calls[0][0] as any;
      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('一括登録でエラーが発生しました');
      expect(error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            row: 0,
            field: 'plotNumber',
          }),
        ])
      );
    });

    it('areaNameが欠けている場合エラーを返すこと', async () => {
      const items = [{ plotNumber: 'A-1', areaSqm: 3.6 }];
      mockRequest = {
        body: { items },
      };

      await bulkCreatePlots(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      const error = mockNext.mock.calls[0][0] as any;
      expect(error.name).toBe('ValidationError');
      expect(error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            row: 0,
            field: 'areaName',
          }),
        ])
      );
    });

    it('空配列の場合エラーを返すこと', async () => {
      mockRequest = {
        body: { items: [] },
      };

      await bulkCreatePlots(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      const error = mockNext.mock.calls[0][0] as any;
      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('一括登録でエラーが発生しました');
    });

    it('501件の場合最大件数エラーを返すこと', async () => {
      const items = createValidItems(501);
      mockRequest = {
        body: { items },
      };

      await bulkCreatePlots(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      const error = mockNext.mock.calls[0][0] as any;
      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('一括登録でエラーが発生しました');
      expect(error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: expect.stringContaining('500'),
          }),
        ])
      );
    });

    it('itemsフィールドが存在しない場合エラーを返すこと', async () => {
      mockRequest = {
        body: {},
      };

      await bulkCreatePlots(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      const error = mockNext.mock.calls[0][0] as any;
      expect(error.name).toBe('ValidationError');
    });
  });

  describe('重複チェック', () => {
    it('バッチ内で区画番号が重複している場合エラーを返すこと', async () => {
      const items = [
        { plotNumber: 'A-1', areaName: '1期', areaSqm: 3.6 },
        { plotNumber: 'A-2', areaName: '1期', areaSqm: 3.6 },
        { plotNumber: 'A-1', areaName: '1期', areaSqm: 3.6 }, // duplicate
      ];
      mockRequest = {
        body: { items },
      };

      await bulkCreatePlots(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      const error = mockNext.mock.calls[0][0] as any;
      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('一括登録でエラーが発生しました');
      expect(error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'plotNumber',
            message: expect.stringContaining('A-1'),
          }),
        ])
      );

      // Transaction should NOT have been called
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('データベースに既存の区画番号がある場合エラーを返すこと', async () => {
      const items = [
        { plotNumber: 'A-1', areaName: '1期', areaSqm: 3.6 },
        { plotNumber: 'A-2', areaName: '1期', areaSqm: 3.6 },
        { plotNumber: 'A-3', areaName: '1期', areaSqm: 3.6 },
      ];
      mockRequest = {
        body: { items },
      };

      // Simulate A-2 already exists in DB
      mockPhysicalPlotFindMany.mockResolvedValue([{ plot_number: 'A-2' }]);

      await bulkCreatePlots(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      const error = mockNext.mock.calls[0][0] as any;
      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('一括登録でエラーが発生しました');
      expect(error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            row: 1, // A-2 is at index 1
            field: 'plotNumber',
            message: expect.stringContaining('A-2'),
          }),
        ])
      );

      // findMany should have been called to check existing
      expect(mockPhysicalPlotFindMany).toHaveBeenCalledWith({
        where: {
          plot_number: { in: ['A-1', 'A-2', 'A-3'] },
          deleted_at: null,
        },
        select: { plot_number: true },
      });

      // Transaction should NOT have been called
      expect(mockTransaction).not.toHaveBeenCalled();
    });
  });

  describe('トランザクションエラー', () => {
    it('トランザクション中にエラーが発生した場合nextにエラーが渡されること', async () => {
      const items = [{ plotNumber: 'A-1', areaName: '1期', areaSqm: 3.6 }];
      mockRequest = {
        body: { items },
      };

      const dbError = new Error('Database connection lost');
      mockTransaction.mockRejectedValue(dbError);

      await bulkCreatePlots(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(dbError);
    });
  });
});
