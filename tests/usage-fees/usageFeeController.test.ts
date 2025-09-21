import { Request, Response } from 'express';

const mockPrisma = {
  usageFee: {
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
  createUsageFee,
  updateUsageFee,
  deleteUsageFee,
} from '../../src/usage-fees/usageFeeController';

describe('Usage Fee Controller', () => {
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

  describe('createUsageFee', () => {
    it('should create usage fee successfully with all fields', async () => {
      const usageFeeData = {
        gravestone_id: 1,
        calc_type: 'area_based',
        area: '15.5',
        fee: '120000',
        tax_type: 'included',
        billing_years: 10,
        unit_price: '8000',
        payment_method: 'bank_transfer',
        remarks: '使用料テスト備考',
        effective_start_date: '2024-01-01',
        effective_end_date: '2034-12-31',
      };

      const mockGravestone = { id: 1, gravestone_code: 'B-15' };
      const mockCreatedUsageFee = {
        id: 1,
        ...usageFeeData,
        area: 15.5,
        fee: 120000,
        unit_price: 8000,
        Gravestone: mockGravestone,
      };

      mockRequest.body = usageFeeData;
      mockPrisma.gravestone.findFirst.mockResolvedValue(mockGravestone);
      mockPrisma.usageFee.create.mockResolvedValue(mockCreatedUsageFee);

      await createUsageFee(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.usageFee.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          gravestone_id: 1,
          calc_type: 'area_based',
          area: 15.5,
          fee: 120000,
          tax_type: 'included',
          billing_years: 10,
          unit_price: 8000,
          payment_method: 'bank_transfer',
          remarks: '使用料テスト備考',
          effective_start_date: new Date('2024-01-01'),
          effective_end_date: new Date('2034-12-31'),
        }),
        include: { Gravestone: true },
      });

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockCreatedUsageFee,
      });
    });

    it('should create usage fee with minimal required fields', async () => {
      const usageFeeData = {
        gravestone_id: 1,
        fee: '50000',
      };

      const mockGravestone = { id: 1 };
      const mockCreatedUsageFee = {
        id: 1,
        gravestone_id: 1,
        fee: 50000,
        Gravestone: mockGravestone,
      };

      mockRequest.body = usageFeeData;
      mockPrisma.gravestone.findFirst.mockResolvedValue(mockGravestone);
      mockPrisma.usageFee.create.mockResolvedValue(mockCreatedUsageFee);

      await createUsageFee(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.usageFee.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          gravestone_id: 1,
          fee: 50000,
          area: null,
          unit_price: null,
          effective_start_date: null,
          effective_end_date: null,
        }),
        include: { Gravestone: true },
      });

      expect(mockResponse.status).toHaveBeenCalledWith(201);
    });

    it('should return validation error when gravestone_id is missing', async () => {
      mockRequest.body = { fee: '50000' };

      await createUsageFee(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '必須項目が不足しています',
          details: [
            { message: '墓石IDと料金は必須です' },
          ],
        },
      });
    });

    it('should return validation error when fee is missing', async () => {
      mockRequest.body = { gravestone_id: 1 };

      await createUsageFee(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '必須項目が不足しています',
          details: [
            { message: '墓石IDと料金は必須です' },
          ],
        },
      });
    });

    it('should return validation error when both required fields are missing', async () => {
      mockRequest.body = { calc_type: 'fixed_amount' };

      await createUsageFee(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '必須項目が不足しています',
          details: [
            { message: '墓石IDと料金は必須です' },
          ],
        },
      });
    });

    it('should return 404 when gravestone not found', async () => {
      const usageFeeData = {
        gravestone_id: 999,
        fee: '50000',
      };

      mockRequest.body = usageFeeData;
      mockPrisma.gravestone.findFirst.mockResolvedValue(null);

      await createUsageFee(mockRequest as Request, mockResponse as Response);

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
      const usageFeeData = {
        gravestone_id: 1,
        fee: '50000',
      };

      mockRequest.body = usageFeeData;
      mockPrisma.gravestone.findFirst.mockResolvedValue({ id: 1 });
      mockPrisma.usageFee.create.mockRejectedValue(new Error('Database error'));

      await createUsageFee(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラー',
          details: [],
        },
      });
      expect(console.error).toHaveBeenCalledWith('使用料登録エラー:', expect.any(Error));
    });
  });

  describe('updateUsageFee', () => {
    it('should update usage fee successfully', async () => {
      const updateData = {
        calc_type: 'fixed_amount',
        area: '20.0',
        fee: '150000',
        tax_type: 'excluded',
        billing_years: 5,
        unit_price: '10000',
        payment_method: 'credit_card',
        remarks: '更新されたテスト備考',
      };

      const existingUsageFee = { id: 1, gravestone_id: 1 };
      const updatedUsageFee = {
        id: 1,
        ...updateData,
        area: 20.0,
        fee: 150000,
        unit_price: 10000,
        Gravestone: { id: 1 },
      };

      mockRequest.params = { id: '1' };
      mockRequest.body = updateData;
      mockPrisma.usageFee.findFirst.mockResolvedValue(existingUsageFee);
      mockPrisma.usageFee.update.mockResolvedValue(updatedUsageFee);

      await updateUsageFee(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.usageFee.findFirst).toHaveBeenCalledWith({
        where: {
          id: 1,
          deleted_at: null,
        },
      });

      expect(mockPrisma.usageFee.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          calc_type: 'fixed_amount',
          area: 20.0,
          fee: 150000,
          tax_type: 'excluded',
          billing_years: 5,
          unit_price: 10000,
          payment_method: 'credit_card',
          remarks: '更新されたテスト備考',
        }),
        include: { Gravestone: true },
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: updatedUsageFee,
      });
    });

    it('should update usage fee with date fields', async () => {
      const updateData = {
        effective_start_date: '2024-06-01',
        effective_end_date: '2029-05-31',
        unit_price: '7500',
      };

      const existingUsageFee = { id: 1 };
      const updatedUsageFee = { id: 1, ...updateData };

      mockRequest.params = { id: '1' };
      mockRequest.body = updateData;
      mockPrisma.usageFee.findFirst.mockResolvedValue(existingUsageFee);
      mockPrisma.usageFee.update.mockResolvedValue(updatedUsageFee);

      await updateUsageFee(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.usageFee.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          effective_start_date: new Date('2024-06-01'),
          effective_end_date: new Date('2029-05-31'),
          unit_price: 7500,
        }),
        include: { Gravestone: true },
      });
    });

    it('should update usage fee with undefined values when fields not provided', async () => {
      const updateData = {
        calc_type: 'area_based',
        payment_method: 'bank_transfer',
      };

      const existingUsageFee = { id: 1 };
      const updatedUsageFee = { id: 1, ...updateData };

      mockRequest.params = { id: '1' };
      mockRequest.body = updateData;
      mockPrisma.usageFee.findFirst.mockResolvedValue(existingUsageFee);
      mockPrisma.usageFee.update.mockResolvedValue(updatedUsageFee);

      await updateUsageFee(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.usageFee.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          calc_type: 'area_based',
          payment_method: 'bank_transfer',
          area: undefined,
          fee: undefined,
          unit_price: undefined,
          effective_start_date: undefined,
          effective_end_date: undefined,
        }),
        include: { Gravestone: true },
      });
    });

    it('should return 404 when usage fee not found', async () => {
      mockRequest.params = { id: '999' };
      mockRequest.body = { calc_type: 'fixed_amount' };
      mockPrisma.usageFee.findFirst.mockResolvedValue(null);

      await updateUsageFee(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '使用料が見つかりません',
          details: [],
        },
      });
    });

    it('should handle database error during update', async () => {
      mockRequest.params = { id: '1' };
      mockRequest.body = { calc_type: 'fixed_amount' };
      mockPrisma.usageFee.findFirst.mockResolvedValue({ id: 1 });
      mockPrisma.usageFee.update.mockRejectedValue(new Error('Database error'));

      await updateUsageFee(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラー',
          details: [],
        },
      });
      expect(console.error).toHaveBeenCalledWith('使用料更新エラー:', expect.any(Error));
    });
  });

  describe('deleteUsageFee', () => {
    it('should delete usage fee successfully', async () => {
      const existingUsageFee = { id: 1, gravestone_id: 1 };

      mockRequest.params = { id: '1' };
      mockPrisma.usageFee.findFirst.mockResolvedValue(existingUsageFee);
      mockPrisma.usageFee.update.mockResolvedValue({ id: 1, deleted_at: new Date() });

      await deleteUsageFee(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.usageFee.findFirst).toHaveBeenCalledWith({
        where: {
          id: 1,
          deleted_at: null,
        },
      });

      expect(mockPrisma.usageFee.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          deleted_at: expect.any(Date),
        },
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { message: '使用料を削除しました' },
      });
    });

    it('should return 404 when usage fee not found for deletion', async () => {
      mockRequest.params = { id: '999' };
      mockPrisma.usageFee.findFirst.mockResolvedValue(null);

      await deleteUsageFee(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '使用料が見つかりません',
          details: [],
        },
      });
    });

    it('should handle database error during deletion', async () => {
      mockRequest.params = { id: '1' };
      mockPrisma.usageFee.findFirst.mockResolvedValue({ id: 1 });
      mockPrisma.usageFee.update.mockRejectedValue(new Error('Database error'));

      await deleteUsageFee(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラー',
          details: [],
        },
      });
      expect(console.error).toHaveBeenCalledWith('使用料削除エラー:', expect.any(Error));
    });
  });

  describe('Edge cases and error scenarios', () => {
    it('should handle parseFloat errors in createUsageFee', async () => {
      const usageFeeData = {
        gravestone_id: 1,
        fee: 'invalid_number',
      };

      const mockGravestone = { id: 1 };

      mockRequest.body = usageFeeData;
      mockPrisma.gravestone.findFirst.mockResolvedValue(mockGravestone);

      await createUsageFee(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(console.error).toHaveBeenCalledWith('使用料登録エラー:', expect.any(Error));
    });

    it('should handle parseInt errors in updateUsageFee', async () => {
      mockRequest.params = { id: 'invalid_id' };
      mockRequest.body = { calc_type: 'fixed_amount' };

      await updateUsageFee(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(console.error).toHaveBeenCalledWith('使用料更新エラー:', expect.any(Error));
    });

    it('should handle parseInt errors in deleteUsageFee', async () => {
      mockRequest.params = { id: 'invalid_id' };

      await deleteUsageFee(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(console.error).toHaveBeenCalledWith('使用料削除エラー:', expect.any(Error));
    });
  });
});