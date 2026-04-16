/**
 * 区画一括編集コントローラーのテスト
 * PUT /api/v1/plots/bulk
 */

import { Request, Response, NextFunction } from 'express';

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

const mockPhysicalPlotFindMany = jest.fn();
const mockTransaction = jest.fn();

const mockPrisma: any = {
  physicalPlot: { findMany: mockPhysicalPlotFindMany },
  $transaction: mockTransaction,
};

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

jest.mock('../../../src/db/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

const mockUpdatePlotCore = jest.fn();
jest.mock('../../../src/plots/controllers/updatePlot', () => ({
  updatePlotCore: (...args: unknown[]) => mockUpdatePlotCore(...args),
  updatePlot: jest.fn(),
}));

import { bulkUpdatePlots } from '../../../src/plots/controllers/bulkUpdatePlots';

describe('bulkUpdatePlots', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn().mockReturnThis();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    mockResponse = { status: statusMock, json: jsonMock };
    mockNext = jest.fn();
    jest.clearAllMocks();

    mockTransaction.mockImplementation(async (callback: any) => {
      return callback({});
    });
    mockUpdatePlotCore.mockResolvedValue(undefined);
  });

  const buildValidItem = (plotNumber: string, overrides: Record<string, unknown> = {}) => ({
    plotNumber,
    customer: { name: '新しい名前' },
    ...overrides,
  });

  describe('正常系', () => {
    it('既存契約を plotNumber マッチングで一括更新できること', async () => {
      mockPhysicalPlotFindMany.mockResolvedValue([
        { plot_number: 'A-1', contractPlots: [{ id: 'cp-1' }] },
        { plot_number: 'A-2', contractPlots: [{ id: 'cp-2' }] },
      ]);

      mockRequest = {
        body: { items: [buildValidItem('A-1'), buildValidItem('A-2')] },
      };

      await bulkUpdatePlots(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: {
          totalRequested: 2,
          updated: 2,
          results: [
            { row: 0, id: 'cp-1', plotNumber: 'A-1' },
            { row: 1, id: 'cp-2', plotNumber: 'A-2' },
          ],
        },
      });
      expect(mockUpdatePlotCore).toHaveBeenCalledTimes(2);
    });

    it('未指定フィールドは updatePlotCore に undefined として渡されること（部分更新仕様）', async () => {
      mockPhysicalPlotFindMany.mockResolvedValue([
        { plot_number: 'A-1', contractPlots: [{ id: 'cp-1' }] },
      ]);
      mockRequest = {
        body: { items: [{ plotNumber: 'A-1', customer: { name: '新名称' } }] },
      };

      await bulkUpdatePlots(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      const callArgs = mockUpdatePlotCore.mock.calls[0];
      expect(callArgs![1]).toBe('cp-1');
      const input = callArgs![2];
      expect(input.customer).toEqual({ name: '新名称' });
      expect(input.physicalPlot).toBeUndefined();
      expect(input.contractPlot).toBeUndefined();
      expect(input.plotNumber).toBeUndefined();
    });
  });

  describe('バリデーションエラー', () => {
    it('plotNumber が欠けている場合エラーを返すこと', async () => {
      mockRequest = { body: { items: [{ customer: { name: 'X' } }] } };

      await bulkUpdatePlots(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      const error = mockNext.mock.calls[0]![0] as any;
      expect(error.name).toBe('ValidationError');
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('空配列の場合エラーを返すこと', async () => {
      mockRequest = { body: { items: [] } };

      await bulkUpdatePlots(mockRequest as Request, mockResponse as Response, mockNext);

      const error = mockNext.mock.calls[0]![0] as any;
      expect(error.name).toBe('ValidationError');
    });

    it('501件の場合最大件数エラーを返すこと', async () => {
      const items = Array.from({ length: 501 }, (_, i) => buildValidItem(`A-${i}`));
      mockRequest = { body: { items } };

      await bulkUpdatePlots(mockRequest as Request, mockResponse as Response, mockNext);

      const error = mockNext.mock.calls[0]![0] as any;
      expect(error.name).toBe('ValidationError');
      expect(error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ message: expect.stringContaining('500') }),
        ])
      );
    });
  });

  describe('マッチングエラー', () => {
    it('バッチ内で plotNumber が重複している場合エラーを返すこと', async () => {
      mockRequest = {
        body: { items: [buildValidItem('A-1'), buildValidItem('A-1')] },
      };

      await bulkUpdatePlots(mockRequest as Request, mockResponse as Response, mockNext);

      const error = mockNext.mock.calls[0]![0] as any;
      expect(error.name).toBe('ValidationError');
      expect(error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'plotNumber',
            message: expect.stringContaining('A-1'),
          }),
        ])
      );
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('DB に plotNumber が存在しない場合エラーを返すこと', async () => {
      mockPhysicalPlotFindMany.mockResolvedValue([
        { plot_number: 'A-1', contractPlots: [{ id: 'cp-1' }] },
      ]);
      mockRequest = {
        body: { items: [buildValidItem('A-1'), buildValidItem('A-2')] },
      };

      await bulkUpdatePlots(mockRequest as Request, mockResponse as Response, mockNext);

      const error = mockNext.mock.calls[0]![0] as any;
      expect(error.name).toBe('ValidationError');
      expect(error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'plotNumber',
            message: expect.stringContaining('A-2'),
          }),
        ])
      );
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('PhysicalPlot はあるが有効な契約が無い場合エラーを返すこと', async () => {
      mockPhysicalPlotFindMany.mockResolvedValue([{ plot_number: 'A-1', contractPlots: [] }]);
      mockRequest = { body: { items: [buildValidItem('A-1')] } };

      await bulkUpdatePlots(mockRequest as Request, mockResponse as Response, mockNext);

      const error = mockNext.mock.calls[0]![0] as any;
      expect(error.name).toBe('ValidationError');
      expect(error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: expect.stringContaining('有効な契約区画'),
          }),
        ])
      );
    });
  });

  describe('トランザクションエラー', () => {
    it('updatePlotCore が ValidationError を投げた場合、行番号付きで再スローされること', async () => {
      mockPhysicalPlotFindMany.mockResolvedValue([
        { plot_number: 'A-1', contractPlots: [{ id: 'cp-1' }] },
        { plot_number: 'A-2', contractPlots: [{ id: 'cp-2' }] },
      ]);
      mockRequest = {
        body: { items: [buildValidItem('A-1'), buildValidItem('A-2')] },
      };

      const { ValidationError } = jest.requireActual('../../../src/middleware/errorHandler');
      mockUpdatePlotCore
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(
          new ValidationError('契約面積エラー', [{ field: 'contractAreaSqm', message: 'xxx' }])
        );

      await bulkUpdatePlots(mockRequest as Request, mockResponse as Response, mockNext);

      const error = mockNext.mock.calls[0]![0] as any;
      expect(error.name).toBe('ValidationError');
      expect(error.message).toContain('行 1');
      expect(error.details).toEqual(expect.arrayContaining([expect.objectContaining({ row: 1 })]));
    });

    it('DB エラーが発生した場合 next にエラーが渡されること', async () => {
      mockPhysicalPlotFindMany.mockResolvedValue([
        { plot_number: 'A-1', contractPlots: [{ id: 'cp-1' }] },
      ]);
      mockRequest = { body: { items: [buildValidItem('A-1')] } };

      const dbError = new Error('Database connection lost');
      mockTransaction.mockRejectedValue(dbError);

      await bulkUpdatePlots(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(dbError);
    });
  });
});
