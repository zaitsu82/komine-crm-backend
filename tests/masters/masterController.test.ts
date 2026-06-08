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
const mockCemeteryTypeData = [
  { id: 1, code: 'public', name: '公営', description: null, sort_order: 1, is_active: true },
  { id: 2, code: 'private', name: '民営', description: null, sort_order: 2, is_active: true },
];

const mockTaxTypeData = [
  {
    id: 1,
    code: 'included',
    name: '税込',
    description: null,
    sort_order: 1,
    is_active: true,
    tax_rate: 10.0,
  },
  {
    id: 2,
    code: 'excluded',
    name: '税抜',
    description: null,
    sort_order: 2,
    is_active: true,
    tax_rate: null,
  },
];

const mockPrefectureData = [
  { id: 1, code: '01', name: '北海道', name_kana: 'ほっかいどう', sort_order: 1, is_active: true },
  { id: 2, code: '13', name: '東京都', name_kana: 'とうきょうと', sort_order: 13, is_active: true },
];

const mockPaymentMethodData = [
  { id: 1, code: 'cash', name: '現金', description: null, sort_order: 1, is_active: true },
  { id: 2, code: 'transfer', name: '振込', description: null, sort_order: 2, is_active: true },
];

const mockCalcTypeData = [
  { id: 1, code: 'fixed', name: '固定', description: null, sort_order: 1, is_active: true },
  { id: 2, code: 'variable', name: '変動', description: null, sort_order: 2, is_active: true },
];

const mockBillingTypeData = [
  { id: 1, code: 'monthly', name: '月次', description: null, sort_order: 1, is_active: true },
  { id: 2, code: 'annual', name: '年次', description: null, sort_order: 2, is_active: true },
];

const mockRecipientTypeData = [
  { id: 1, code: 'individual', name: '個人', description: null, sort_order: 1, is_active: true },
  { id: 2, code: 'corporate', name: '法人', description: null, sort_order: 2, is_active: true },
];

const mockRelationData = [
  { id: 1, code: 'spouse', name: '配偶者', description: null, sort_order: 1, is_active: true },
  { id: 2, code: 'child', name: '子', description: null, sort_order: 2, is_active: true },
];

const mockConstructionTypeData = [
  { id: 1, code: 'new', name: '新設', description: null, sort_order: 1, is_active: true },
  { id: 2, code: 'repair', name: '修繕', description: null, sort_order: 2, is_active: true },
];

const mockSectionNameData = [
  {
    id: 1,
    code: '1-A',
    name: 'A',
    period: '第1期',
    description: null,
    sort_order: 1,
    is_active: true,
  },
  {
    id: 2,
    code: '2-1',
    name: '1',
    period: '第2期',
    description: null,
    sort_order: 18,
    is_active: true,
  },
];

const mockUpdateTypeData = [
  { id: 1, code: 'renewal', name: '更新', description: null, sort_order: 1, is_active: true },
  { id: 2, code: 'change', name: '変更', description: null, sort_order: 2, is_active: true },
];

const mockRelationshipData = [
  { id: 1, code: 'spouse', name: '配偶者', description: null, sort_order: 1, is_active: true },
  { id: 2, code: 'child', name: '子', description: null, sort_order: 2, is_active: true },
];

const mockContractorData = [
  {
    id: 1,
    code: 'placeholder-1',
    name: '小嶺石材',
    description: null,
    sort_order: 1,
    is_active: true,
  },
  {
    id: 2,
    code: 'placeholder-99',
    name: 'その他',
    description: null,
    sort_order: 99,
    is_active: true,
  },
];

const mockDirectionData = [
  { id: 1, code: '1', name: '東', description: null, sort_order: 1, is_active: true },
  { id: 2, code: '2', name: '西', description: null, sort_order: 2, is_active: true },
];

const mockPositionData = [
  { id: 1, code: '1', name: '角', description: null, sort_order: 1, is_active: true },
  { id: 2, code: '2', name: '端', description: null, sort_order: 2, is_active: true },
];

