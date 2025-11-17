import { Request, Response } from 'express';

// Express.Request型を拡張（認証ミドルウェアで使用される型定義）
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

// モックデータの定義
const mockUsageStatusData = [
  { id: 1, code: 'in_use', name: '使用中', description: null, sort_order: 1, is_active: true },
  { id: 2, code: 'available', name: '空き', description: null, sort_order: 2, is_active: true },
];

const mockCemeteryTypeData = [
  { id: 1, code: 'public', name: '公営', description: null, sort_order: 1, is_active: true },
  { id: 2, code: 'private', name: '民営', description: null, sort_order: 2, is_active: true },
];

const mockTaxTypeData = [
  { id: 1, code: 'included', name: '税込', description: null, sort_order: 1, is_active: true, tax_rate: 10.0 },
  { id: 2, code: 'excluded', name: '税抜', description: null, sort_order: 2, is_active: true, tax_rate: null },
];

const mockPrefectureData = [
  { id: 1, code: '01', name: '北海道', name_kana: 'ほっかいどう', sort_order: 1, is_active: true },
  { id: 2, code: '13', name: '東京都', name_kana: 'とうきょうと', sort_order: 13, is_active: true },
];

// モックプリズマインスタンスの作成
const mockPrisma: any = {
  usageStatusMaster: {
    findMany: jest.fn(),
  },
  cemeteryTypeMaster: {
    findMany: jest.fn(),
  },
  denominationMaster: {
    findMany: jest.fn(),
  },
  genderMaster: {
    findMany: jest.fn(),
  },
  paymentMethodMaster: {
    findMany: jest.fn(),
  },
  taxTypeMaster: {
    findMany: jest.fn(),
  },
  calcTypeMaster: {
    findMany: jest.fn(),
  },
  billingTypeMaster: {
    findMany: jest.fn(),
  },
  accountTypeMaster: {
    findMany: jest.fn(),
  },
  recipientTypeMaster: {
    findMany: jest.fn(),
  },
  relationMaster: {
    findMany: jest.fn(),
  },
  constructionTypeMaster: {
    findMany: jest.fn(),
  },
  updateTypeMaster: {
    findMany: jest.fn(),
  },
  prefectureMaster: {
    findMany: jest.fn(),
  },
};

// PrismaClientをモック化
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

// テスト対象のコントローラーをインポート
import {
  getUsageStatusMaster,
  getCemeteryTypeMaster,
  getTaxTypeMaster,
  getPrefectureMaster,
  getAllMasters,
} from '../../src/masters/masterController';

