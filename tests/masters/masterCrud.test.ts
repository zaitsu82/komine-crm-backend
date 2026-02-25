import { Request, Response } from 'express';

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

const mockPrisma: any = {
  cemeteryTypeMaster: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  paymentMethodMaster: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  taxTypeMaster: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  calcTypeMaster: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  billingTypeMaster: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  accountTypeMaster: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  recipientTypeMaster: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  constructionTypeMaster: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

import { createMaster, updateMaster, deleteMaster } from '../../src/masters/masterController';

describe('Master CRUD Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    mockRequest = {
      params: {},
      body: {},
    };
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

  describe('createMaster', () => {
    it('マスタデータを正常に作成できること', async () => {
      mockRequest.params = { masterType: 'cemetery-type' };
      mockRequest.body = { code: 'temple', name: '寺院', sortOrder: 3 };

      mockPrisma.cemeteryTypeMaster.create.mockResolvedValue({
        id: 3,
        code: 'temple',
        name: '寺院',
        description: null,
        sort_order: 3,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      });

      await createMaster(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          id: 3,
          code: 'temple',
          name: '寺院',
          description: null,
          sortOrder: 3,
          isActive: true,
        },
        message: '墓地タイプマスタを作成しました',
      });
    });

    it('税タイプマスタでtaxRateを含めて作成できること', async () => {
      mockRequest.params = { masterType: 'tax-type' };
      mockRequest.body = { code: 'reduced', name: '軽減税率', taxRate: 8 };

      mockPrisma.taxTypeMaster.create.mockResolvedValue({
        id: 3,
        code: 'reduced',
        name: '軽減税率',
        description: null,
        sort_order: null,
        is_active: true,
        tax_rate: 8,
        created_at: new Date(),
        updated_at: new Date(),
      });

      await createMaster(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      const jsonCall = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(jsonCall.data.taxRate).toBe('8');
    });

    it('無効なマスタタイプの場合、400エラーを返すこと', async () => {
      mockRequest.params = { masterType: 'invalid-type' };
      mockRequest.body = { code: 'test', name: 'Test' };

      await createMaster(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      const jsonCall = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(jsonCall.error.code).toBe('VALIDATION_ERROR');
    });

    it('バリデーションエラーの場合、400エラーを返すこと', async () => {
      mockRequest.params = { masterType: 'cemetery-type' };
      mockRequest.body = { code: '', name: '' };

      await createMaster(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      const jsonCall = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(jsonCall.error.code).toBe('VALIDATION_ERROR');
      expect(jsonCall.error.details.length).toBeGreaterThan(0);
    });

    it('コード重複の場合、409エラーを返すこと', async () => {
      mockRequest.params = { masterType: 'cemetery-type' };
      mockRequest.body = { code: 'public', name: '公営（重複）' };

      const prismaError: any = new Error('Unique constraint');
      prismaError.code = 'P2002';
      mockPrisma.cemeteryTypeMaster.create.mockRejectedValue(prismaError);

      await createMaster(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(409);
    });

    it('DB障害の場合、500エラーを返すこと', async () => {
      mockRequest.params = { masterType: 'cemetery-type' };
      mockRequest.body = { code: 'test', name: 'テスト' };

      mockPrisma.cemeteryTypeMaster.create.mockRejectedValue(new Error('DB error'));

      await createMaster(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  describe('updateMaster', () => {
    it('マスタデータを正常に更新できること', async () => {
      mockRequest.params = { masterType: 'cemetery-type', id: '1' };
      mockRequest.body = { name: '公営（更新）' };

      mockPrisma.cemeteryTypeMaster.update.mockResolvedValue({
        id: 1,
        code: 'public',
        name: '公営（更新）',
        description: null,
        sort_order: 1,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      });

      await updateMaster(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.cemeteryTypeMaster.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { name: '公営（更新）' },
      });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });

    it('無効なIDの場合、400エラーを返すこと', async () => {
      mockRequest.params = { masterType: 'cemetery-type', id: 'abc' };
      mockRequest.body = { name: 'テスト' };

      await updateMaster(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('存在しないIDの場合、404エラーを返すこと', async () => {
      mockRequest.params = { masterType: 'cemetery-type', id: '999' };
      mockRequest.body = { name: 'テスト' };

      const prismaError: any = new Error('Not found');
      prismaError.code = 'P2025';
      mockPrisma.cemeteryTypeMaster.update.mockRejectedValue(prismaError);

      await updateMaster(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('isActive/sortOrderの更新ができること', async () => {
      mockRequest.params = { masterType: 'payment-method', id: '1' };
      mockRequest.body = { isActive: false, sortOrder: 10 };

      mockPrisma.paymentMethodMaster.update.mockResolvedValue({
        id: 1,
        code: 'cash',
        name: '現金',
        description: null,
        sort_order: 10,
        is_active: false,
        created_at: new Date(),
        updated_at: new Date(),
      });

      await updateMaster(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.paymentMethodMaster.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { sort_order: 10, is_active: false },
      });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });

    it('無効なマスタタイプの場合、400エラーを返すこと', async () => {
      mockRequest.params = { masterType: 'invalid', id: '1' };
      mockRequest.body = { name: 'テスト' };

      await updateMaster(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });
  });

  describe('deleteMaster', () => {
    it('マスタデータを正常に削除できること', async () => {
      mockRequest.params = { masterType: 'construction-type', id: '2' };

      mockPrisma.constructionTypeMaster.delete.mockResolvedValue({
        id: 2,
        code: 'repair',
        name: '修繕',
      });

      await deleteMaster(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.constructionTypeMaster.delete).toHaveBeenCalledWith({
        where: { id: 2 },
      });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: '工事タイプマスタを削除しました',
      });
    });

    it('存在しないIDの場合、404エラーを返すこと', async () => {
      mockRequest.params = { masterType: 'cemetery-type', id: '999' };

      const prismaError: any = new Error('Not found');
      prismaError.code = 'P2025';
      mockPrisma.cemeteryTypeMaster.delete.mockRejectedValue(prismaError);

      await deleteMaster(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('無効なIDの場合、400エラーを返すこと', async () => {
      mockRequest.params = { masterType: 'cemetery-type', id: 'abc' };

      await deleteMaster(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('無効なマスタタイプの場合、400エラーを返すこと', async () => {
      mockRequest.params = { masterType: 'invalid', id: '1' };

      await deleteMaster(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('DB障害の場合、500エラーを返すこと', async () => {
      mockRequest.params = { masterType: 'cemetery-type', id: '1' };

      mockPrisma.cemeteryTypeMaster.delete.mockRejectedValue(new Error('DB error'));

      await deleteMaster(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });
});
