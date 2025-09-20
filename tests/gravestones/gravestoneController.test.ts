import { Request, Response } from 'express';

// モックプリズマインスタンスの作成
const mockPrisma = {
  gravestone: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  contractor: {
    count: jest.fn(),
  },
  usageFee: {
    count: jest.fn(),
  },
  managementFee: {
    count: jest.fn(),
  },
};

// PrismaClientをモック化
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

import {
  getGravestones,
  getGravestoneById,
  searchGravestones,
  createGravestone,
  updateGravestone,
  deleteGravestone
} from '../../src/gravestones/gravestoneController';

describe('Gravestone Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockRequest = {
      params: {},
      body: {},
      query: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    jest.clearAllMocks();

    // console.errorをモック化してログ出力を抑制
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getGravestones', () => {
    it('should return gravestones list with pagination', async () => {
      const mockGravestones = [
        {
          id: 1,
          gravestone_code: 'A-01',
          usage_status: 'available',
          price: 1000000,
          location: '区画A-1',
          cemetery_type: 'general',
          denomination: 'buddhist',
          Applicant: { name: 'テスト申込者', application_date: new Date() },
          Contractors: [{ name: 'テスト契約者', start_date: new Date() }],
        },
      ];

      mockRequest.query = { page: '1', limit: '20' };
      mockPrisma.gravestone.findMany.mockResolvedValue(mockGravestones);
      mockPrisma.gravestone.count.mockResolvedValue(1);

      await getGravestones(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.gravestone.findMany).toHaveBeenCalledWith({
        where: { deleted_at: null },
        orderBy: { created_at: 'desc' },
        skip: 0,
        take: 20,
        select: expect.objectContaining({
          id: true,
          gravestone_code: true,
          usage_status: true,
        }),
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          gravestones: mockGravestones,
          pagination: {
            current_page: 1,
            total_pages: 1,
            total_items: 1,
            items_per_page: 20,
            has_next: false,
            has_prev: false,
          },
        },
      });
    });

    it('should handle search and filter parameters', async () => {
      mockRequest.query = {
        usage_status: 'available',
        cemetery_type: 'general',
        gravestone_code: 'A-01',
        search: 'テスト',
        sort_by: 'gravestone_code',
        sort_order: 'asc',
      };

      mockPrisma.gravestone.findMany.mockResolvedValue([]);
      mockPrisma.gravestone.count.mockResolvedValue(0);

      await getGravestones(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.gravestone.findMany).toHaveBeenCalledWith({
        where: {
          deleted_at: null,
          usage_status: 'available',
          cemetery_type: 'general',
          gravestone_code: {
            contains: 'A-01',
            mode: 'insensitive',
          },
          OR: [
            { gravestone_code: { contains: 'テスト', mode: 'insensitive' } },
            { location: { contains: 'テスト', mode: 'insensitive' } },
            { inscription: { contains: 'テスト', mode: 'insensitive' } },
          ],
        },
        orderBy: { gravestone_code: 'asc' },
        skip: 0,
        take: 20,
        select: expect.any(Object),
      });
    });

    it('should handle database error', async () => {
      mockPrisma.gravestone.findMany.mockRejectedValue(new Error('Database error'));

      await getGravestones(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラーが発生しました',
          details: [],
        },
      });
      expect(console.error).toHaveBeenCalledWith('Get gravestones error:', expect.any(Error));
    });
  });

  describe('getGravestoneById', () => {
    it('should return gravestone details with related data', async () => {
      const mockGravestone = {
        id: 1,
        gravestone_code: 'A-01',
        usage_status: 'available',
        price: 1000000,
        Applicant: { name: 'テスト申込者' },
        Contractors: [{ name: 'テスト契約者' }],
        UsageFees: [],
        ManagementFees: [],
        BillingInfos: [],
        FamilyContacts: [],
        Burials: [],
        Constructions: [],
      };

      mockRequest.params = { id: '1' };
      mockPrisma.gravestone.findFirst.mockResolvedValue(mockGravestone);

      await getGravestoneById(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.gravestone.findFirst).toHaveBeenCalledWith({
        where: {
          id: 1,
          deleted_at: null,
        },
        include: expect.objectContaining({
          Applicant: { where: { deleted_at: null } },
          Contractors: expect.any(Object),
        }),
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { gravestone: mockGravestone },
      });
    });

    it('should return 400 for invalid ID', async () => {
      mockRequest.params = { id: 'invalid' };

      await getGravestoneById(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '無効なIDです',
          details: [
            { field: 'id', message: 'IDは数値である必要があります' },
          ],
        },
      });
    });

    it('should return 404 when gravestone not found', async () => {
      mockRequest.params = { id: '999' };
      mockPrisma.gravestone.findFirst.mockResolvedValue(null);

      await getGravestoneById(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '墓石情報が見つかりません',
          details: [],
        },
      });
    });

    it('should handle database error', async () => {
      mockRequest.params = { id: '1' };
      mockPrisma.gravestone.findFirst.mockRejectedValue(new Error('Database error'));

      await getGravestoneById(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラーが発生しました',
          details: [],
        },
      });
    });
  });

  describe('searchGravestones', () => {
    it('should search gravestones with complex query', async () => {
      const mockGravestones = [
        {
          id: 1,
          gravestone_code: 'A-01',
          Applicant: { name: 'テスト申込者' },
          Contractors: [{ name: 'テスト契約者' }],
        },
      ];

      mockRequest.query = {
        q: 'テスト',
        usage_status: 'available',
        price_min: '500000',
        price_max: '1500000',
        construction_date_from: '2024-01-01',
        construction_date_to: '2024-12-31',
      };

      mockPrisma.gravestone.findMany.mockResolvedValue(mockGravestones);
      mockPrisma.gravestone.count.mockResolvedValue(1);

      await searchGravestones(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.gravestone.findMany).toHaveBeenCalledWith({
        where: {
          deleted_at: null,
          usage_status: 'available',
          price: {
            gte: 500000,
            lte: 1500000,
          },
          construction_date: {
            gte: new Date('2024-01-01'),
            lte: new Date('2024-12-31'),
          },
          OR: expect.arrayContaining([
            { gravestone_code: { contains: 'テスト', mode: 'insensitive' } },
            { location: { contains: 'テスト', mode: 'insensitive' } },
          ]),
        },
        include: expect.any(Object),
        orderBy: { updated_at: 'desc' },
        skip: 0,
        take: 20,
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          gravestones: mockGravestones,
          pagination: expect.any(Object),
          search_params: expect.objectContaining({
            q: 'テスト',
            usage_status: 'available',
          }),
        },
      });
    });

    it('should handle database error', async () => {
      mockRequest.query = { q: 'テスト' };
      mockPrisma.gravestone.findMany.mockRejectedValue(new Error('Database error'));

      await searchGravestones(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラーが発生しました',
          details: [],
        },
      });
    });
  });

  describe('createGravestone', () => {
    it('should create gravestone successfully', async () => {
      const gravestoneData = {
        gravestone_code: 'A-01',
        usage_status: 'available',
        price: 1000000,
        location: '区画A-1',
        cemetery_type: 'general',
        denomination: 'buddhist',
      };

      const mockCreatedGravestone = { id: 1, ...gravestoneData };

      mockRequest.body = gravestoneData;
      mockPrisma.gravestone.findFirst.mockResolvedValue(null); // 重複なし
      mockPrisma.gravestone.create.mockResolvedValue(mockCreatedGravestone);

      await createGravestone(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.gravestone.findFirst).toHaveBeenCalledWith({
        where: {
          gravestone_code: 'A-01',
          deleted_at: null,
        },
      });

      expect(mockPrisma.gravestone.create).toHaveBeenCalledWith({
        data: {
          gravestone_code: 'A-01',
          usage_status: 'available',
          price: 1000000,
          orientation: undefined,
          location: '区画A-1',
          cemetery_type: 'general',
          denomination: 'buddhist',
          inscription: undefined,
          construction_deadline: null,
          construction_date: null,
          epitaph: undefined,
          remarks: undefined,
        },
      });

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          gravestone: mockCreatedGravestone,
          message: '墓石情報が正常に登録されました',
        },
      });
    });

    it('should return validation error when required fields missing', async () => {
      mockRequest.body = { location: '区画A-1' }; // 必須項目が不足

      await createGravestone(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '入力値にエラーがあります',
          details: [
            { field: 'gravestone_code', message: '墓石コードは必須です' },
            { field: 'usage_status', message: '利用状況は必須です' },
            { field: 'price', message: '墓石代は必須です' },
          ],
        },
      });
    });

    it('should return conflict error when gravestone code already exists', async () => {
      mockRequest.body = {
        gravestone_code: 'A-01',
        usage_status: 'available',
        price: 1000000,
      };

      mockPrisma.gravestone.findFirst.mockResolvedValue({ id: 1 }); // 重複あり

      await createGravestone(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(409);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'CONFLICT',
          message: '墓石コードが既に存在します',
          details: [
            { field: 'gravestone_code', message: '墓石コードが既に存在します' },
          ],
        },
      });
    });

    it('should return validation error for invalid price', async () => {
      mockRequest.body = {
        gravestone_code: 'A-01',
        usage_status: 'available',
        price: 'invalid',
      };

      mockPrisma.gravestone.findFirst.mockResolvedValue(null);

      await createGravestone(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '墓石代は0以上の数値である必要があります',
          details: [
            { field: 'price', message: '墓石代は0以上の数値である必要があります' },
          ],
        },
      });
    });

    it('should handle database error during creation', async () => {
      mockRequest.body = {
        gravestone_code: 'A-01',
        usage_status: 'available',
        price: 1000000,
      };

      mockPrisma.gravestone.findFirst.mockResolvedValue(null);
      mockPrisma.gravestone.create.mockRejectedValue(new Error('Database error'));

      await createGravestone(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラーが発生しました',
          details: [],
        },
      });
    });
  });

  describe('updateGravestone', () => {
    it('should update gravestone successfully', async () => {
      const updateData = {
        gravestone_code: 'A-02',
        price: 1200000,
        location: '区画A-2',
      };

      const existingGravestone = {
        id: 1,
        gravestone_code: 'A-01',
        price: 1000000,
      };

      const updatedGravestone = { ...existingGravestone, ...updateData };

      mockRequest.params = { id: '1' };
      mockRequest.body = updateData;
      mockPrisma.gravestone.findFirst
        .mockResolvedValueOnce(existingGravestone) // 存在確認
        .mockResolvedValueOnce(null); // 重複確認
      mockPrisma.gravestone.update.mockResolvedValue(updatedGravestone);

      await updateGravestone(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.gravestone.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          gravestone_code: 'A-02',
          price: 1200000,
          location: '区画A-2',
        },
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          gravestone: updatedGravestone,
          message: '墓石情報が正常に更新されました',
        },
      });
    });

    it('should return 400 for invalid ID', async () => {
      mockRequest.params = { id: 'invalid' };

      await updateGravestone(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '無効なIDです',
          details: [
            { field: 'id', message: 'IDは数値である必要があります' },
          ],
        },
      });
    });

    it('should return 404 when gravestone not found', async () => {
      mockRequest.params = { id: '999' };
      mockRequest.body = { price: 1200000 };
      mockPrisma.gravestone.findFirst.mockResolvedValue(null);

      await updateGravestone(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '墓石情報が見つかりません',
          details: [],
        },
      });
    });

    it('should return conflict error when updated gravestone code already exists', async () => {
      mockRequest.params = { id: '1' };
      mockRequest.body = { gravestone_code: 'A-02' };

      const existingGravestone = { id: 1, gravestone_code: 'A-01' };

      mockPrisma.gravestone.findFirst
        .mockResolvedValueOnce(existingGravestone) // 存在確認
        .mockResolvedValueOnce({ id: 2 }); // 重複確認

      await updateGravestone(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(409);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'CONFLICT',
          message: '墓石コードが既に存在します',
          details: [
            { field: 'gravestone_code', message: '墓石コードが既に存在します' },
          ],
        },
      });
    });

    it('should handle database error during update', async () => {
      mockRequest.params = { id: '1' };
      mockRequest.body = { price: 1200000 };
      mockPrisma.gravestone.findFirst.mockResolvedValue({ id: 1 });
      mockPrisma.gravestone.update.mockRejectedValue(new Error('Database error'));

      await updateGravestone(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラーが発生しました',
          details: [],
        },
      });
    });
  });

  describe('deleteGravestone', () => {
    it('should delete gravestone successfully (logical delete)', async () => {
      const existingGravestone = { id: 1, gravestone_code: 'A-01' };

      mockRequest.params = { id: '1' };
      mockPrisma.gravestone.findFirst.mockResolvedValue(existingGravestone);
      mockPrisma.contractor.count.mockResolvedValue(0);
      mockPrisma.usageFee.count.mockResolvedValue(0);
      mockPrisma.managementFee.count.mockResolvedValue(0);
      mockPrisma.gravestone.update.mockResolvedValue({ ...existingGravestone, deleted_at: new Date() });

      await deleteGravestone(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.gravestone.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { deleted_at: expect.any(Date) },
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          message: '墓石情報が正常に削除されました',
        },
      });
    });

    it('should return 400 for invalid ID', async () => {
      mockRequest.params = { id: 'invalid' };

      await deleteGravestone(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '無効なIDです',
          details: [
            { field: 'id', message: 'IDは数値である必要があります' },
          ],
        },
      });
    });

    it('should return 404 when gravestone not found', async () => {
      mockRequest.params = { id: '999' };
      mockPrisma.gravestone.findFirst.mockResolvedValue(null);

      await deleteGravestone(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '墓石情報が見つかりません',
          details: [],
        },
      });
    });

    it('should return conflict error when related data exists', async () => {
      mockRequest.params = { id: '1' };
      mockPrisma.gravestone.findFirst.mockResolvedValue({ id: 1 });
      mockPrisma.contractor.count.mockResolvedValue(2);
      mockPrisma.usageFee.count.mockResolvedValue(1);
      mockPrisma.managementFee.count.mockResolvedValue(1);

      await deleteGravestone(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(409);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'CONFLICT',
          message: '関連するデータが存在するため削除できません',
          details: [
            {
              message: '契約者: 2件、使用料: 1件、管理料: 1件の関連データが存在します',
            },
          ],
        },
      });
    });

    it('should handle database error during deletion', async () => {
      mockRequest.params = { id: '1' };
      mockPrisma.gravestone.findFirst.mockResolvedValue({ id: 1 });
      mockPrisma.contractor.count.mockResolvedValue(0);
      mockPrisma.usageFee.count.mockResolvedValue(0);
      mockPrisma.managementFee.count.mockResolvedValue(0);
      mockPrisma.gravestone.update.mockRejectedValue(new Error('Database error'));

      await deleteGravestone(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラーが発生しました',
          details: [],
        },
      });
    });
  });
});