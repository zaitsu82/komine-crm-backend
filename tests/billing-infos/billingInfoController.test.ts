import { Request, Response } from 'express';

// モックプリズマインスタンスの作成
const mockPrisma = {
  billingInfo: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
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
  createBillingInfo,
  updateBillingInfo,
  deleteBillingInfo,
  generateBillingData
} from '../../src/billing-infos/billingInfoController';

describe('BillingInfo Controller', () => {
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

  describe('createBillingInfo', () => {
    it('should create billing info successfully', async () => {
      const billingInfoData = {
        gravestone_id: 1,
        contractor_id: 1,
        billing_type: 'bank_transfer',
        bank_name: 'テスト銀行',
        branch_name: 'テスト支店',
        account_type: 'savings',
        account_number: '1234567',
        account_holder: 'テスト太郎',
        remarks: 'テスト備考',
        effective_start_date: '2024-01-01',
        effective_end_date: '2024-12-31',
      };

      const mockGravestone = { id: 1, gravestone_code: 'A-01' };
      const mockContractor = { id: 1, name: 'テスト契約者' };
      const mockCreatedBillingInfo = {
        id: 1,
        ...billingInfoData,
        Gravestone: mockGravestone,
        Contractor: mockContractor,
      };

      mockRequest.body = billingInfoData;
      mockPrisma.gravestone.findFirst.mockResolvedValue(mockGravestone);
      mockPrisma.contractor.findFirst.mockResolvedValue(mockContractor);
      mockPrisma.billingInfo.create.mockResolvedValue(mockCreatedBillingInfo);

      await createBillingInfo(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockCreatedBillingInfo,
      });
    });

    it('should return validation error when required fields missing', async () => {
      mockRequest.body = { billing_type: 'bank_transfer' }; // gravestone_id and contractor_id missing

      await createBillingInfo(mockRequest as Request, mockResponse as Response);

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
    });

    it('should return 404 when gravestone not found', async () => {
      const billingInfoData = {
        gravestone_id: 999,
        contractor_id: 1,
        billing_type: 'bank_transfer',
      };

      mockRequest.body = billingInfoData;
      mockPrisma.gravestone.findFirst.mockResolvedValue(null);
      mockPrisma.contractor.findFirst.mockResolvedValue({ id: 1 });

      await createBillingInfo(mockRequest as Request, mockResponse as Response);

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
      const billingInfoData = {
        gravestone_id: 1,
        contractor_id: 999,
        billing_type: 'bank_transfer',
      };

      mockRequest.body = billingInfoData;
      mockPrisma.gravestone.findFirst.mockResolvedValue({ id: 1 });
      mockPrisma.contractor.findFirst.mockResolvedValue(null);

      await createBillingInfo(mockRequest as Request, mockResponse as Response);

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

    it('should create billing info with effective dates', async () => {
      const billingInfoData = {
        gravestone_id: 1,
        contractor_id: 1,
        billing_type: 'bank_transfer',
        effective_start_date: '2024-01-01',
        effective_end_date: '2024-12-31',
      };

      const mockGravestone = { id: 1 };
      const mockContractor = { id: 1 };
      const mockCreatedBillingInfo = { id: 1, ...billingInfoData };

      mockRequest.body = billingInfoData;
      mockPrisma.gravestone.findFirst.mockResolvedValue(mockGravestone);
      mockPrisma.contractor.findFirst.mockResolvedValue(mockContractor);
      mockPrisma.billingInfo.create.mockResolvedValue(mockCreatedBillingInfo);

      await createBillingInfo(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.billingInfo.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          effective_start_date: new Date('2024-01-01'),
          effective_end_date: new Date('2024-12-31'),
        }),
        include: expect.any(Object),
      });
    });

    it('should handle database error during creation', async () => {
      const billingInfoData = {
        gravestone_id: 1,
        contractor_id: 1,
        billing_type: 'bank_transfer',
      };

      mockRequest.body = billingInfoData;
      mockPrisma.gravestone.findFirst.mockResolvedValue({ id: 1 });
      mockPrisma.contractor.findFirst.mockResolvedValue({ id: 1 });
      mockPrisma.billingInfo.create.mockRejectedValue(new Error('Database error'));

      await createBillingInfo(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラー',
          details: [],
        },
      });
      expect(console.error).toHaveBeenCalledWith('請求情報登録エラー:', expect.any(Error));
    });
  });

  describe('updateBillingInfo', () => {
    it('should update billing info successfully', async () => {
      const updateData = {
        billing_type: 'bank_transfer',
        bank_name: '更新銀行',
        branch_name: '更新支店',
        account_type: 'checking',
        account_number: '9876543',
        account_holder: '更新太郎',
        remarks: '更新備考',
      };

      const existingBillingInfo = { id: 1, billing_type: 'cash' };
      const updatedBillingInfo = {
        id: 1,
        ...updateData,
        Gravestone: { id: 1 },
        Contractor: { id: 1 },
      };

      mockRequest.params = { id: '1' };
      mockRequest.body = updateData;
      mockPrisma.billingInfo.findFirst.mockResolvedValue(existingBillingInfo);
      mockPrisma.billingInfo.update.mockResolvedValue(updatedBillingInfo);

      await updateBillingInfo(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.billingInfo.findFirst).toHaveBeenCalledWith({
        where: {
          id: 1,
          deleted_at: null,
        },
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: updatedBillingInfo,
      });
    });

    it('should return 404 when billing info not found', async () => {
      mockRequest.params = { id: '999' };
      mockRequest.body = { billing_type: 'bank_transfer' };
      mockPrisma.billingInfo.findFirst.mockResolvedValue(null);

      await updateBillingInfo(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '請求情報が見つかりません',
          details: [],
        },
      });
    });

    it('should update billing info with effective dates', async () => {
      const updateData = {
        billing_type: 'bank_transfer',
        effective_start_date: '2024-06-01',
        effective_end_date: '2025-05-31',
      };

      const existingBillingInfo = { id: 1, billing_type: 'cash' };
      const updatedBillingInfo = { id: 1, ...updateData };

      mockRequest.params = { id: '1' };
      mockRequest.body = updateData;
      mockPrisma.billingInfo.findFirst.mockResolvedValue(existingBillingInfo);
      mockPrisma.billingInfo.update.mockResolvedValue(updatedBillingInfo);

      await updateBillingInfo(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.billingInfo.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          effective_start_date: new Date('2024-06-01'),
          effective_end_date: new Date('2025-05-31'),
        }),
        include: expect.any(Object),
      });
    });

    it('should handle database error during update', async () => {
      mockRequest.params = { id: '1' };
      mockRequest.body = { billing_type: 'bank_transfer' };
      mockPrisma.billingInfo.findFirst.mockResolvedValue({ id: 1 });
      mockPrisma.billingInfo.update.mockRejectedValue(new Error('Database error'));

      await updateBillingInfo(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラー',
          details: [],
        },
      });
      expect(console.error).toHaveBeenCalledWith('請求情報更新エラー:', expect.any(Error));
    });
  });

  describe('deleteBillingInfo', () => {
    it('should delete billing info successfully (logical delete)', async () => {
      const existingBillingInfo = { id: 1, billing_type: 'bank_transfer' };

      mockRequest.params = { id: '1' };
      mockPrisma.billingInfo.findFirst.mockResolvedValue(existingBillingInfo);
      mockPrisma.billingInfo.update.mockResolvedValue({ id: 1, deleted_at: new Date() });

      await deleteBillingInfo(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.billingInfo.findFirst).toHaveBeenCalledWith({
        where: {
          id: 1,
          deleted_at: null,
        },
      });

      expect(mockPrisma.billingInfo.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          deleted_at: expect.any(Date),
        },
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { message: '請求情報を削除しました' },
      });
    });

    it('should return 404 when billing info not found for deletion', async () => {
      mockRequest.params = { id: '999' };
      mockPrisma.billingInfo.findFirst.mockResolvedValue(null);

      await deleteBillingInfo(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '請求情報が見つかりません',
          details: [],
        },
      });
    });

    it('should handle database error during deletion', async () => {
      mockRequest.params = { id: '1' };
      mockPrisma.billingInfo.findFirst.mockResolvedValue({ id: 1 });
      mockPrisma.billingInfo.update.mockRejectedValue(new Error('Database error'));

      await deleteBillingInfo(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラー',
          details: [],
        },
      });
      expect(console.error).toHaveBeenCalledWith('請求情報削除エラー:', expect.any(Error));
    });
  });

  describe('generateBillingData', () => {
    it('should generate billing data successfully', async () => {
      const requestData = {
        billing_month: '6',
        billing_year: '2024',
        billing_types: ['bank_transfer'],
        gravestone_ids: [1, 2],
      };

      const mockBillingInfos = [
        {
          id: 1,
          billing_type: 'bank_transfer',
          bank_name: 'テスト銀行',
          branch_name: 'テスト支店',
          account_type: 'savings',
          account_number: '1234567',
          account_holder: 'テスト太郎',
          Gravestone: {
            gravestone_code: 'A-01',
            UsageFees: [{ fee: 10000 }, { fee: 5000 }],
            ManagementFees: [{ fee: 3000 }],
          },
          Contractor: {
            name: 'テスト契約者',
            address: '東京都渋谷区',
          },
        },
      ];

      mockRequest.body = requestData;
      mockPrisma.billingInfo.findMany.mockResolvedValue(mockBillingInfos);

      await generateBillingData(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.billingInfo.findMany).toHaveBeenCalledWith({
        where: {
          deleted_at: null,
          Gravestone: { deleted_at: null },
          Contractor: { deleted_at: null },
          billing_type: { in: ['bank_transfer'] },
          gravestone_id: { in: [1, 2] },
        },
        include: expect.any(Object),
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          billing_data: expect.arrayContaining([
            expect.objectContaining({
              billing_info_id: 1,
              gravestone_code: 'A-01',
              contractor_name: 'テスト契約者',
              billing_month: 6,
              billing_year: 2024,
              usage_fee_total: 15000,
              management_fee_total: 3000,
              total_amount: 18000,
            }),
          ]),
          summary: {
            total_records: 1,
            total_amount: 18000,
            billing_period: '2024年6月',
          },
        },
      });
    });

    it('should return validation error when required fields missing', async () => {
      mockRequest.body = { billing_types: ['bank_transfer'] }; // billing_month and billing_year missing

      await generateBillingData(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '必須項目が不足しています',
          details: [
            { message: '請求月と請求年は必須です' },
          ],
        },
      });
    });

    it('should generate billing data without optional filters', async () => {
      const requestData = {
        billing_month: '6',
        billing_year: '2024',
      };

      const mockBillingInfos: any[] = [];

      mockRequest.body = requestData;
      mockPrisma.billingInfo.findMany.mockResolvedValue(mockBillingInfos);

      await generateBillingData(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.billingInfo.findMany).toHaveBeenCalledWith({
        where: {
          deleted_at: null,
          Gravestone: { deleted_at: null },
          Contractor: { deleted_at: null },
        },
        include: expect.any(Object),
      });
    });

    it('should handle billing_types filter', async () => {
      const requestData = {
        billing_month: '6',
        billing_year: '2024',
        billing_types: ['bank_transfer', 'cash'],
      };

      mockRequest.body = requestData;
      mockPrisma.billingInfo.findMany.mockResolvedValue([]);

      await generateBillingData(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.billingInfo.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          billing_type: { in: ['bank_transfer', 'cash'] },
        }),
        include: expect.any(Object),
      });
    });

    it('should handle gravestone_ids filter', async () => {
      const requestData = {
        billing_month: '6',
        billing_year: '2024',
        gravestone_ids: [1, 2, 3],
      };

      mockRequest.body = requestData;
      mockPrisma.billingInfo.findMany.mockResolvedValue([]);

      await generateBillingData(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.billingInfo.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          gravestone_id: { in: [1, 2, 3] },
        }),
        include: expect.any(Object),
      });
    });

    it('should handle database error during billing data generation', async () => {
      const requestData = {
        billing_month: '6',
        billing_year: '2024',
      };

      mockRequest.body = requestData;
      mockPrisma.billingInfo.findMany.mockRejectedValue(new Error('Database error'));

      await generateBillingData(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラー',
          details: [],
        },
      });
      expect(console.error).toHaveBeenCalledWith('請求データ生成エラー:', expect.any(Error));
    });
  });
});