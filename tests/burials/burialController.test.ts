import { Request, Response } from 'express';

// モックプリズマインスタンスの作成
const mockPrisma = {
  burial: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  gravestone: {
    findFirst: jest.fn(),
  },
  contractor: {
    findFirst: jest.fn(),
  },
};

// PrismaClientをモック化
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

import {
  getBurials,
  searchBurials,
  createBurial,
  updateBurial,
  deleteBurial
} from '../../src/burials/burialController';

describe('Burial Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockRequest = {
      params: {},
      body: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    jest.clearAllMocks();

    // console.errorをモック化してログ出力を抑制
    jest.spyOn(console, 'error').mockImplementation(() => { });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getBurials', () => {
    it('should return 501 not implemented', async () => {
      await getBurials(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(501);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_IMPLEMENTED',
          message: 'この機能は実装されていません。埋葬者検索APIをご利用ください。',
          details: [],
        },
      });
    });

    it('should handle error in catch block', async () => {
      // getBurialsはtryブロックで501を返すので、catchブロックに入るために
      // statusメソッドでエラーを投げる
      mockResponse.status = jest.fn().mockImplementationOnce(() => {
        throw new Error('Mock error');
      }).mockReturnValue(mockResponse);

      await getBurials(mockRequest as Request, mockResponse as Response);

      expect(console.error).toHaveBeenCalledWith('埋葬者取得エラー:', expect.any(Error));
    });
  });

  describe('searchBurials', () => {
    it('should return burials with search parameters', async () => {
      const mockBurials = [
        {
          id: 1,
          name: 'テスト故人',
          kana: 'てすとこじん',
          birth_date: new Date('1950-01-01'),
          gender: 'male',
          posthumous_name: 'テスト院信士',
          death_date: new Date('2024-01-01'),
          age_at_death: 74,
          burial_date: new Date('2024-01-05'),
          notification_date: new Date('2024-01-02'),
          denomination: '浄土宗',
          remarks: 'テストメモ',
          Gravestone: {
            id: 1,
            gravestone_code: 'A-01',
          },
          Contractor: {
            id: 1,
            name: 'テスト契約者',
          },
        },
      ];

      mockRequest.query = {
        name: 'テスト',
        page: '1',
        limit: '20',
      };

      mockPrisma.burial.findMany.mockResolvedValue(mockBurials);
      mockPrisma.burial.count.mockResolvedValue(1);

      await searchBurials(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.burial.findMany).toHaveBeenCalledWith({
        where: {
          deleted_at: null,
          name: {
            contains: 'テスト',
          },
        },
        include: {
          Gravestone: true,
          Contractor: true,
        },
        skip: 0,
        take: 20,
        orderBy: {
          id: 'desc',
        },
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          burials: mockBurials,
          pagination: {
            current_page: 1,
            per_page: 20,
            total_count: 1,
            total_pages: 1,
          },
        },
      });
    });

    it('should search burials with kana parameter', async () => {
      mockRequest.query = {
        kana: 'てすと',
        page: '1',
        limit: '20',
      };

      mockPrisma.burial.findMany.mockResolvedValue([]);
      mockPrisma.burial.count.mockResolvedValue(0);

      await searchBurials(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.burial.findMany).toHaveBeenCalledWith({
        where: {
          deleted_at: null,
          kana: {
            contains: 'てすと',
          },
        },
        include: {
          Gravestone: true,
          Contractor: true,
        },
        skip: 0,
        take: 20,
        orderBy: {
          id: 'desc',
        },
      });
    });

    it('should search burials with posthumous_name parameter', async () => {
      mockRequest.query = {
        posthumous_name: '院信士',
        page: '1',
        limit: '20',
      };

      mockPrisma.burial.findMany.mockResolvedValue([]);
      mockPrisma.burial.count.mockResolvedValue(0);

      await searchBurials(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.burial.findMany).toHaveBeenCalledWith({
        where: {
          deleted_at: null,
          posthumous_name: {
            contains: '院信士',
          },
        },
        include: {
          Gravestone: true,
          Contractor: true,
        },
        skip: 0,
        take: 20,
        orderBy: {
          id: 'desc',
        },
      });
    });

    it('should search burials with death_date range', async () => {
      mockRequest.query = {
        death_date_from: '2024-01-01',
        death_date_to: '2024-12-31',
        page: '1',
        limit: '20',
      };

      mockPrisma.burial.findMany.mockResolvedValue([]);
      mockPrisma.burial.count.mockResolvedValue(0);

      await searchBurials(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.burial.findMany).toHaveBeenCalledWith({
        where: {
          deleted_at: null,
          death_date: {
            gte: new Date('2024-01-01'),
            lte: new Date('2024-12-31'),
          },
        },
        include: {
          Gravestone: true,
          Contractor: true,
        },
        skip: 0,
        take: 20,
        orderBy: {
          id: 'desc',
        },
      });
    });

    it('should search burials with death_date_from only', async () => {
      mockRequest.query = {
        death_date_from: '2024-01-01',
        page: '1',
        limit: '20',
      };

      mockPrisma.burial.findMany.mockResolvedValue([]);
      mockPrisma.burial.count.mockResolvedValue(0);

      await searchBurials(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.burial.findMany).toHaveBeenCalledWith({
        where: {
          deleted_at: null,
          death_date: {
            gte: new Date('2024-01-01'),
          },
        },
        include: {
          Gravestone: true,
          Contractor: true,
        },
        skip: 0,
        take: 20,
        orderBy: {
          id: 'desc',
        },
      });
    });

    it('should search burials with death_date_to only', async () => {
      mockRequest.query = {
        death_date_to: '2024-12-31',
        page: '1',
        limit: '20',
      };

      mockPrisma.burial.findMany.mockResolvedValue([]);
      mockPrisma.burial.count.mockResolvedValue(0);

      await searchBurials(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.burial.findMany).toHaveBeenCalledWith({
        where: {
          deleted_at: null,
          death_date: {
            lte: new Date('2024-12-31'),
          },
        },
        include: {
          Gravestone: true,
          Contractor: true,
        },
        skip: 0,
        take: 20,
        orderBy: {
          id: 'desc',
        },
      });
    });

    it('should search burials with burial_date range', async () => {
      mockRequest.query = {
        burial_date_from: '2024-01-01',
        burial_date_to: '2024-12-31',
        page: '1',
        limit: '20',
      };

      mockPrisma.burial.findMany.mockResolvedValue([]);
      mockPrisma.burial.count.mockResolvedValue(0);

      await searchBurials(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.burial.findMany).toHaveBeenCalledWith({
        where: {
          deleted_at: null,
          burial_date: {
            gte: new Date('2024-01-01'),
            lte: new Date('2024-12-31'),
          },
        },
        include: {
          Gravestone: true,
          Contractor: true,
        },
        skip: 0,
        take: 20,
        orderBy: {
          id: 'desc',
        },
      });
    });

    it('should search burials with burial_date_from only', async () => {
      mockRequest.query = {
        burial_date_from: '2024-01-01',
        page: '1',
        limit: '20',
      };

      mockPrisma.burial.findMany.mockResolvedValue([]);
      mockPrisma.burial.count.mockResolvedValue(0);

      await searchBurials(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.burial.findMany).toHaveBeenCalledWith({
        where: {
          deleted_at: null,
          burial_date: {
            gte: new Date('2024-01-01'),
          },
        },
        include: {
          Gravestone: true,
          Contractor: true,
        },
        skip: 0,
        take: 20,
        orderBy: {
          id: 'desc',
        },
      });
    });

    it('should search burials with burial_date_to only', async () => {
      mockRequest.query = {
        burial_date_to: '2024-12-31',
        page: '1',
        limit: '20',
      };

      mockPrisma.burial.findMany.mockResolvedValue([]);
      mockPrisma.burial.count.mockResolvedValue(0);

      await searchBurials(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.burial.findMany).toHaveBeenCalledWith({
        where: {
          deleted_at: null,
          burial_date: {
            lte: new Date('2024-12-31'),
          },
        },
        include: {
          Gravestone: true,
          Contractor: true,
        },
        skip: 0,
        take: 20,
        orderBy: {
          id: 'desc',
        },
      });
    });

    it('should search burials with gravestone_code parameter', async () => {
      mockRequest.query = {
        gravestone_code: 'A-01',
        page: '1',
        limit: '20',
      };

      mockPrisma.burial.findMany.mockResolvedValue([]);
      mockPrisma.burial.count.mockResolvedValue(0);

      await searchBurials(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.burial.findMany).toHaveBeenCalledWith({
        where: {
          deleted_at: null,
          Gravestone: {
            gravestone_code: {
              contains: 'A-01',
            },
            deleted_at: null,
          },
        },
        include: {
          Gravestone: true,
          Contractor: true,
        },
        skip: 0,
        take: 20,
        orderBy: {
          id: 'desc',
        },
      });
    });

    it('should handle database error when searching burials', async () => {
      mockRequest.query = { name: 'テスト' };
      mockPrisma.burial.findMany.mockRejectedValue(new Error('Database error'));

      await searchBurials(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラー',
          details: [],
        },
      });
      expect(console.error).toHaveBeenCalledWith('埋葬者検索エラー:', expect.any(Error));
    });
  });

  describe('createBurial', () => {
    it('should create burial successfully', async () => {
      const burialData = {
        gravestone_id: 1,
        contractor_id: 1,
        name: 'テスト故人',
        kana: 'てすとこじん',
        birth_date: '1950-01-01',
        gender: 'male',
        posthumous_name: 'テスト院信士',
        death_date: '2024-01-01',
        age_at_death: 74,
        burial_date: '2024-01-05',
        notification_date: '2024-01-02',
        denomination: '浄土宗',
        remarks: 'テストメモ',
      };

      const mockGravestone = { id: 1, gravestone_code: 'A-01' };
      const mockContractor = { id: 1, name: 'テスト契約者' };
      const mockCreatedBurial = {
        id: 1,
        ...burialData,
        Gravestone: mockGravestone,
        Contractor: mockContractor,
      };

      mockRequest.body = burialData;
      mockPrisma.gravestone.findFirst.mockResolvedValue(mockGravestone);
      mockPrisma.contractor.findFirst.mockResolvedValue(mockContractor);
      mockPrisma.burial.create.mockResolvedValue(mockCreatedBurial);

      await createBurial(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.burial.create).toHaveBeenCalledWith({
        data: {
          gravestone_id: burialData.gravestone_id,
          contractor_id: burialData.contractor_id,
          name: burialData.name,
          kana: burialData.kana,
          birth_date: new Date(burialData.birth_date),
          gender: burialData.gender,
          posthumous_name: burialData.posthumous_name,
          death_date: new Date(burialData.death_date),
          age_at_death: burialData.age_at_death,
          burial_date: new Date(burialData.burial_date),
          notification_date: new Date(burialData.notification_date),
          denomination: burialData.denomination,
          remarks: burialData.remarks,
          effective_start_date: null,
          effective_end_date: null,
        },
        include: {
          Gravestone: true,
          Contractor: true,
        },
      });

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockCreatedBurial,
      });
    });

    it('should return validation error when required fields are missing', async () => {
      mockRequest.body = { name: 'テスト故人' }; // gravestone_id and contractor_id missing

      await createBurial(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '必須項目が不足しています',
          details: [
            { message: '墓石IDと契約者IDは必須です' },
          ],
        },
      });
      expect(mockPrisma.burial.create).not.toHaveBeenCalled();
    });

    it('should return 404 when gravestone not found', async () => {
      const burialData = {
        gravestone_id: 999,
        contractor_id: 1,
        name: 'テスト故人',
      };

      mockRequest.body = burialData;
      mockPrisma.gravestone.findFirst.mockResolvedValue(null);
      mockPrisma.contractor.findFirst.mockResolvedValue({ id: 1 });

      await createBurial(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '指定された墓石が見つかりません',
          details: [],
        },
      });
    });

    it('should return 404 when contractor not found', async () => {
      const burialData = {
        gravestone_id: 1,
        contractor_id: 999,
        name: 'テスト故人',
      };

      mockRequest.body = burialData;
      mockPrisma.gravestone.findFirst.mockResolvedValue({ id: 1 });
      mockPrisma.contractor.findFirst.mockResolvedValue(null);

      await createBurial(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '指定された契約者が見つかりません',
          details: [],
        },
      });
    });

    it('should handle database error during creation', async () => {
      const burialData = {
        gravestone_id: 1,
        contractor_id: 1,
        name: 'テスト故人',
      };

      mockRequest.body = burialData;
      mockPrisma.gravestone.findFirst.mockResolvedValue({ id: 1 });
      mockPrisma.contractor.findFirst.mockResolvedValue({ id: 1 });
      mockPrisma.burial.create.mockRejectedValue(new Error('Database error'));

      await createBurial(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラー',
          details: [],
        },
      });
      expect(console.error).toHaveBeenCalledWith('埋葬者登録エラー:', expect.any(Error));
    });
  });

  describe('updateBurial', () => {
    it('should update burial successfully', async () => {
      const updateData = {
        name: 'テスト故人更新',
        kana: 'てすとこじんこうしん',
        gender: 'male',
        death_date: '2024-01-01',
        burial_date: '2024-01-05',
        remarks: '更新されたメモ',
      };

      const existingBurial = { id: 1, name: 'テスト故人' };
      const updatedBurial = {
        id: 1,
        ...updateData,
        Gravestone: { id: 1 },
        Contractor: { id: 1 },
      };

      mockRequest.params = { id: '1' };
      mockRequest.body = updateData;
      mockPrisma.burial.findFirst.mockResolvedValue(existingBurial);
      mockPrisma.burial.update.mockResolvedValue(updatedBurial);

      await updateBurial(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.burial.findFirst).toHaveBeenCalledWith({
        where: {
          id: 1,
          deleted_at: null,
        },
      });

      expect(mockPrisma.burial.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          name: updateData.name,
          kana: updateData.kana,
          birth_date: undefined,
          gender: updateData.gender,
          posthumous_name: undefined,
          death_date: new Date(updateData.death_date),
          age_at_death: undefined,
          burial_date: new Date(updateData.burial_date),
          notification_date: undefined,
          denomination: undefined,
          remarks: updateData.remarks,
          effective_start_date: undefined,
          effective_end_date: undefined,
        },
        include: {
          Gravestone: true,
          Contractor: true,
        },
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: updatedBurial,
      });
    });

    it('should return 404 when burial not found', async () => {
      mockRequest.params = { id: '999' };
      mockRequest.body = { name: 'テスト' };
      mockPrisma.burial.findFirst.mockResolvedValue(null);

      await updateBurial(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '埋葬者が見つかりません',
          details: [],
        },
      });
      expect(mockPrisma.burial.update).not.toHaveBeenCalled();
    });

    it('should handle database error during update', async () => {
      const updateData = {
        name: 'テスト故人',
        kana: 'てすとこじん',
      };

      mockRequest.params = { id: '1' };
      mockRequest.body = updateData;
      mockPrisma.burial.findFirst.mockResolvedValue({ id: 1 });
      mockPrisma.burial.update.mockRejectedValue(new Error('Database error'));

      await updateBurial(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラー',
          details: [],
        },
      });
      expect(console.error).toHaveBeenCalledWith('埋葬者更新エラー:', expect.any(Error));
    });
  });

  describe('deleteBurial', () => {
    it('should delete burial successfully (logical delete)', async () => {
      const existingBurial = { id: 1, name: 'テスト故人' };

      mockRequest.params = { id: '1' };
      mockPrisma.burial.findFirst.mockResolvedValue(existingBurial);
      mockPrisma.burial.update.mockResolvedValue({ id: 1, deleted_at: new Date() });

      await deleteBurial(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.burial.findFirst).toHaveBeenCalledWith({
        where: {
          id: 1,
          deleted_at: null,
        },
      });

      expect(mockPrisma.burial.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          deleted_at: expect.any(Date),
        },
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { message: '埋葬者を削除しました' },
      });
    });

    it('should return 404 when burial not found for deletion', async () => {
      mockRequest.params = { id: '999' };
      mockPrisma.burial.findFirst.mockResolvedValue(null);

      await deleteBurial(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '埋葬者が見つかりません',
          details: [],
        },
      });
    });

    it('should handle database error during deletion', async () => {
      mockRequest.params = { id: '1' };
      mockPrisma.burial.findFirst.mockResolvedValue({ id: 1 });
      mockPrisma.burial.update.mockRejectedValue(new Error('Database error'));

      await deleteBurial(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラー',
          details: [],
        },
      });
      expect(console.error).toHaveBeenCalledWith('埋葬者削除エラー:', expect.any(Error));
    });
  });
});