describe('Master Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    mockRequest = {};
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('getUsageStatusMaster', () => {
    it('使用状況マスタデータを正常に取得できること', async () => {
      mockPrisma.usageStatusMaster.findMany.mockResolvedValue(mockUsageStatusData);

      await getUsageStatusMaster(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.usageStatusMaster.findMany).toHaveBeenCalledWith({
        where: { is_active: true },
        orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
      });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: [
          {
            id: 1,
            code: 'in_use',
            name: '使用中',
            description: null,
            sortOrder: 1,
            isActive: true,
          },
          {
            id: 2,
            code: 'available',
            name: '空き',
            description: null,
            sortOrder: 2,
            isActive: true,
          },
        ],
      });
    });

    it('エラーが発生した場合、500エラーを返すこと', async () => {
      mockPrisma.usageStatusMaster.findMany.mockRejectedValue(new Error('Database error'));

      await getUsageStatusMaster(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '使用状況マスタの取得に失敗しました',
        },
      });
    });
  });

  describe('getCemeteryTypeMaster', () => {
    it('墓地タイプマスタデータを正常に取得できること', async () => {
      mockPrisma.cemeteryTypeMaster.findMany.mockResolvedValue(mockCemeteryTypeData);

      await getCemeteryTypeMaster(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.cemeteryTypeMaster.findMany).toHaveBeenCalledWith({
        where: { is_active: true },
        orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
      });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: [
          {
            id: 1,
            code: 'public',
            name: '公営',
            description: null,
            sortOrder: 1,
            isActive: true,
          },
          {
            id: 2,
            code: 'private',
            name: '民営',
            description: null,
            sortOrder: 2,
            isActive: true,
          },
        ],
      });
    });

    it('エラーが発生した場合、500エラーを返すこと', async () => {
      mockPrisma.cemeteryTypeMaster.findMany.mockRejectedValue(new Error('Database error'));

      await getCemeteryTypeMaster(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '墓地タイプマスタの取得に失敗しました',
        },
      });
    });
  });

  describe('getTaxTypeMaster', () => {
    it('税タイプマスタデータ（taxRate含む）を正常に取得できること', async () => {
      mockPrisma.taxTypeMaster.findMany.mockResolvedValue(mockTaxTypeData);

      await getTaxTypeMaster(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.taxTypeMaster.findMany).toHaveBeenCalledWith({
        where: { is_active: true },
        orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
      });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: [
          {
            id: 1,
            code: 'included',
            name: '税込',
            description: null,
            sortOrder: 1,
            isActive: true,
            taxRate: '10',
          },
          {
            id: 2,
            code: 'excluded',
            name: '税抜',
            description: null,
            sortOrder: 2,
            isActive: true,
            taxRate: null,
          },
        ],
      });
    });

    it('エラーが発生した場合、500エラーを返すこと', async () => {
      mockPrisma.taxTypeMaster.findMany.mockRejectedValue(new Error('Database error'));

      await getTaxTypeMaster(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '税タイプマスタの取得に失敗しました',
        },
      });
    });
  });

  describe('getPrefectureMaster', () => {
    it('都道府県マスタデータ（nameKana含む）を正常に取得できること', async () => {
      mockPrisma.prefectureMaster.findMany.mockResolvedValue(mockPrefectureData);

      await getPrefectureMaster(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.prefectureMaster.findMany).toHaveBeenCalledWith({
        where: { is_active: true },
        orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
      });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: [
          {
            id: 1,
            code: '01',
            name: '北海道',
            description: null,
            sortOrder: 1,
            isActive: true,
            nameKana: 'ほっかいどう',
          },
          {
            id: 2,
            code: '13',
            name: '東京都',
            description: null,
            sortOrder: 13,
            isActive: true,
            nameKana: 'とうきょうと',
          },
        ],
      });
    });

    it('エラーが発生した場合、500エラーを返すこと', async () => {
      mockPrisma.prefectureMaster.findMany.mockRejectedValue(new Error('Database error'));

      await getPrefectureMaster(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '都道府県マスタの取得に失敗しました',
        },
      });
    });
  });

  describe('getAllMasters', () => {
    it('全マスタデータを一括取得できること', async () => {
      // すべてのマスターテーブルのモックを設定
      mockPrisma.usageStatusMaster.findMany.mockResolvedValue(mockUsageStatusData);
      mockPrisma.cemeteryTypeMaster.findMany.mockResolvedValue(mockCemeteryTypeData);
      mockPrisma.denominationMaster.findMany.mockResolvedValue([]);
      mockPrisma.genderMaster.findMany.mockResolvedValue([]);
      mockPrisma.paymentMethodMaster.findMany.mockResolvedValue([]);
      mockPrisma.taxTypeMaster.findMany.mockResolvedValue(mockTaxTypeData);
      mockPrisma.calcTypeMaster.findMany.mockResolvedValue([]);
      mockPrisma.billingTypeMaster.findMany.mockResolvedValue([]);
      mockPrisma.accountTypeMaster.findMany.mockResolvedValue([]);
      mockPrisma.recipientTypeMaster.findMany.mockResolvedValue([]);
      mockPrisma.relationMaster.findMany.mockResolvedValue([]);
      mockPrisma.constructionTypeMaster.findMany.mockResolvedValue([]);
      mockPrisma.updateTypeMaster.findMany.mockResolvedValue([]);
      mockPrisma.prefectureMaster.findMany.mockResolvedValue(mockPrefectureData);

      await getAllMasters(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          usageStatus: expect.any(Array),
          cemeteryType: expect.any(Array),
          denomination: expect.any(Array),
          gender: expect.any(Array),
          paymentMethod: expect.any(Array),
          taxType: expect.any(Array),
          calcType: expect.any(Array),
          billingType: expect.any(Array),
          accountType: expect.any(Array),
          recipientType: expect.any(Array),
          relation: expect.any(Array),
          constructionType: expect.any(Array),
          updateType: expect.any(Array),
          prefecture: expect.any(Array),
        }),
      });
    });

    it('エラーが発生した場合、500エラーを返すこと', async () => {
      mockPrisma.usageStatusMaster.findMany.mockRejectedValue(new Error('Database error'));

      await getAllMasters(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '全マスタデータの取得に失敗しました',
        },
      });
    });
  });
});
