import { Request, Response } from 'express';

// モックプリズマインスタンスの作成
const mockPrisma = {
  burial: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  contract: {
    findUnique: jest.fn(),
  },
};

// PrismaClientをモック化
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

import {
  getBurials,
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
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getBurials', () => {
    it('should return burials for a contract', async () => {
      const mockBurials = [
        {
          id: 1,
          name: 'テスト故人',
          nameKana: 'てすとこじん',
          birthDate: new Date('1950-01-01'),
          gender: 'male',
          posthumousName1: 'テスト院',
          posthumousName2: '信士',
          deathDate: new Date('2024-01-01'),
          ageAtDeath: 74,
          burialDate: new Date('2024-01-05'),
          notificationDate: new Date('2024-01-02'),
          memo: 'テストメモ',
          religiousSect: {
            id: 1,
            name: '浄土宗',
          },
        },
      ];

      mockRequest.params = { contract_id: '1' };
      mockPrisma.burial.findMany.mockResolvedValue(mockBurials);

      await getBurials(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.burial.findMany).toHaveBeenCalledWith({
        where: {
          contractId: 1,
        },
        include: {
          religiousSect: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          burialDate: 'desc',
        },
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: [
          {
            id: 1,
            name: 'テスト故人',
            name_kana: 'てすとこじん',
            birth_date: mockBurials[0].birthDate,
            gender: 'male',
            posthumous_name1: 'テスト院',
            posthumous_name2: '信士',
            death_date: mockBurials[0].deathDate,
            age_at_death: 74,
            burial_date: mockBurials[0].burialDate,
            notification_date: mockBurials[0].notificationDate,
            religious_sect: {
              id: 1,
              name: '浄土宗',
            },
            memo: 'テストメモ',
          },
        ],
      });
    });

    it('should handle database error when fetching burials', async () => {
      mockRequest.params = { contract_id: '1' };
      mockPrisma.burial.findMany.mockRejectedValue(new Error('Database error'));

      await getBurials(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラーが発生しました',
          details: [],
        },
      });
      expect(console.error).toHaveBeenCalledWith('Error fetching burials:', expect.any(Error));
    });
  });

  describe('createBurial', () => {
    it('should create burial successfully', async () => {
      const burialData = {
        name: 'テスト故人',
        name_kana: 'てすとこじん',
        birth_date: '1950-01-01',
        gender: 'male',
        posthumous_name1: 'テスト院',
        posthumous_name2: '信士',
        death_date: '2024-01-01',
        age_at_death: 74,
        burial_date: '2024-01-05',
        notification_date: '2024-01-02',
        religious_sect_id: 1,
        memo: 'テストメモ',
      };

      mockRequest.params = { contract_id: '1' };
      mockRequest.body = burialData;
      mockPrisma.burial.create.mockResolvedValue({ id: 1 });

      await createBurial(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.burial.create).toHaveBeenCalledWith({
        data: {
          contractId: 1,
          name: burialData.name,
          nameKana: burialData.name_kana,
          birthDate: new Date(burialData.birth_date),
          gender: burialData.gender,
          posthumousName1: burialData.posthumous_name1,
          posthumousName2: burialData.posthumous_name2,
          deathDate: new Date(burialData.death_date),
          ageAtDeath: burialData.age_at_death,
          burialDate: new Date(burialData.burial_date),
          notificationDate: new Date(burialData.notification_date),
          religiousSectId: burialData.religious_sect_id,
          memo: burialData.memo,
        },
      });

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          id: 1,
          message: '埋葬情報が正常に作成されました',
        },
      });
    });

    it('should return validation error when required fields are missing', async () => {
      mockRequest.params = { contract_id: '1' };
      mockRequest.body = { name: 'テスト故人' }; // 必須項目が不足

      await createBurial(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(422);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '必須項目が不足しています',
          details: expect.any(Array),
        },
      });
      expect(mockPrisma.burial.create).not.toHaveBeenCalled();
    });

    it('should handle database error during creation', async () => {
      const burialData = {
        name: 'テスト故人',
        name_kana: 'てすとこじん',
        gender: 'male',
        death_date: '2024-01-01',
        burial_date: '2024-01-05',
      };

      mockRequest.params = { contract_id: '1' };
      mockRequest.body = burialData;
      mockPrisma.burial.create.mockRejectedValue(new Error('Database error'));

      await createBurial(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラーが発生しました',
          details: [],
        },
      });
      expect(console.error).toHaveBeenCalledWith('Error creating burial:', expect.any(Error));
    });
  });

  describe('updateBurial', () => {
    it('should update burial successfully', async () => {
      const updateData = {
        name: 'テスト故人更新',
        name_kana: 'てすとこじんこうしん',
        gender: 'male',
        death_date: '2024-01-01',
        burial_date: '2024-01-05',
        memo: '更新されたメモ',
      };

      mockRequest.params = { burial_id: '1' };
      mockRequest.body = updateData;
      mockPrisma.burial.update.mockResolvedValue({ id: 1 });

      await updateBurial(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.burial.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          name: updateData.name,
          nameKana: updateData.name_kana,
          gender: updateData.gender,
          deathDate: new Date(updateData.death_date),
          burialDate: new Date(updateData.burial_date),
          memo: updateData.memo,
        }),
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          id: 1,
          message: '埋葬情報が正常に更新されました',
        },
      });
    });

    it('should return validation error when required fields are missing', async () => {
      mockRequest.params = { burial_id: '1' };
      mockRequest.body = { name: 'テスト故人' }; // 必須項目が不足

      await updateBurial(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(422);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '必須項目が不足しています',
          details: expect.any(Array),
        },
      });
      expect(mockPrisma.burial.update).not.toHaveBeenCalled();
    });

    it('should handle database error during update', async () => {
      const updateData = {
        name: 'テスト故人',
        name_kana: 'てすとこじん',
        gender: 'male',
        death_date: '2024-01-01',
        burial_date: '2024-01-05',
      };

      mockRequest.params = { burial_id: '1' };
      mockRequest.body = updateData;
      mockPrisma.burial.update.mockRejectedValue(new Error('Database error'));

      await updateBurial(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラーが発生しました',
          details: [],
        },
      });
      expect(console.error).toHaveBeenCalledWith('Error updating burial:', expect.any(Error));
    });
  });

  describe('deleteBurial', () => {
    it('should delete burial successfully', async () => {
      mockRequest.params = { burial_id: '1' };
      mockPrisma.burial.delete.mockResolvedValue({ id: 1 });

      await deleteBurial(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.burial.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          message: '埋葬情報が正常に削除されました',
        },
      });
    });

    it('should return 404 when burial not found for deletion', async () => {
      mockRequest.params = { burial_id: '999' };
      const notFoundError = new Error('Record to delete does not exist');
      mockPrisma.burial.delete.mockRejectedValue(notFoundError);

      await deleteBurial(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '指定された埋葬情報が見つかりません',
          details: [],
        },
      });
    });

    it('should handle database error during deletion', async () => {
      mockRequest.params = { burial_id: '1' };
      mockPrisma.burial.delete.mockRejectedValue(new Error('Database error'));

      await deleteBurial(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラーが発生しました',
          details: [],
        },
      });
      expect(console.error).toHaveBeenCalledWith('Error deleting burial:', expect.any(Error));
    });
  });
});