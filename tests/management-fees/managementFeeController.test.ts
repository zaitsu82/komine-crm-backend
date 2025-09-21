import { Request, Response } from 'express';

const mockPrisma = {
  managementFee: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  gravestone: {
    findFirst: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

import {
  createManagementFee,
  updateManagementFee,
  deleteManagementFee,
  calculateManagementFee,
} from '../../src/management-fees/managementFeeController';

describe('Management Fee Controller', () => {
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

  describe('createManagementFee', () => {
    it('should create management fee successfully', async () => {
      const managementFeeData = {
        gravestone_id: 1,
        calc_type: 'fixed_amount',
        billing_type: 'monthly',
        area: '10.5',
        fee: '50000',
        last_billing_date: '2024-01-01',
        tax_type: 'included',
        billing_years: 5,
        billing_month: 1,
        unit_price: '5000',
        payment_method: 'bank_transfer',
        remarks: 'テスト備考',
        effective_start_date: '2024-01-01',
        effective_end_date: '2024-12-31',
      };

      const mockGravestone = { id: 1, gravestone_code: 'A-01' };
      const mockCreatedManagementFee = {
        id: 1,
        ...managementFeeData,
        area: 10.5,
        fee: 50000,
        unit_price: 5000,
        Gravestone: mockGravestone,
      };

      mockRequest.body = managementFeeData;
      mockPrisma.gravestone.findFirst.mockResolvedValue(mockGravestone);
      mockPrisma.managementFee.create.mockResolvedValue(mockCreatedManagementFee);

      await createManagementFee(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.managementFee.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          gravestone_id: 1,
          calc_type: 'fixed_amount',
          billing_type: 'monthly',
          area: 10.5,
          fee: 50000,
          last_billing_date: new Date('2024-01-01'),
          tax_type: 'included',
          billing_years: 5,
          billing_month: 1,
          unit_price: 5000,
          payment_method: 'bank_transfer',
          remarks: 'テスト備考',
          effective_start_date: new Date('2024-01-01'),
          effective_end_date: new Date('2024-12-31'),
        }),
        include: { Gravestone: true },
      });

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockCreatedManagementFee,
      });
    });

    it('should create management fee with minimal required fields', async () => {
      const managementFeeData = {
        gravestone_id: 1,
        fee: '30000',
        payment_method: 'cash',
      };

      const mockGravestone = { id: 1 };
      const mockCreatedManagementFee = {
        id: 1,
        gravestone_id: 1,
        fee: 30000,
        payment_method: 'cash',
        Gravestone: mockGravestone,
      };

      mockRequest.body = managementFeeData;
      mockPrisma.gravestone.findFirst.mockResolvedValue(mockGravestone);
      mockPrisma.managementFee.create.mockResolvedValue(mockCreatedManagementFee);

      await createManagementFee(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.managementFee.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          gravestone_id: 1,
          fee: 30000,
          payment_method: 'cash',
          area: null,
          last_billing_date: null,
          unit_price: null,
          effective_start_date: null,
          effective_end_date: null,
        }),
        include: { Gravestone: true },
      });

      expect(mockResponse.status).toHaveBeenCalledWith(201);
    });

    it('should return validation error when required fields missing', async () => {
      mockRequest.body = { calc_type: 'fixed_amount' };

      await createManagementFee(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '必須項目が不足しています',
          details: [
            { message: '墓石ID、料金、支払い方法は必須です' },
          ],
        },
      });
    });

    it('should return 404 when gravestone not found', async () => {
      const managementFeeData = {
        gravestone_id: 999,
        fee: '30000',
        payment_method: 'cash',
      };

      mockRequest.body = managementFeeData;
      mockPrisma.gravestone.findFirst.mockResolvedValue(null);

      await createManagementFee(mockRequest as Request, mockResponse as Response);

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

    it('should handle database error during creation', async () => {
      const managementFeeData = {
        gravestone_id: 1,
        fee: '30000',
        payment_method: 'cash',
      };

      mockRequest.body = managementFeeData;
      mockPrisma.gravestone.findFirst.mockResolvedValue({ id: 1 });
      mockPrisma.managementFee.create.mockRejectedValue(new Error('Database error'));

      await createManagementFee(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラー',
          details: [],
        },
      });
      expect(console.error).toHaveBeenCalledWith('管理料登録エラー:', expect.any(Error));
    });
  });

  describe('updateManagementFee', () => {
    it('should update management fee successfully', async () => {
      const updateData = {
        calc_type: 'area_based',
        billing_type: 'yearly',
        area: '15.0',
        fee: '75000',
        payment_method: 'credit_card',
      };

      const existingManagementFee = { id: 1, gravestone_id: 1 };
      const updatedManagementFee = {
        id: 1,
        ...updateData,
        area: 15.0,
        fee: 75000,
        Gravestone: { id: 1 },
      };

      mockRequest.params = { id: '1' };
      mockRequest.body = updateData;
      mockPrisma.managementFee.findFirst.mockResolvedValue(existingManagementFee);
      mockPrisma.managementFee.update.mockResolvedValue(updatedManagementFee);

      await updateManagementFee(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.managementFee.findFirst).toHaveBeenCalledWith({
        where: {
          id: 1,
          deleted_at: null,
        },
      });

      expect(mockPrisma.managementFee.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          calc_type: 'area_based',
          billing_type: 'yearly',
          area: 15.0,
          fee: 75000,
          payment_method: 'credit_card',
        }),
        include: { Gravestone: true },
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: updatedManagementFee,
      });
    });

    it('should update management fee with date fields', async () => {
      const updateData = {
        last_billing_date: '2024-02-01',
        effective_start_date: '2024-01-01',
        effective_end_date: '2024-12-31',
        unit_price: '6000',
      };

      const existingManagementFee = { id: 1 };
      const updatedManagementFee = { id: 1, ...updateData };

      mockRequest.params = { id: '1' };
      mockRequest.body = updateData;
      mockPrisma.managementFee.findFirst.mockResolvedValue(existingManagementFee);
      mockPrisma.managementFee.update.mockResolvedValue(updatedManagementFee);

      await updateManagementFee(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.managementFee.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          last_billing_date: new Date('2024-02-01'),
          effective_start_date: new Date('2024-01-01'),
          effective_end_date: new Date('2024-12-31'),
          unit_price: 6000,
        }),
        include: { Gravestone: true },
      });
    });

    it('should update management fee with undefined date fields when not provided', async () => {
      const updateData = {
        calc_type: 'fixed_amount',
        payment_method: 'bank_transfer',
      };

      const existingManagementFee = { id: 1 };
      const updatedManagementFee = { id: 1, ...updateData };

      mockRequest.params = { id: '1' };
      mockRequest.body = updateData;
      mockPrisma.managementFee.findFirst.mockResolvedValue(existingManagementFee);
      mockPrisma.managementFee.update.mockResolvedValue(updatedManagementFee);

      await updateManagementFee(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.managementFee.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          area: undefined,
          fee: undefined,
          last_billing_date: undefined,
          unit_price: undefined,
          effective_start_date: undefined,
          effective_end_date: undefined,
        }),
        include: { Gravestone: true },
      });
    });

    it('should return 404 when management fee not found', async () => {
      mockRequest.params = { id: '999' };
      mockRequest.body = { calc_type: 'fixed_amount' };
      mockPrisma.managementFee.findFirst.mockResolvedValue(null);

      await updateManagementFee(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '管理料が見つかりません',
          details: [],
        },
      });
    });

    it('should handle database error during update', async () => {
      mockRequest.params = { id: '1' };
      mockRequest.body = { calc_type: 'fixed_amount' };
      mockPrisma.managementFee.findFirst.mockResolvedValue({ id: 1 });
      mockPrisma.managementFee.update.mockRejectedValue(new Error('Database error'));

      await updateManagementFee(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラー',
          details: [],
        },
      });
      expect(console.error).toHaveBeenCalledWith('管理料更新エラー:', expect.any(Error));
    });
  });

  describe('deleteManagementFee', () => {
    it('should delete management fee successfully', async () => {
      const existingManagementFee = { id: 1, gravestone_id: 1 };

      mockRequest.params = { id: '1' };
      mockPrisma.managementFee.findFirst.mockResolvedValue(existingManagementFee);
      mockPrisma.managementFee.update.mockResolvedValue({ id: 1, deleted_at: new Date() });

      await deleteManagementFee(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.managementFee.findFirst).toHaveBeenCalledWith({
        where: {
          id: 1,
          deleted_at: null,
        },
      });

      expect(mockPrisma.managementFee.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          deleted_at: expect.any(Date),
        },
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { message: '管理料を削除しました' },
      });
    });

    it('should return 404 when management fee not found for deletion', async () => {
      mockRequest.params = { id: '999' };
      mockPrisma.managementFee.findFirst.mockResolvedValue(null);

      await deleteManagementFee(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '管理料が見つかりません',
          details: [],
        },
      });
    });

    it('should handle database error during deletion', async () => {
      mockRequest.params = { id: '1' };
      mockPrisma.managementFee.findFirst.mockResolvedValue({ id: 1 });
      mockPrisma.managementFee.update.mockRejectedValue(new Error('Database error'));

      await deleteManagementFee(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラー',
          details: [],
        },
      });
      expect(console.error).toHaveBeenCalledWith('管理料削除エラー:', expect.any(Error));
    });
  });

  describe('calculateManagementFee', () => {
    it('should calculate area-based fee successfully', async () => {
      const calculationData = {
        gravestone_id: 1,
        calc_type: 'area_based',
        area: '10.5',
        unit_price: '5000',
        tax_rate: '10',
      };

      mockRequest.body = calculationData;

      await calculateManagementFee(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          calculation_details: '面積: 10.5㎡ × 単価: ¥5000 = ¥52500\n税額: ¥52500 × 10% = ¥5250\n合計: ¥57750',
          base_fee: 52500,
          tax_amount: 5250,
          total_fee: 57750,
          calculation_type: 'area_based',
          input_parameters: calculationData,
        },
      });
    });

    it('should calculate fixed amount fee successfully', async () => {
      const calculationData = {
        gravestone_id: 1,
        calc_type: 'fixed_amount',
        unit_price: '30000',
      };

      mockRequest.body = calculationData;

      await calculateManagementFee(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          calculation_details: '定額: ¥30000',
          base_fee: 30000,
          tax_amount: 0,
          total_fee: 30000,
          calculation_type: 'fixed_amount',
          input_parameters: calculationData,
        },
      });
    });

    it('should calculate years-based fee successfully', async () => {
      const calculationData = {
        gravestone_id: 1,
        calc_type: 'years_based',
        billing_years: '5',
        unit_price: '10000',
        tax_rate: '8',
      };

      mockRequest.body = calculationData;

      await calculateManagementFee(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          calculation_details: '請求年数: 5年 × 単価: ¥10000 = ¥50000\n税額: ¥50000 × 8% = ¥4000\n合計: ¥54000',
          base_fee: 50000,
          tax_amount: 4000,
          total_fee: 54000,
          calculation_type: 'years_based',
          input_parameters: calculationData,
        },
      });
    });

    it('should return validation error when required fields missing', async () => {
      mockRequest.body = { calc_type: 'area_based' };

      await calculateManagementFee(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '必須項目が不足しています',
          details: [
            { message: '墓石IDと計算タイプは必須です' },
          ],
        },
      });
    });

    it('should return validation error for area-based calculation without required fields', async () => {
      mockRequest.body = {
        gravestone_id: 1,
        calc_type: 'area_based',
        area: '10.5',
      };

      await calculateManagementFee(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '面積ベース計算には面積と単価が必要です',
          details: [],
        },
      });
    });

    it('should return validation error for fixed amount calculation without unit price', async () => {
      mockRequest.body = {
        gravestone_id: 1,
        calc_type: 'fixed_amount',
      };

      await calculateManagementFee(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '定額計算には金額が必要です',
          details: [],
        },
      });
    });

    it('should return validation error for years-based calculation without required fields', async () => {
      mockRequest.body = {
        gravestone_id: 1,
        calc_type: 'years_based',
        billing_years: '5',
      };

      await calculateManagementFee(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '年数ベース計算には請求年数と単価が必要です',
          details: [],
        },
      });
    });

    it('should return validation error for invalid calculation type', async () => {
      mockRequest.body = {
        gravestone_id: 1,
        calc_type: 'invalid_type',
      };

      await calculateManagementFee(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '無効な計算タイプです',
          details: [],
        },
      });
    });

    it('should handle error during calculation', async () => {
      mockRequest.body = {
        gravestone_id: 1,
        calc_type: 'fixed_amount',
        unit_price: '30000',
      };

      // Mock parseFloat to throw an error
      const originalParseFloat = global.parseFloat;
      global.parseFloat = jest.fn().mockImplementation(() => {
        throw new Error('Parsing error');
      });

      await calculateManagementFee(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラー',
          details: [],
        },
      });
      expect(console.error).toHaveBeenCalledWith('管理料計算エラー:', expect.any(Error));

      // Restore original parseFloat
      global.parseFloat = originalParseFloat;
    });
  });
});