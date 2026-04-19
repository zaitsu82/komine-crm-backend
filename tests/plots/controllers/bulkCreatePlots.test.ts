/**
 * 区画一括登録コントローラーのテスト
 * POST /api/v1/plots/bulk
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

  beforeEach(() => {
    jsonMock = jest.fn().mockReturnThis();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    mockResponse = { status: statusMock, json: jsonMock };
    mockNext = jest.fn();
    jest.clearAllMocks();

    mockPhysicalPlotFindMany.mockResolvedValue([]);

    // Default transaction: run the callback with a bare tx mock (child entity mocks added per-test)
    mockTransaction.mockImplementation(async (callback: any) => {
      const txMock = {
        familyContact: { create: jest.fn().mockResolvedValue({ id: 'fc-1', name: 'test' }) },
        buriedPerson: { create: jest.fn().mockResolvedValue({ id: 'bp-1', name: 'test' }) },
        constructionInfo: {
          create: jest.fn().mockResolvedValue({ id: 'ci-1', construction_type: null }),
        },
      };
      return callback(txMock);
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
          created: 3,
          results: expect.arrayContaining([
            expect.objectContaining({ row: 0, plotNumber: 'A-1' }),
            expect.objectContaining({ row: 1, plotNumber: 'A-2' }),
            expect.objectContaining({ row: 2, plotNumber: 'A-3' }),
          ]),
        },
      });
      expect(mockCreatePlotCore).toHaveBeenCalledTimes(3);
    });

    it('familyContacts / buriedPersons / constructionInfos を含む複合登録ができること', async () => {
      const fcCreateSpy = jest.fn().mockResolvedValue({ id: 'fc-1', name: '家族' });
      const bpCreateSpy = jest.fn().mockResolvedValue({ id: 'bp-1', name: '埋葬' });
      const ciCreateSpy = jest.fn().mockResolvedValue({ id: 'ci-1', construction_type: '工事' });

      mockTransaction.mockImplementation(async (callback: any) => {
        const txMock = {
          familyContact: { create: fcCreateSpy },
          buriedPerson: { create: bpCreateSpy },
          constructionInfo: { create: ciCreateSpy },
        };
        return callback(txMock);
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
      expect(fcCreateSpy).toHaveBeenCalledTimes(1);
      expect(bpCreateSpy).toHaveBeenCalledTimes(1);
      expect(ciCreateSpy).toHaveBeenCalledTimes(1);
    });

    it('familyContacts で必須フィールド欠如の行はスキップされること', async () => {
      const fcCreateSpy = jest.fn().mockResolvedValue({ id: 'fc-1', name: '家族' });
      mockTransaction.mockImplementation(async (callback: any) => {
        const txMock = {
          familyContact: { create: fcCreateSpy },
          buriedPerson: { create: jest.fn() },
          constructionInfo: { create: jest.fn() },
        };
        return callback(txMock);
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
      expect(fcCreateSpy).toHaveBeenCalledTimes(1);
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

  describe('重複チェック', () => {
    it('バッチ内で区画番号が重複している場合エラーを返すこと', async () => {
      const items = [buildValidItem('A-1'), buildValidItem('A-2'), buildValidItem('A-1')];
      mockRequest = { body: { items } };

      await bulkCreatePlots(mockRequest as Request, mockResponse as Response, mockNext);

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

    it('DB に既存の区画番号がある場合エラーを返すこと', async () => {
      const items = ['A-1', 'A-2', 'A-3'].map((pn) => buildValidItem(pn));
      mockRequest = { body: { items } };

      mockPhysicalPlotFindMany.mockResolvedValue([{ plot_number: 'A-2' }]);

      await bulkCreatePlots(mockRequest as Request, mockResponse as Response, mockNext);

      const error = mockNext.mock.calls[0]![0] as any;
      expect(error.name).toBe('ValidationError');
      expect(error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            row: 1,
            field: 'plotNumber',
            message: expect.stringContaining('A-2'),
          }),
        ])
      );
      expect(mockTransaction).not.toHaveBeenCalled();
    });
  });

  describe('トランザクションエラー', () => {
    it('DB エラーが発生した場合 next にエラーが渡されること', async () => {
      mockRequest = { body: { items: [buildValidItem('A-1')] } };

      const dbError = new Error('Database connection lost');
      mockTransaction.mockRejectedValue(dbError);

      await bulkCreatePlots(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(dbError);
    });

    it('createPlotCore が ValidationError を投げた場合、行番号付きで再スローされること', async () => {
      mockRequest = { body: { items: [buildValidItem('A-1'), buildValidItem('A-2')] } };

      const { ValidationError } = jest.requireActual('../../../src/middleware/errorHandler');
      mockCreatePlotCore
        .mockImplementationOnce(async (_tx: any, item: any) => ({
          contractPlotId: 'cp-1',
          physicalPlotId: 'pp-1',
          customerId: 'cu-1',
          _item: item,
        }))
        .mockImplementationOnce(async () => {
          throw new ValidationError('契約面積エラー', [
            { field: 'contractAreaSqm', message: '面積エラー' },
          ]);
        });

      await bulkCreatePlots(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      const error = mockNext.mock.calls[0]![0] as any;
      expect(error.name).toBe('ValidationError');
      expect(error.message).toContain('行 1');
      expect(error.details).toEqual(expect.arrayContaining([expect.objectContaining({ row: 1 })]));
    });
  });
});
