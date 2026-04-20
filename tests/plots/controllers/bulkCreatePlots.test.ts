/**
 * 区画一括登録コントローラーのテスト
 * POST /api/v1/plots/bulk
 *
 * Phase 1 (issue #76): 1 件ごと独立 tx・部分成功レスポンス対応
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

// Mock Prisma
const mockPhysicalPlotFindMany = jest.fn();
const mockTransaction = jest.fn();

const mockPrisma: any = {
  physicalPlot: {
    findMany: mockPhysicalPlotFindMany,
  },
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
  AddressType: { home: 'home', work: 'work' },
  Gender: { male: 'male', female: 'female' },
  PaymentStatus: { unpaid: 'unpaid', paid: 'paid' },
  ContractRole: { contractor: 'contractor', applicant: 'applicant' },
  DmSetting: { allow: 'allow', deny: 'deny' },
}));

// Mock db/prisma
jest.mock('../../../src/db/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

// Mock createPlotCore - we test it via createPlot tests elsewhere
const mockCreatePlotCore = jest.fn();
jest.mock('../../../src/plots/controllers/createPlot', () => ({
  createPlotCore: (...args: unknown[]) => mockCreatePlotCore(...args),
  createPlot: jest.fn(),
}));

// Mock history service
jest.mock('../../../src/plots/services/historyService', () => ({
  recordEntityCreated: jest.fn(),
}));

import { bulkCreatePlots } from '../../../src/plots/controllers/bulkCreatePlots';

describe('bulkCreatePlots', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  const buildTxMock = (extras: Record<string, any> = {}) => ({
    familyContact: {
      createManyAndReturn: jest.fn().mockResolvedValue([{ id: 'fc-1', name: 'test' }]),
    },
    buriedPerson: {
      createManyAndReturn: jest.fn().mockResolvedValue([{ id: 'bp-1', name: 'test' }]),
    },
    constructionInfo: {
      createManyAndReturn: jest.fn().mockResolvedValue([{ id: 'ci-1', construction_type: null }]),
    },
    ...extras,
  });

  beforeEach(() => {
    jsonMock = jest.fn().mockReturnThis();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    mockResponse = { status: statusMock, json: jsonMock };
    mockNext = jest.fn();
    jest.clearAllMocks();

    mockPhysicalPlotFindMany.mockResolvedValue([]);

    // 各 item が独立 tx を開くため、tx は複数回呼ばれうる
    mockTransaction.mockImplementation(async (callback: any) => {
      return callback(buildTxMock());
    });

    // Default: createPlotCore returns IDs
    mockCreatePlotCore.mockImplementation(async (_tx: unknown, item: any) => ({
      contractPlotId: `cp-${item.physicalPlot.plotNumber}`,
      physicalPlotId: `pp-${item.physicalPlot.plotNumber}`,
      customerId: `cu-${item.physicalPlot.plotNumber}`,
    }));
  });

  const buildValidItem = (plotNumber: string, overrides: Record<string, unknown> = {}) => ({
    physicalPlot: { plotNumber, areaName: '第1期', areaSqm: 3.6 },
    contractPlot: { contractAreaSqm: 3.6 },
    saleContract: { contractDate: '2026-04-01', price: 500000 },
    customer: {
      name: '田中太郎',
      nameKana: 'タナカタロウ',
      postalCode: '1600000',
      address: '東京都新宿区...',
      phoneNumber: '09012345678',
    },
    ...overrides,
  });

  describe('正常系', () => {
    it('3件の区画を一括登録できること', async () => {
      const items = ['A-1', 'A-2', 'A-3'].map((pn) => buildValidItem(pn));
      mockRequest = { body: { items } };

      await bulkCreatePlots(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: {
          totalRequested: 3,
          succeeded: 3,
          failed: [],
          results: expect.arrayContaining([
            expect.objectContaining({ row: 0, plotNumber: 'A-1' }),
            expect.objectContaining({ row: 1, plotNumber: 'A-2' }),
            expect.objectContaining({ row: 2, plotNumber: 'A-3' }),
          ]),
        },
      });
      expect(mockCreatePlotCore).toHaveBeenCalledTimes(3);
      // 1 件ごと独立 tx: transaction が items 数ぶん呼ばれる
      expect(mockTransaction).toHaveBeenCalledTimes(3);
    });

    it('familyContacts / buriedPersons / constructionInfos を含む複合登録ができること', async () => {
      const fcCreateSpy = jest.fn().mockResolvedValue([{ id: 'fc-1', name: '家族' }]);
      const bpCreateSpy = jest.fn().mockResolvedValue([{ id: 'bp-1', name: '埋葬' }]);
      const ciCreateSpy = jest.fn().mockResolvedValue([{ id: 'ci-1', construction_type: '工事' }]);

      mockTransaction.mockImplementation(async (callback: any) => {
        return callback({
          familyContact: { createManyAndReturn: fcCreateSpy },
          buriedPerson: { createManyAndReturn: bpCreateSpy },
          constructionInfo: { createManyAndReturn: ciCreateSpy },
        });
      });

      const item = buildValidItem('A-1', {
        familyContacts: [
          {
            name: '田中花子',
            relationship: '配偶者',
            address: '東京都新宿区...',
            phoneNumber: '09011112222',
          },
        ],
        buriedPersons: [{ name: '田中一郎', deathDate: '2020-03-15' }],
        constructionInfos: [{ constructionType: '新規建立' }],
      });
      mockRequest = { body: { items: [item] } };

      await bulkCreatePlots(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(201);
      // createManyAndReturn は 1 件でも呼ばれる（引数に 1 要素の配列）
      expect(fcCreateSpy).toHaveBeenCalledTimes(1);
      expect(bpCreateSpy).toHaveBeenCalledTimes(1);
      expect(ciCreateSpy).toHaveBeenCalledTimes(1);
    });

    it('familyContacts で必須フィールド欠如の行はスキップされること', async () => {
      const fcCreateSpy = jest.fn().mockResolvedValue([{ id: 'fc-1', name: '田中花子' }]);
      mockTransaction.mockImplementation(async (callback: any) => {
        return callback(buildTxMock({ familyContact: { createManyAndReturn: fcCreateSpy } }));
      });

      const item = buildValidItem('A-1', {
        familyContacts: [
          // name 欠如 → スキップされる
          { relationship: '配偶者', address: '...', phoneNumber: '09011112222' },
          // 全て揃っている
          {
            name: '田中花子',
            relationship: '配偶者',
            address: '東京都新宿区...',
            phoneNumber: '09011112222',
          },
        ],
      });
      mockRequest = { body: { items: [item] } };

      await bulkCreatePlots(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      // createManyAndReturn は 1 回呼ばれ、data は 1 件のみ
      expect(fcCreateSpy).toHaveBeenCalledTimes(1);
      const call = fcCreateSpy.mock.calls[0]![0] as { data: unknown[] };
      expect(call.data).toHaveLength(1);
    });
  });

  describe('バリデーションエラー', () => {
    it('physicalPlot が欠けている場合エラーを返すこと', async () => {
      const invalidItem: any = { contractPlot: { contractAreaSqm: 3.6 } };
      mockRequest = { body: { items: [invalidItem] } };

      await bulkCreatePlots(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      const error = mockNext.mock.calls[0]![0] as any;
      expect(error.name).toBe('ValidationError');
      expect(mockCreatePlotCore).not.toHaveBeenCalled();
    });

    it('空配列の場合エラーを返すこと', async () => {
      mockRequest = { body: { items: [] } };

      await bulkCreatePlots(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      const error = mockNext.mock.calls[0]![0] as any;
      expect(error.name).toBe('ValidationError');
    });

    it('501件の場合最大件数エラーを返すこと', async () => {
      const items = Array.from({ length: 501 }, (_, i) => buildValidItem(`A-${i}`));
      mockRequest = { body: { items } };

      await bulkCreatePlots(mockRequest as Request, mockResponse as Response, mockNext);

      const error = mockNext.mock.calls[0]![0] as any;
      expect(error.name).toBe('ValidationError');
      expect(error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ message: expect.stringContaining('500') }),
        ])
      );
    });
  });

  describe('部分成功（Phase 1）', () => {
    it('バッチ内で区画番号が重複している場合、後続出現行が failed に入る', async () => {
      const items = [buildValidItem('A-1'), buildValidItem('A-2'), buildValidItem('A-1')];
      mockRequest = { body: { items } };

      await bulkCreatePlots(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(201);
      const payload = jsonMock.mock.calls[0]![0];
      expect(payload.data.totalRequested).toBe(3);
      expect(payload.data.succeeded).toBe(2); // 行0, 行1 成功
      expect(payload.data.failed).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            row: 2,
            plotNumber: 'A-1',
            error: expect.objectContaining({ message: expect.stringContaining('A-1') }),
          }),
        ])
      );
      // 1 件目 (A-1), 2 件目 (A-2) のみ tx 実行
      expect(mockCreatePlotCore).toHaveBeenCalledTimes(2);
    });

    it('DB に既存の区画番号がある場合、該当行のみ failed に入る（他行は成功）', async () => {
      const items = ['A-1', 'A-2', 'A-3'].map((pn) => buildValidItem(pn));
      mockRequest = { body: { items } };

      mockPhysicalPlotFindMany.mockResolvedValue([{ plot_number: 'A-2' }]);

      await bulkCreatePlots(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      const payload = jsonMock.mock.calls[0]![0];
      expect(payload.data.totalRequested).toBe(3);
      expect(payload.data.succeeded).toBe(2);
      expect(payload.data.failed).toEqual([
        expect.objectContaining({
          row: 1,
          plotNumber: 'A-2',
          error: expect.objectContaining({ message: expect.stringContaining('A-2') }),
        }),
      ]);
      // A-2 はスキップされるので createPlotCore は 2 回のみ
      expect(mockCreatePlotCore).toHaveBeenCalledTimes(2);
    });

    it('createPlotCore が ValidationError を投げた場合、該当行のみ failed に入り他行は成功', async () => {
      mockRequest = { body: { items: [buildValidItem('A-1'), buildValidItem('A-2')] } };

      const { ValidationError } = jest.requireActual('../../../src/middleware/errorHandler');
      mockCreatePlotCore
        .mockImplementationOnce(async () => ({
          contractPlotId: 'cp-1',
          physicalPlotId: 'pp-1',
          customerId: 'cu-1',
        }))
        .mockImplementationOnce(async () => {
          throw new ValidationError('契約面積エラー', [
            { field: 'contractAreaSqm', message: '面積エラー' },
          ]);
        });

      await bulkCreatePlots(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      const payload = jsonMock.mock.calls[0]![0];
      expect(payload.data.totalRequested).toBe(2);
      expect(payload.data.succeeded).toBe(1);
      expect(payload.data.failed).toEqual([
        expect.objectContaining({
          row: 1,
          plotNumber: 'A-2',
          error: expect.objectContaining({
            message: expect.stringContaining('契約面積'),
            details: expect.arrayContaining([
              expect.objectContaining({ field: 'contractAreaSqm' }),
            ]),
          }),
        }),
      ]);
    });

    it('予期しないランタイムエラーも failed に記録され、他行は継続される', async () => {
      mockRequest = { body: { items: [buildValidItem('A-1'), buildValidItem('A-2')] } };

      mockCreatePlotCore
        .mockImplementationOnce(async () => {
          throw new Error('DB接続喪失');
        })
        .mockImplementationOnce(async () => ({
          contractPlotId: 'cp-2',
          physicalPlotId: 'pp-2',
          customerId: 'cu-2',
        }));

      await bulkCreatePlots(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      const payload = jsonMock.mock.calls[0]![0];
      expect(payload.data.succeeded).toBe(1);
      expect(payload.data.failed).toEqual([
        expect.objectContaining({
          row: 0,
          plotNumber: 'A-1',
          error: expect.objectContaining({ message: 'DB接続喪失' }),
        }),
      ]);
    });
  });
});
