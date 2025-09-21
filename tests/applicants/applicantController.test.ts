import { Request, Response } from 'express';

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

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

import {
  getApplicantById,
  createApplicant,
  updateApplicant,
  deleteApplicant,
} from '../../src/applicants/applicantController';

describe('Applicant Controller', () => {
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

    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getApplicantById', () => {
    it('should return applicant details successfully', async () => {
      const mockApplicant = {
        id: 1,
        gravestone_id: 1,
        application_date: new Date('2024-01-01'),
        staff_name: 'テスト担当者',
        name: 'テスト申込者',
        kana: 'テストモウシコミシャ',
        postal_code: '123-4567',
        address: 'テスト住所',
        phone: '012-345-6789',
        remarks: 'テスト備考',
        Gravestone: { id: 1, gravestone_code: 'A-01' },
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
    it('should create applicant successfully with all fields', async () => {
      const applicantData = {
        gravestone_id: 1,
        application_date: '2024-01-01',
        staff_name: 'テスト担当者',
        name: 'テスト申込者',
        kana: 'テストモウシコミシャ',
        postal_code: '123-4567',
        address: 'テスト住所',
        phone: '012-345-6789',
        remarks: 'テスト備考',
        effective_start_date: '2024-01-01',
        effective_end_date: '2024-12-31',
      };

      const mockGravestone = { id: 1, gravestone_code: 'A-01' };
      const mockCreatedApplicant = {
        id: 1,
        ...applicantData,
        application_date: new Date('2024-01-01'),
        effective_start_date: new Date('2024-01-01'),
        effective_end_date: new Date('2024-12-31'),
        Gravestone: mockGravestone,
      };

      mockRequest.body = applicantData;
      mockPrisma.gravestone.findFirst.mockResolvedValue(mockGravestone);
      mockPrisma.applicant.findFirst.mockResolvedValue(null); // 既存申込者なし
      mockPrisma.applicant.create.mockResolvedValue(mockCreatedApplicant);

      await createApplicant(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.applicant.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          gravestone_id: 1,
          application_date: new Date('2024-01-01'),
          staff_name: 'テスト担当者',
          name: 'テスト申込者',
          kana: 'テストモウシコミシャ',
          postal_code: '123-4567',
          address: 'テスト住所',
          phone: '012-345-6789',
          remarks: 'テスト備考',
          effective_start_date: new Date('2024-01-01'),
          effective_end_date: new Date('2024-12-31'),
        }),
        include: { Gravestone: true },
      });

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockCreatedApplicant,
      });
    });

    it('should create applicant with minimal required fields', async () => {
      const applicantData = {
        gravestone_id: 1,
        application_date: '2024-01-01',
        name: 'テスト申込者',
        kana: 'テストモウシコミシャ',
        postal_code: '123-4567',
        address: 'テスト住所',
        phone: '012-345-6789',
      };

      const mockGravestone = { id: 1 };
      const mockCreatedApplicant = {
        id: 1,
        ...applicantData,
        application_date: new Date('2024-01-01'),
        effective_start_date: null,
        effective_end_date: null,
        Gravestone: mockGravestone,
      };

      mockRequest.body = applicantData;
      mockPrisma.gravestone.findFirst.mockResolvedValue(mockGravestone);
      mockPrisma.applicant.findFirst.mockResolvedValue(null);
      mockPrisma.applicant.create.mockResolvedValue(mockCreatedApplicant);

      await createApplicant(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.applicant.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          gravestone_id: 1,
          application_date: new Date('2024-01-01'),
          name: 'テスト申込者',
          kana: 'テストモウシコミシャ',
          postal_code: '123-4567',
          address: 'テスト住所',
          phone: '012-345-6789',
          effective_start_date: null,
          effective_end_date: null,
        }),
        include: { Gravestone: true },
      });

      expect(mockResponse.status).toHaveBeenCalledWith(201);
    });

    it('should return validation error when required fields missing', async () => {
      mockRequest.body = { name: 'テスト申込者' };

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

    it('should return validation error when gravestone_id is missing', async () => {
      mockRequest.body = {
        application_date: '2024-01-01',
        name: 'テスト申込者',
        kana: 'テストモウシコミシャ',
        postal_code: '123-4567',
        address: 'テスト住所',
        phone: '012-345-6789',
      };

      await createApplicant(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('should return validation error when application_date is missing', async () => {
      mockRequest.body = {
        gravestone_id: 1,
        name: 'テスト申込者',
        kana: 'テストモウシコミシャ',
        postal_code: '123-4567',
        address: 'テスト住所',
        phone: '012-345-6789',
      };

      await createApplicant(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 when gravestone not found', async () => {
      const applicantData = {
        gravestone_id: 999,
        application_date: '2024-01-01',
        name: 'テスト申込者',
        kana: 'テストモウシコミシャ',
        postal_code: '123-4567',
        address: 'テスト住所',
        phone: '012-345-6789',
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

    it('should return 409 when applicant already exists for gravestone', async () => {
      const applicantData = {
        gravestone_id: 1,
        application_date: '2024-01-01',
        name: 'テスト申込者',
        kana: 'テストモウシコミシャ',
        postal_code: '123-4567',
        address: 'テスト住所',
        phone: '012-345-6789',
      };

      const mockGravestone = { id: 1 };
      const existingApplicant = { id: 1, gravestone_id: 1 };

      mockRequest.body = applicantData;
      mockPrisma.gravestone.findFirst.mockResolvedValue(mockGravestone);
      mockPrisma.applicant.findFirst.mockResolvedValue(existingApplicant);

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

    it('should handle Prisma constraint error (P2002)', async () => {
      const applicantData = {
        gravestone_id: 1,
        application_date: '2024-01-01',
        name: 'テスト申込者',
        kana: 'テストモウシコミシャ',
        postal_code: '123-4567',
        address: 'テスト住所',
        phone: '012-345-6789',
      };

      const mockGravestone = { id: 1 };
      const constraintError = new Error('Unique constraint failed');
      (constraintError as any).code = 'P2002';

      mockRequest.body = applicantData;
      mockPrisma.gravestone.findFirst.mockResolvedValue(mockGravestone);
      mockPrisma.applicant.findFirst.mockResolvedValue(null);
      mockPrisma.applicant.create.mockRejectedValue(constraintError);

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
      expect(console.error).toHaveBeenCalledWith('申込者登録エラー:', expect.any(Error));
    });

    it('should handle general database error during creation', async () => {
      const applicantData = {
        gravestone_id: 1,
        application_date: '2024-01-01',
        name: 'テスト申込者',
        kana: 'テストモウシコミシャ',
        postal_code: '123-4567',
        address: 'テスト住所',
        phone: '012-345-6789',
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
      expect(console.error).toHaveBeenCalledWith('申込者登録エラー:', expect.any(Error));
    });
  });

  describe('updateApplicant', () => {
    it('should update applicant successfully', async () => {
      const updateData = {
        staff_name: '更新担当者',
        name: '更新申込者',
        kana: 'コウシンモウシコミシャ',
        postal_code: '987-6543',
        address: '更新住所',
        phone: '090-1234-5678',
        remarks: '更新備考',
      };

      const existingApplicant = { id: 1, gravestone_id: 1 };
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
        data: expect.objectContaining({
          staff_name: '更新担当者',
          name: '更新申込者',
          kana: 'コウシンモウシコミシャ',
          postal_code: '987-6543',
          address: '更新住所',
          phone: '090-1234-5678',
          remarks: '更新備考',
        }),
        include: { Gravestone: true },
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: updatedApplicant,
      });
    });

    it('should update applicant with date fields', async () => {
      const updateData = {
        application_date: '2024-02-01',
        effective_start_date: '2024-02-01',
        effective_end_date: '2024-12-31',
      };

      const existingApplicant = { id: 1 };
      const updatedApplicant = { id: 1, ...updateData };

      mockRequest.params = { id: '1' };
      mockRequest.body = updateData;
      mockPrisma.applicant.findFirst.mockResolvedValue(existingApplicant);
      mockPrisma.applicant.update.mockResolvedValue(updatedApplicant);

      await updateApplicant(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.applicant.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          application_date: new Date('2024-02-01'),
          effective_start_date: new Date('2024-02-01'),
          effective_end_date: new Date('2024-12-31'),
        }),
        include: { Gravestone: true },
      });
    });

    it('should update applicant with undefined date fields when not provided', async () => {
      const updateData = {
        name: '更新申込者',
        phone: '090-1234-5678',
      };

      const existingApplicant = { id: 1 };
      const updatedApplicant = { id: 1, ...updateData };

      mockRequest.params = { id: '1' };
      mockRequest.body = updateData;
      mockPrisma.applicant.findFirst.mockResolvedValue(existingApplicant);
      mockPrisma.applicant.update.mockResolvedValue(updatedApplicant);

      await updateApplicant(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.applicant.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          name: '更新申込者',
          phone: '090-1234-5678',
          application_date: undefined,
          effective_start_date: undefined,
          effective_end_date: undefined,
        }),
        include: { Gravestone: true },
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
    it('should delete applicant successfully when no related contractor exists', async () => {
      const existingApplicant = { id: 1, gravestone_id: 1 };

      mockRequest.params = { id: '1' };
      mockPrisma.applicant.findFirst.mockResolvedValue(existingApplicant);
      mockPrisma.contractor.findFirst.mockResolvedValue(null); // 関連契約者なし
      mockPrisma.applicant.update.mockResolvedValue({ id: 1, deleted_at: new Date() });

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

    it('should return 409 when related contractor exists', async () => {
      const existingApplicant = { id: 1, gravestone_id: 1 };
      const relatedContractor = { id: 1, gravestone_id: 1 };

      mockRequest.params = { id: '1' };
      mockPrisma.applicant.findFirst.mockResolvedValue(existingApplicant);
      mockPrisma.contractor.findFirst.mockResolvedValue(relatedContractor);

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
      mockRequest.params = { id: '1' };
      mockPrisma.applicant.findFirst.mockResolvedValue({ id: 1, gravestone_id: 1 });
      mockPrisma.contractor.findFirst.mockRejectedValue(new Error('Database error'));

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

  describe('Edge cases and error scenarios', () => {
    it('should handle parseInt errors in getApplicantById', async () => {
      mockRequest.params = { id: 'invalid_id' };
      mockPrisma.applicant.findFirst.mockRejectedValue(new Error('Invalid ID'));

      await getApplicantById(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(console.error).toHaveBeenCalledWith('申込者詳細取得エラー:', expect.any(Error));
    });

    it('should handle parseInt errors in updateApplicant', async () => {
      mockRequest.params = { id: 'invalid_id' };
      mockRequest.body = { name: 'テスト申込者' };
      mockPrisma.applicant.findFirst.mockRejectedValue(new Error('Invalid ID'));

      await updateApplicant(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(console.error).toHaveBeenCalledWith('申込者更新エラー:', expect.any(Error));
    });

    it('should handle parseInt errors in deleteApplicant', async () => {
      mockRequest.params = { id: 'invalid_id' };
      mockPrisma.applicant.findFirst.mockRejectedValue(new Error('Invalid ID'));

      await deleteApplicant(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(console.error).toHaveBeenCalledWith('申込者削除エラー:', expect.any(Error));
    });
  });
});