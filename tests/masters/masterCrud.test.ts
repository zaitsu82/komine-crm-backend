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
  // 使用中チェック（#231）が参照する集計用デリゲート
  usageFee: { count: jest.fn().mockResolvedValue(0) },
  managementFee: { count: jest.fn().mockResolvedValue(0) },
  constructionInfo: { count: jest.fn().mockResolvedValue(0) },
  gravestoneInfo: { count: jest.fn().mockResolvedValue(0) },
  cemeteryTypeMaster: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  paymentMethodMaster: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  taxTypeMaster: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  calcTypeMaster: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  billingTypeMaster: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  accountTypeMaster: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  recipientTypeMaster: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  constructionTypeMaster: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  sectionNameMaster: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  relationshipMaster: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
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

    it('続柄マスタを正常に作成できること', async () => {
      mockRequest.params = { masterType: 'relationship' };
      mockRequest.body = { code: 'sibling', name: '兄弟姉妹', sortOrder: 5 };

      mockPrisma.relationshipMaster.create.mockResolvedValue({
        id: 5,
        code: 'sibling',
        name: '兄弟姉妹',
        description: null,
        sort_order: 5,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      });

      await createMaster(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.relationshipMaster.create).toHaveBeenCalledWith({
        data: {
          code: 'sibling',
          name: '兄弟姉妹',
          sort_order: 5,
          is_active: true,
        },
      });
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      const jsonCall = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(jsonCall.message).toBe('続柄マスタを作成しました');
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

    it('code 自動生成がカラム長（VarChar(10)系）で切り詰められること (#232)', async () => {
      mockRequest.params = { masterType: 'payment-method' };
      mockRequest.body = { name: 'クレジットカード分割払い' }; // 11文字超

      mockPrisma.paymentMethodMaster.create.mockResolvedValue({
        id: 10,
        code: 'クレジットカード分割',
        name: 'クレジットカード分割払い',
        description: null,
        sort_order: null,
        is_active: true,
      });

      await createMaster(mockRequest as Request, mockResponse as Response);

      const createCall = mockPrisma.paymentMethodMaster.create.mock.calls[0][0];
      // VarChar(10) に収まるよう10文字で切り詰め（従来は20文字でP2000の500になっていた）
      expect(createCall.data.code).toBe('クレジットカード分割');
      expect(createCall.data.code.length).toBeLessThanOrEqual(10);
      expect(mockResponse.status).toHaveBeenCalledWith(201);
    });

    it('section-name は code 20文字まで許容されること (#232)', async () => {
      mockRequest.params = { masterType: 'section-name' };
      mockRequest.body = {
        name: '一二三四五六七八九十一二三四五六七八九十超過分',
        period: '第1期',
      };

      mockPrisma.sectionNameMaster.create.mockResolvedValue({
        id: 11,
        code: '一二三四五六七八九十一二三四五六七八九十',
        name: '一二三四五六七八九十一二三四五六七八九十超過分',
        description: null,
        sort_order: null,
        is_active: true,
        period: '第1期',
      });

      await createMaster(mockRequest as Request, mockResponse as Response);

      const createCall = mockPrisma.sectionNameMaster.create.mock.calls[0][0];
      expect(createCall.data.code.length).toBeLessThanOrEqual(20);
      expect(mockResponse.status).toHaveBeenCalledWith(201);
    });

    it('文字列長超過（P2000）は 500 でなく 400 VALIDATION_ERROR になること (#232)', async () => {
      mockRequest.params = { masterType: 'payment-method' };
      // Zod は20文字まで許容するが payment-method のカラムは VarChar(10) のため P2000 になる
      mockRequest.body = { name: '銀行振込', code: 'a'.repeat(15) };

      const prismaError: any = new Error('value too long');
      prismaError.code = 'P2000';
      mockPrisma.paymentMethodMaster.create.mockRejectedValue(prismaError);

      await createMaster(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
            message: expect.stringContaining('コードが長すぎます'),
          }),
        })
      );
    });

    it('DB障害の場合、500エラーを返すこと', async () => {
      mockRequest.params = { masterType: 'cemetery-type' };
      mockRequest.body = { code: 'test', name: 'テスト' };

      mockPrisma.cemeteryTypeMaster.create.mockRejectedValue(new Error('DB error'));

      await createMaster(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });

    describe('区画名マスタ（section-name）の period 必須バリデーション', () => {
      it('period 無しで作成しようとすると 400 VALIDATION_ERROR（details に period）を返すこと', async () => {
        mockRequest.params = { masterType: 'section-name' };
        mockRequest.body = { code: '1ki', name: '1期' };

        await createMaster(mockRequest as Request, mockResponse as Response);

        // Prisma NOT NULL 違反による 500 ではなく、明示的な 400 を返す
        expect(mockResponse.status).toHaveBeenCalledWith(400);
        const jsonCall = (mockResponse.json as jest.Mock).mock.calls[0][0];
        expect(jsonCall.error.code).toBe('VALIDATION_ERROR');
        expect(jsonCall.error.details.some((d: { field?: string }) => d.field === 'period')).toBe(
          true
        );
        // バリデーション段階で弾くため create は呼ばれない
        expect(mockPrisma.sectionNameMaster.create).not.toHaveBeenCalled();
      });

      it('空文字の period では 400 VALIDATION_ERROR を返すこと', async () => {
        mockRequest.params = { masterType: 'section-name' };
        mockRequest.body = { code: '1ki', name: '1期', period: '' };

        await createMaster(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        const jsonCall = (mockResponse.json as jest.Mock).mock.calls[0][0];
        expect(jsonCall.error.code).toBe('VALIDATION_ERROR');
        expect(jsonCall.error.details.some((d: { field?: string }) => d.field === 'period')).toBe(
          true
        );
        expect(mockPrisma.sectionNameMaster.create).not.toHaveBeenCalled();
      });

      it('period ありで作成できること', async () => {
        mockRequest.params = { masterType: 'section-name' };
        mockRequest.body = { code: '1ki', name: '1期', period: '1期' };

        mockPrisma.sectionNameMaster.create.mockResolvedValue({
          id: 1,
          code: '1ki',
          name: '1期',
          description: null,
          sort_order: null,
          is_active: true,
          period: '1期',
          created_at: new Date(),
          updated_at: new Date(),
        });

        await createMaster(mockRequest as Request, mockResponse as Response);

        expect(mockPrisma.sectionNameMaster.create).toHaveBeenCalledWith({
          data: expect.objectContaining({ period: '1期' }),
        });
        expect(mockResponse.status).toHaveBeenCalledWith(201);
        const jsonCall = (mockResponse.json as jest.Mock).mock.calls[0][0];
        expect(jsonCall.data.period).toBe('1期');
      });

      it('section-name 以外のマスタは period 無しでも作成できること', async () => {
        mockRequest.params = { masterType: 'relationship' };
        mockRequest.body = { code: 'parent', name: '親' };

        mockPrisma.relationshipMaster.create.mockResolvedValue({
          id: 1,
          code: 'parent',
          name: '親',
          description: null,
          sort_order: null,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        });

        await createMaster(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(201);
        expect(mockPrisma.relationshipMaster.create).toHaveBeenCalled();
      });
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

    it('使用中マスタの code 変更は 409 で拒否されること (#231)', async () => {
      mockRequest.params = { masterType: 'tax-type', id: '3' };
      mockRequest.body = { code: 'newcode' };

      mockPrisma.taxTypeMaster.findUnique.mockResolvedValue({
        id: 3,
        code: 'tax10',
        name: '消費税10%',
      });
      mockPrisma.usageFee.count.mockResolvedValue(5); // 使用中

      await updateMaster(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(409);
      expect(mockPrisma.taxTypeMaster.update).not.toHaveBeenCalled();

      mockPrisma.usageFee.count.mockResolvedValue(0);
    });

    it('未使用マスタの code 変更は成功すること (#231)', async () => {
      mockRequest.params = { masterType: 'tax-type', id: '3' };
      mockRequest.body = { code: 'newcode' };

      mockPrisma.taxTypeMaster.findUnique.mockResolvedValue({
        id: 3,
        code: 'tax10',
        name: '消費税10%',
      });
      mockPrisma.taxTypeMaster.update.mockResolvedValue({
        id: 3,
        code: 'newcode',
        name: '消費税10%',
        description: null,
        sort_order: null,
        is_active: true,
        tax_rate: null,
      });

      await updateMaster(mockRequest as Request, mockResponse as Response);

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
    it('未使用のマスタデータを正常に削除できること', async () => {
      mockRequest.params = { masterType: 'construction-type', id: '2' };

      mockPrisma.constructionTypeMaster.findUnique.mockResolvedValue({
        id: 2,
        code: 'repair',
        name: '修繕',
      });
      mockPrisma.constructionInfo.count.mockResolvedValue(0); // 未使用
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

    it('使用中のマスタは 409 で削除を拒否すること (#231)', async () => {
      mockRequest.params = { masterType: 'tax-type', id: '3' };

      mockPrisma.taxTypeMaster.findUnique.mockResolvedValue({
        id: 3,
        code: 'tax10',
        name: '消費税10%',
      });
      // UsageFee 2件 + ManagementFee 1件で使用中
      mockPrisma.usageFee.count.mockResolvedValue(2);
      mockPrisma.managementFee.count.mockResolvedValue(1);

      await deleteMaster(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(409);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'CONFLICT',
            message: expect.stringContaining('使用中のため削除できません'),
          }),
        })
      );
      expect(mockPrisma.taxTypeMaster.delete).not.toHaveBeenCalled();

      // 後続テストのためにリセット
      mockPrisma.usageFee.count.mockResolvedValue(0);
      mockPrisma.managementFee.count.mockResolvedValue(0);
    });

    it('存在しないIDの場合、404エラーを返すこと', async () => {
      mockRequest.params = { masterType: 'cemetery-type', id: '999' };

      mockPrisma.cemeteryTypeMaster.findUnique.mockResolvedValue(null);

      await deleteMaster(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockPrisma.cemeteryTypeMaster.delete).not.toHaveBeenCalled();
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

      mockPrisma.cemeteryTypeMaster.findUnique.mockResolvedValue({
        id: 1,
        code: 'public',
        name: '公営',
      });
      mockPrisma.cemeteryTypeMaster.delete.mockRejectedValue(new Error('DB error'));

      await deleteMaster(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });
});
