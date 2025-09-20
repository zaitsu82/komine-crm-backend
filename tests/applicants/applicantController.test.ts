import { Request, Response } from 'express';

// モックプリズマインスタンスの作成
const mockPrisma = {
  applicant: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
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
  getApplicantById,
  createApplicant,
  updateApplicant,
  deleteApplicant
} from '../../src/applicants/applicantController';

describe('Applicant Controller', () => {
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

  describe('getApplicantById', () => {
    it('should return applicant details with gravestone', async () => {
      const mockApplicant = {
        id: 1,
        gravestone_id: 1,
        name: 'テスト申込者',
        kana: 'てすとしんこくしゃ',
        application_date: new Date('2024-01-01'),
        phone: '090-1234-5678',
        address: '福岡県福岡市博多区',
        Gravestone: {
          id: 1,
          gravestone_code: 'A-01',
          location: '区画A-1',
        },
      };

      mockRequest.params = { id: '1' };
      mockPrisma.applicant.findFirst.mockResolvedValue(mockApplicant);

      await getApplicantById(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.applicant.findFirst).toHaveBeenCalledWith({
        where: {
          id: 1,
          deleted_at: null,
        },
        include: {
          Gravestone: true,
        },
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockApplicant,
      });
    });

    it('should return 404 when applicant not found', async () => {
      mockRequest.params = { id: '999' };
      mockPrisma.applicant.findFirst.mockResolvedValue(null);

      await getApplicantById(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '申込者が見つかりません',
          details: [],
        },
      });
    });

    it('should handle database error', async () => {
      mockRequest.params = { id: '1' };
      mockPrisma.applicant.findFirst.mockRejectedValue(new Error('Database error'));

      await getApplicantById(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラー',
          details: [],
        },
      });
      expect(console.error).toHaveBeenCalledWith('申込者詳細取得エラー:', expect.any(Error));
    });
  });

  describe('createApplicant', () => {
    it('should create applicant successfully', async () => {
      const applicantData = {
        gravestone_id: 1,
        application_date: '2024-01-01',
        staff_name: 'テスト職員',
        name: 'テスト申込者',
        kana: 'てすとしんこくしゃ',
        postal_code: '812-0013',
        address: '福岡県福岡市博多区博多駅東',
        phone: '090-1234-5678',
        remarks: 'テスト備考',
      };

      const mockGravestone = { id: 1, gravestone_code: 'A-01' };
      const mockCreatedApplicant = {
        id: 1,
        ...applicantData,
        application_date: new Date(applicantData.application_date),
        Gravestone: mockGravestone,
      };

      mockRequest.body = applicantData;
      mockPrisma.gravestone.findFirst.mockResolvedValue(mockGravestone);
      mockPrisma.applicant.findFirst.mockResolvedValue(null); // 既存なし
      mockPrisma.applicant.create.mockResolvedValue(mockCreatedApplicant);

      await createApplicant(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.gravestone.findFirst).toHaveBeenCalledWith({
        where: {
          id: 1,
          deleted_at: null,
        },
      });

      expect(mockPrisma.applicant.findFirst).toHaveBeenCalledWith({
        where: {
          gravestone_id: 1,
          deleted_at: null,
        },
      });

      expect(mockPrisma.applicant.create).toHaveBeenCalledWith({
        data: {
          gravestone_id: 1,
          application_date: new Date('2024-01-01'),
          staff_name: 'テスト職員',
          name: 'テスト申込者',
          kana: 'てすとしんこくしゃ',
          postal_code: '812-0013',
          address: '福岡県福岡市博多区博多駅東',
          phone: '090-1234-5678',
          remarks: 'テスト備考',
          effective_start_date: null,
          effective_end_date: null,
        },
        include: {
          Gravestone: true,
        },
      });

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockCreatedApplicant,
      });
    });

    it('should return validation error when required fields missing', async () => {
      mockRequest.body = { name: 'テスト申込者' }; // 必須項目が不足

      await createApplicant(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '必須項目が不足しています',
          details: [
            { message: '墓石ID、申込日、氏名、ふりがな、郵便番号、住所、電話番号は必須です' },
          ],
        },
      });
    });

    it('should return 404 when gravestone not found', async () => {
      const applicantData = {
        gravestone_id: 999,
        application_date: '2024-01-01',
        name: 'テスト申込者',
        kana: 'てすとしんこくしゃ',
        postal_code: '812-0013',
        address: '福岡県福岡市博多区博多駅東',
        phone: '090-1234-5678',
      };

      mockRequest.body = applicantData;
      mockPrisma.gravestone.findFirst.mockResolvedValue(null);

      await createApplicant(mockRequest as Request, mockResponse as Response);

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

    it('should return conflict error when applicant already exists for gravestone', async () => {
      const applicantData = {
        gravestone_id: 1,
        application_date: '2024-01-01',
        name: 'テスト申込者',
        kana: 'てすとしんこくしゃ',
        postal_code: '812-0013',
        address: '福岡県福岡市博多区博多駅東',
        phone: '090-1234-5678',
      };

      mockRequest.body = applicantData;
      mockPrisma.gravestone.findFirst.mockResolvedValue({ id: 1 });
      mockPrisma.applicant.findFirst.mockResolvedValue({ id: 1 }); // 既存あり

      await createApplicant(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(409);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'この墓石には既に申込者が登録されています',
          details: [],
        },
      });
    });

    it('should handle Prisma unique constraint error', async () => {
      const applicantData = {
        gravestone_id: 1,
        application_date: '2024-01-01',
        name: 'テスト申込者',
        kana: 'てすとしんこくしゃ',
        postal_code: '812-0013',
        address: '福岡県福岡市博多区博多駅東',
        phone: '090-1234-5678',
      };

      const prismaError = { code: 'P2002' }; // Unique constraint error

      mockRequest.body = applicantData;
      mockPrisma.gravestone.findFirst.mockResolvedValue({ id: 1 });
      mockPrisma.applicant.findFirst.mockResolvedValue(null);
      mockPrisma.applicant.create.mockRejectedValue(prismaError);

      await createApplicant(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(409);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'この墓石には既に申込者が登録されています',
          details: [],
        },
      });
    });

    it('should handle database error during creation', async () => {
      const applicantData = {
        gravestone_id: 1,
        application_date: '2024-01-01',
        name: 'テスト申込者',
        kana: 'てすとしんこくしゃ',
        postal_code: '812-0013',
        address: '福岡県福岡市博多区博多駅東',
        phone: '090-1234-5678',
      };

      mockRequest.body = applicantData;
      mockPrisma.gravestone.findFirst.mockResolvedValue({ id: 1 });
      mockPrisma.applicant.findFirst.mockResolvedValue(null);
      mockPrisma.applicant.create.mockRejectedValue(new Error('Database error'));

      await createApplicant(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラー',
          details: [],
        },
      });
    });
  });

  describe('updateApplicant', () => {
    it('should update applicant successfully', async () => {
      const updateData = {
        name: 'テスト申込者更新',
        kana: 'てすとしんこくしゃこうしん',
        phone: '090-9876-5432',
        address: '福岡県福岡市中央区天神',
        remarks: '更新されたメモ',
      };

      const existingApplicant = { id: 1, name: 'テスト申込者' };
      const updatedApplicant = {
        id: 1,
        ...updateData,
        Gravestone: { id: 1 },
      };

      mockRequest.params = { id: '1' };
      mockRequest.body = updateData;
      mockPrisma.applicant.findFirst.mockResolvedValue(existingApplicant);
      mockPrisma.applicant.update.mockResolvedValue(updatedApplicant);

      await updateApplicant(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.applicant.findFirst).toHaveBeenCalledWith({
        where: {
          id: 1,
          deleted_at: null,
        },
      });

      expect(mockPrisma.applicant.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          application_date: undefined,
          staff_name: undefined,
          name: 'テスト申込者更新',
          kana: 'てすとしんこくしゃこうしん',
          postal_code: undefined,
          address: '福岡県福岡市中央区天神',
          phone: '090-9876-5432',
          remarks: '更新されたメモ',
          effective_start_date: undefined,
          effective_end_date: undefined,
        },
        include: {
          Gravestone: true,
        },
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: updatedApplicant,
      });
    });

    it('should return 404 when applicant not found', async () => {
      mockRequest.params = { id: '999' };
      mockRequest.body = { name: 'テスト申込者' };
      mockPrisma.applicant.findFirst.mockResolvedValue(null);

      await updateApplicant(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '申込者が見つかりません',
          details: [],
        },
      });
      expect(mockPrisma.applicant.update).not.toHaveBeenCalled();
    });

    it('should handle database error during update', async () => {
      mockRequest.params = { id: '1' };
      mockRequest.body = { name: 'テスト申込者' };
      mockPrisma.applicant.findFirst.mockResolvedValue({ id: 1 });
      mockPrisma.applicant.update.mockRejectedValue(new Error('Database error'));

      await updateApplicant(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラー',
          details: [],
        },
      });
      expect(console.error).toHaveBeenCalledWith('申込者更新エラー:', expect.any(Error));
    });
  });

  describe('deleteApplicant', () => {
    it('should delete applicant successfully (logical delete)', async () => {
      const existingApplicant = { id: 1, gravestone_id: 1, name: 'テスト申込者' };

      mockRequest.params = { id: '1' };
      mockPrisma.applicant.findFirst.mockResolvedValue(existingApplicant);
      mockPrisma.contractor.findFirst.mockResolvedValue(null); // 関連なし
      mockPrisma.applicant.update.mockResolvedValue({ ...existingApplicant, deleted_at: new Date() });

      await deleteApplicant(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.applicant.findFirst).toHaveBeenCalledWith({
        where: {
          id: 1,
          deleted_at: null,
        },
      });

      expect(mockPrisma.contractor.findFirst).toHaveBeenCalledWith({
        where: {
          gravestone_id: 1,
          deleted_at: null,
        },
      });

      expect(mockPrisma.applicant.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          deleted_at: expect.any(Date),
        },
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { message: '申込者を削除しました' },
      });
    });

    it('should return 404 when applicant not found for deletion', async () => {
      mockRequest.params = { id: '999' };
      mockPrisma.applicant.findFirst.mockResolvedValue(null);

      await deleteApplicant(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '申込者が見つかりません',
          details: [],
        },
      });
    });

    it('should return conflict error when related contractor exists', async () => {
      const existingApplicant = { id: 1, gravestone_id: 1, name: 'テスト申込者' };

      mockRequest.params = { id: '1' };
      mockPrisma.applicant.findFirst.mockResolvedValue(existingApplicant);
      mockPrisma.contractor.findFirst.mockResolvedValue({ id: 1 }); // 関連あり

      await deleteApplicant(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(409);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'この申込者に関連する契約者が存在するため削除できません',
          details: [],
        },
      });
    });

    it('should handle database error during deletion', async () => {
      const existingApplicant = { id: 1, gravestone_id: 1, name: 'テスト申込者' };

      mockRequest.params = { id: '1' };
      mockPrisma.applicant.findFirst.mockResolvedValue(existingApplicant);
      mockPrisma.contractor.findFirst.mockResolvedValue(null);
      mockPrisma.applicant.update.mockRejectedValue(new Error('Database error'));

      await deleteApplicant(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラー',
          details: [],
        },
      });
      expect(console.error).toHaveBeenCalledWith('申込者削除エラー:', expect.any(Error));
    });
  });
});