// モックプリズマインスタンスの作成
const mockPrisma: any = {
  cemeteryTypeMaster: {
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
  recipientTypeMaster: {
    findMany: jest.fn(),
  },
  constructionTypeMaster: {
    findMany: jest.fn(),
  },
  sectionNameMaster: {
    findMany: jest.fn(),
  },
  relationshipMaster: {
    findMany: jest.fn(),
  },
  contractorMaster: {
    findMany: jest.fn(),
  },
  directionMaster: {
    findMany: jest.fn(),
  },
  positionMaster: {
    findMany: jest.fn(),
  },
  validityPeriodMaster: {
    findMany: jest.fn(),
  },
  changeReasonMaster: {
    findMany: jest.fn(),
  },
};

// PrismaClientをモック化
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

// テスト対象のコントローラーをインポート
import {
  getCemeteryTypeMaster,
  getPaymentMethodMaster,
  getTaxTypeMaster,
  getCalcTypeMaster,
  getBillingTypeMaster,
  getRecipientTypeMaster,
  getConstructionTypeMaster,
  getSectionNameMaster,
  getRelationshipMaster,
  getContractorMaster,
  getDirectionMaster,
  getPositionMaster,
  getValidityPeriodMaster,
  getChangeReasonMaster,
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

    it('include_inactive=true で無効マスタも取得対象になること (#238)', async () => {
      mockPrisma.cemeteryTypeMaster.findMany.mockResolvedValue([]);
      mockRequest.query = { include_inactive: 'true' };

      await getCemeteryTypeMaster(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.cemeteryTypeMaster.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
      });

      mockRequest.query = {};
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

  describe('getPaymentMethodMaster', () => {
    it('支払方法マスタデータを正常に取得できること', async () => {
      mockPrisma.paymentMethodMaster.findMany.mockResolvedValue(mockPaymentMethodData);

      await getPaymentMethodMaster(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.paymentMethodMaster.findMany).toHaveBeenCalledWith({
        where: { is_active: true },
        orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
      });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: [
          {
            id: 1,
            code: 'cash',
            name: '現金',
            description: null,
            sortOrder: 1,
            isActive: true,
          },
          {
            id: 2,
            code: 'transfer',
            name: '振込',
            description: null,
            sortOrder: 2,
            isActive: true,
          },
        ],
      });
    });

    it('エラーが発生した場合、500エラーを返すこと', async () => {
      mockPrisma.paymentMethodMaster.findMany.mockRejectedValue(new Error('Database error'));

      await getPaymentMethodMaster(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '支払方法マスタの取得に失敗しました',
        },
      });
    });
  });

  describe('getCalcTypeMaster', () => {
    it('計算タイプマスタデータを正常に取得できること', async () => {
      mockPrisma.calcTypeMaster.findMany.mockResolvedValue(mockCalcTypeData);

      await getCalcTypeMaster(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.calcTypeMaster.findMany).toHaveBeenCalledWith({
        where: { is_active: true },
        orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
      });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: [
          {
            id: 1,
            code: 'fixed',
            name: '固定',
            description: null,
            sortOrder: 1,
            isActive: true,
          },
          {
            id: 2,
            code: 'variable',
            name: '変動',
            description: null,
            sortOrder: 2,
            isActive: true,
          },
        ],
      });
    });

    it('エラーが発生した場合、500エラーを返すこと', async () => {
      mockPrisma.calcTypeMaster.findMany.mockRejectedValue(new Error('Database error'));

      await getCalcTypeMaster(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '計算タイプマスタの取得に失敗しました',
        },
      });
    });
  });

  describe('getBillingTypeMaster', () => {
    it('請求タイプマスタデータを正常に取得できること', async () => {
      mockPrisma.billingTypeMaster.findMany.mockResolvedValue(mockBillingTypeData);

      await getBillingTypeMaster(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.billingTypeMaster.findMany).toHaveBeenCalledWith({
        where: { is_active: true },
        orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
      });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: [
          {
            id: 1,
            code: 'monthly',
            name: '月次',
            description: null,
            sortOrder: 1,
            isActive: true,
          },
          {
            id: 2,
            code: 'annual',
            name: '年次',
            description: null,
            sortOrder: 2,
            isActive: true,
          },
        ],
      });
    });

    it('エラーが発生した場合、500エラーを返すこと', async () => {
      mockPrisma.billingTypeMaster.findMany.mockRejectedValue(new Error('Database error'));

      await getBillingTypeMaster(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '請求タイプマスタの取得に失敗しました',
        },
      });
    });
  });

  describe('getRecipientTypeMaster', () => {
    it('受取人タイプマスタデータを正常に取得できること', async () => {
      mockPrisma.recipientTypeMaster.findMany.mockResolvedValue(mockRecipientTypeData);

      await getRecipientTypeMaster(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.recipientTypeMaster.findMany).toHaveBeenCalledWith({
        where: { is_active: true },
        orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
      });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: [
          {
            id: 1,
            code: 'individual',
            name: '個人',
            description: null,
            sortOrder: 1,
            isActive: true,
          },
          {
            id: 2,
            code: 'corporate',
            name: '法人',
            description: null,
            sortOrder: 2,
            isActive: true,
          },
        ],
      });
    });

    it('エラーが発生した場合、500エラーを返すこと', async () => {
      mockPrisma.recipientTypeMaster.findMany.mockRejectedValue(new Error('Database error'));

      await getRecipientTypeMaster(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '受取人タイプマスタの取得に失敗しました',
        },
      });
    });
  });

  describe('getConstructionTypeMaster', () => {
    it('工事タイプマスタデータを正常に取得できること', async () => {
      mockPrisma.constructionTypeMaster.findMany.mockResolvedValue(mockConstructionTypeData);

      await getConstructionTypeMaster(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.constructionTypeMaster.findMany).toHaveBeenCalledWith({
        where: { is_active: true },
        orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
      });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: [
          {
            id: 1,
            code: 'new',
            name: '新設',
            description: null,
            sortOrder: 1,
            isActive: true,
          },
          {
            id: 2,
            code: 'repair',
            name: '修繕',
            description: null,
            sortOrder: 2,
            isActive: true,
          },
        ],
      });
    });

    it('エラーが発生した場合、500エラーを返すこと', async () => {
      mockPrisma.constructionTypeMaster.findMany.mockRejectedValue(new Error('Database error'));

      await getConstructionTypeMaster(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '工事タイプマスタの取得に失敗しました',
        },
      });
    });
  });

  describe('getSectionNameMaster', () => {
    it('区画名マスタデータを正しく取得・フォーマットすること', async () => {
      mockPrisma.sectionNameMaster.findMany.mockResolvedValue(mockSectionNameData);

      await getSectionNameMaster(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: [
          {
            id: 1,
            code: '1-A',
            name: 'A',
            period: '第1期',
            description: null,
            sortOrder: 1,
            isActive: true,
          },
          {
            id: 2,
            code: '2-1',
            name: '1',
            period: '第2期',
            description: null,
            sortOrder: 18,
            isActive: true,
          },
        ],
      });
    });

    it('エラーが発生した場合、500エラーを返すこと', async () => {
      mockPrisma.sectionNameMaster.findMany.mockRejectedValue(new Error('Database error'));

      await getSectionNameMaster(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '区画名マスタの取得に失敗しました',
        },
      });
    });
  });

  describe('getRelationshipMaster', () => {
    it('続柄マスタデータを正しく取得・フォーマットすること', async () => {
      mockPrisma.relationshipMaster.findMany.mockResolvedValue(mockRelationshipData);

      await getRelationshipMaster(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.relationshipMaster.findMany).toHaveBeenCalledWith({
        where: { is_active: true },
        orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
      });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: [
          {
            id: 1,
            code: 'spouse',
            name: '配偶者',
            description: null,
            sortOrder: 1,
            isActive: true,
          },
          {
            id: 2,
            code: 'child',
            name: '子',
            description: null,
            sortOrder: 2,
            isActive: true,
          },
        ],
      });
    });

    it('エラーが発生した場合、500エラーを返すこと', async () => {
      mockPrisma.relationshipMaster.findMany.mockRejectedValue(new Error('Database error'));

      await getRelationshipMaster(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '続柄マスタの取得に失敗しました',
        },
      });
    });
  });

  describe('getAllMasters', () => {
    it('全マスタデータを一括取得できること', async () => {
      // すべてのマスターテーブルのモックを設定
      mockPrisma.cemeteryTypeMaster.findMany.mockResolvedValue(mockCemeteryTypeData);
      mockPrisma.paymentMethodMaster.findMany.mockResolvedValue(mockPaymentMethodData);
      mockPrisma.taxTypeMaster.findMany.mockResolvedValue(mockTaxTypeData);
      mockPrisma.calcTypeMaster.findMany.mockResolvedValue(mockCalcTypeData);
      mockPrisma.billingTypeMaster.findMany.mockResolvedValue(mockBillingTypeData);
      mockPrisma.recipientTypeMaster.findMany.mockResolvedValue(mockRecipientTypeData);
      mockPrisma.constructionTypeMaster.findMany.mockResolvedValue(mockConstructionTypeData);
      mockPrisma.sectionNameMaster.findMany.mockResolvedValue(mockSectionNameData);
      mockPrisma.relationshipMaster.findMany.mockResolvedValue(mockRelationshipData);
      mockPrisma.contractorMaster.findMany.mockResolvedValue(mockContractorData);
      mockPrisma.directionMaster.findMany.mockResolvedValue(mockDirectionData);
      mockPrisma.positionMaster.findMany.mockResolvedValue(mockPositionData);
      mockPrisma.validityPeriodMaster.findMany.mockResolvedValue([]);
      mockPrisma.changeReasonMaster.findMany.mockResolvedValue([]);

      await getAllMasters(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      const jsonCall = (mockResponse.json as jest.Mock).mock.calls[0][0];

      // すべてのマスタデータが正しくフォーマットされているか検証
      expect(jsonCall.success).toBe(true);
      expect(jsonCall.data.cemeteryType).toHaveLength(2);
      expect(jsonCall.data.paymentMethod).toHaveLength(2);
      expect(jsonCall.data.taxType).toHaveLength(2);
      expect(jsonCall.data.calcType).toHaveLength(2);
      expect(jsonCall.data.billingType).toHaveLength(2);
      expect(jsonCall.data.recipientType).toHaveLength(2);
      expect(jsonCall.data.constructionType).toHaveLength(2);
      expect(jsonCall.data.sectionName).toHaveLength(2);
      expect(jsonCall.data.relationship).toHaveLength(2);
      expect(jsonCall.data.contractor).toHaveLength(2);

      // 特殊フィールドのテスト（taxRate）
      expect(jsonCall.data.taxType[0].taxRate).toBe('10');
      // 特殊フィールドのテスト（period）
      expect(jsonCall.data.sectionName[0].period).toBe('第1期');
      // 続柄
      expect(jsonCall.data.relationship[0].code).toBe('spouse');
      expect(jsonCall.data.relationship[0].name).toBe('配偶者');
      // 工事業者
      expect(jsonCall.data.contractor[0].code).toBe('placeholder-1');
      expect(jsonCall.data.contractor[0].name).toBe('小嶺石材');
      // 方角
      expect(jsonCall.data.direction).toHaveLength(2);
      expect(jsonCall.data.direction[0].code).toBe('1');
      expect(jsonCall.data.direction[0].name).toBe('東');
      // 位置
      expect(jsonCall.data.position).toHaveLength(2);
      expect(jsonCall.data.position[0].code).toBe('1');
      expect(jsonCall.data.position[0].name).toBe('角');
    });

    it('エラーが発生した場合、500エラーを返すこと', async () => {
      mockPrisma.cemeteryTypeMaster.findMany.mockRejectedValue(new Error('Database error'));
      // Promise.all で同時に走るので他のマスタは resolved に設定しておく
      mockPrisma.paymentMethodMaster.findMany.mockResolvedValue([]);
      mockPrisma.taxTypeMaster.findMany.mockResolvedValue([]);
      mockPrisma.calcTypeMaster.findMany.mockResolvedValue([]);
      mockPrisma.billingTypeMaster.findMany.mockResolvedValue([]);
      mockPrisma.recipientTypeMaster.findMany.mockResolvedValue([]);
      mockPrisma.constructionTypeMaster.findMany.mockResolvedValue([]);
      mockPrisma.sectionNameMaster.findMany.mockResolvedValue([]);
      mockPrisma.relationshipMaster.findMany.mockResolvedValue([]);
      mockPrisma.contractorMaster.findMany.mockResolvedValue([]);
      mockPrisma.directionMaster.findMany.mockResolvedValue([]);
      mockPrisma.positionMaster.findMany.mockResolvedValue([]);

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

  describe('getContractorMaster', () => {
    it('工事業者マスタを取得できること', async () => {
      mockPrisma.contractorMaster.findMany.mockResolvedValue(mockContractorData);

      await getContractorMaster(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.contractorMaster.findMany).toHaveBeenCalledWith({
        where: { is_active: true },
        orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
      });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: [
          {
            id: 1,
            code: 'placeholder-1',
            name: '小嶺石材',
            description: null,
            sortOrder: 1,
            isActive: true,
          },
          {
            id: 2,
            code: 'placeholder-99',
            name: 'その他',
            description: null,
            sortOrder: 99,
            isActive: true,
          },
        ],
      });
    });

    it('エラーが発生した場合、500エラーを返すこと', async () => {
      mockPrisma.contractorMaster.findMany.mockRejectedValue(new Error('Database error'));

      await getContractorMaster(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '工事業者マスタの取得に失敗しました',
        },
      });
    });
  });

  describe('getDirectionMaster', () => {
    it('方角マスタを取得できること', async () => {
      mockPrisma.directionMaster.findMany.mockResolvedValue(mockDirectionData);

      await getDirectionMaster(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.directionMaster.findMany).toHaveBeenCalledWith({
        where: { is_active: true },
        orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
      });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: [
          { id: 1, code: '1', name: '東', description: null, sortOrder: 1, isActive: true },
          { id: 2, code: '2', name: '西', description: null, sortOrder: 2, isActive: true },
        ],
      });
    });

    it('エラーが発生した場合、500エラーを返すこと', async () => {
      mockPrisma.directionMaster.findMany.mockRejectedValue(new Error('Database error'));

      await getDirectionMaster(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '方角マスタの取得に失敗しました',
        },
      });
    });
  });

  describe('getPositionMaster', () => {
    it('位置マスタを取得できること', async () => {
      mockPrisma.positionMaster.findMany.mockResolvedValue(mockPositionData);

      await getPositionMaster(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.positionMaster.findMany).toHaveBeenCalledWith({
        where: { is_active: true },
        orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
      });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: [
          { id: 1, code: '1', name: '角', description: null, sortOrder: 1, isActive: true },
          { id: 2, code: '2', name: '端', description: null, sortOrder: 2, isActive: true },
        ],
      });
    });

    it('エラーが発生した場合、500エラーを返すこと', async () => {
      mockPrisma.positionMaster.findMany.mockRejectedValue(new Error('Database error'));

      await getPositionMaster(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '位置マスタの取得に失敗しました',
        },
      });
    });
  });

  describe('getValidityPeriodMaster (#343)', () => {
    it('合祀年数マスタを取得できること', async () => {
      mockPrisma.validityPeriodMaster.findMany.mockResolvedValue([
        { id: 1, code: '13', name: '13年', description: null, sort_order: 13, is_active: true },
      ]);

      await getValidityPeriodMaster(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.validityPeriodMaster.findMany).toHaveBeenCalledWith({
        where: { is_active: true },
        orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
      });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: [
          { id: 1, code: '13', name: '13年', description: null, sortOrder: 13, isActive: true },
        ],
      });
    });

    it('エラー時は500を返すこと', async () => {
      mockPrisma.validityPeriodMaster.findMany.mockRejectedValue(new Error('Database error'));

      await getValidityPeriodMaster(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getChangeReasonMaster (#344)', () => {
    it('変更理由マスタを取得できること', async () => {
      mockPrisma.changeReasonMaster.findMany.mockResolvedValue([
        {
          id: 1,
          code: 'meigi',
          name: '名義変更',
          description: null,
          sort_order: 1,
          is_active: true,
        },
      ]);

      await getChangeReasonMaster(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.changeReasonMaster.findMany).toHaveBeenCalledWith({
        where: { is_active: true },
        orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
      });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: [
          {
            id: 1,
            code: 'meigi',
            name: '名義変更',
            description: null,
            sortOrder: 1,
            isActive: true,
          },
        ],
      });
    });

    it('エラー時は500を返すこと', async () => {
      mockPrisma.changeReasonMaster.findMany.mockRejectedValue(new Error('Database error'));

      await getChangeReasonMaster(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });
});
