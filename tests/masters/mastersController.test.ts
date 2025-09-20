import { Request, Response } from 'express';

// モックプリズマインスタンスの作成
const mockPrisma = {
  staff: {
    findMany: jest.fn(),
  },
  paymentMethodMaster: {
    findMany: jest.fn(),
  },
  cemeteryTypeMaster: {
    findMany: jest.fn(),
  },
  denominationMaster: {
    findMany: jest.fn(),
  },
};

// PrismaClientをモック化
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

import { getStaff, getPaymentMethods, getGraveTypes, getReligiousSects } from '../../src/masters/mastersController';

describe('Masters Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockRequest = {};
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

  describe('getStaff', () => {
    it('should return staff list successfully', async () => {
      const mockStaffData = [
        {
          id: 1,
          name: 'Test User 1',
          email: 'test1@example.com',
          is_active: true,
        },
        {
          id: 2,
          name: 'Test User 2',
          email: 'test2@example.com',
          is_active: false,
        }
      ];

      (mockPrisma.staff.findMany as jest.Mock).mockResolvedValue(mockStaffData);

      await getStaff(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.staff.findMany).toHaveBeenCalledWith({
        select: {
          id: true,
          name: true,
          email: true,
          is_active: true,
        },
        orderBy: {
          name: 'asc',
        },
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: [
          {
            id: 1,
            name: 'Test User 1',
            email: 'test1@example.com',
            is_active: true,
          },
          {
            id: 2,
            name: 'Test User 2',
            email: 'test2@example.com',
            is_active: false,
          }
        ],
      });
    });

    it('should handle empty staff list', async () => {
      (mockPrisma.staff.findMany as jest.Mock).mockResolvedValue([]);

      await getStaff(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: [],
      });
    });

    it('should handle database error', async () => {
      (mockPrisma.staff.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      await getStaff(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラーが発生しました',
          details: [],
        },
      });
      expect(console.error).toHaveBeenCalledWith('Error fetching staff:', expect.any(Error));
    });
  });

  describe('getPaymentMethods', () => {
    it('should return payment methods list successfully', async () => {
      const mockPaymentMethods = [
        { id: 1, name: '振込' },
        { id: 2, name: '口座振替' },
      ];

      (mockPrisma.paymentMethodMaster.findMany as jest.Mock).mockResolvedValue(mockPaymentMethods);

      await getPaymentMethods(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.paymentMethodMaster.findMany).toHaveBeenCalledWith({
        select: {
          id: true,
          name: true,
        },
        orderBy: {
          id: 'asc',
        },
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockPaymentMethods,
      });
    });

    it('should handle empty payment methods list', async () => {
      (mockPrisma.paymentMethodMaster.findMany as jest.Mock).mockResolvedValue([]);

      await getPaymentMethods(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: [],
      });
    });

    it('should handle database error', async () => {
      (mockPrisma.paymentMethodMaster.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      await getPaymentMethods(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラーが発生しました',
          details: [],
        },
      });
      expect(console.error).toHaveBeenCalledWith('Error fetching payment methods:', expect.any(Error));
    });
  });

  describe('getGraveTypes', () => {
    it('should return grave types list successfully', async () => {
      const mockGraveTypes = [
        { id: 1, code: 'J3', name: '一般墓地J3' },
        { id: 2, code: 'S1', name: '特別墓地S1' },
      ];

      (mockPrisma.cemeteryTypeMaster.findMany as jest.Mock).mockResolvedValue(mockGraveTypes);

      await getGraveTypes(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.cemeteryTypeMaster.findMany).toHaveBeenCalledWith({
        select: {
          id: true,
          code: true,
          name: true,
        },
        orderBy: {
          code: 'asc',
        },
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockGraveTypes,
      });
    });

    it('should handle empty grave types list', async () => {
      (mockPrisma.cemeteryTypeMaster.findMany as jest.Mock).mockResolvedValue([]);

      await getGraveTypes(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: [],
      });
    });

    it('should handle database error', async () => {
      (mockPrisma.cemeteryTypeMaster.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      await getGraveTypes(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラーが発生しました',
          details: [],
        },
      });
      expect(console.error).toHaveBeenCalledWith('Error fetching grave types:', expect.any(Error));
    });
  });

  describe('getReligiousSects', () => {
    it('should return religious sects list successfully', async () => {
      const mockReligiousSects = [
        { id: 1, name: 'なし' },
        { id: 2, name: '浄土宗' },
        { id: 3, name: '真言宗' },
      ];

      (mockPrisma.denominationMaster.findMany as jest.Mock).mockResolvedValue(mockReligiousSects);

      await getReligiousSects(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.denominationMaster.findMany).toHaveBeenCalledWith({
        select: {
          id: true,
          name: true,
        },
        orderBy: {
          name: 'asc',
        },
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockReligiousSects,
      });
    });

    it('should handle empty religious sects list', async () => {
      (mockPrisma.denominationMaster.findMany as jest.Mock).mockResolvedValue([]);

      await getReligiousSects(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: [],
      });
    });

    it('should handle database error', async () => {
      (mockPrisma.denominationMaster.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      await getReligiousSects(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラーが発生しました',
          details: [],
        },
      });
      expect(console.error).toHaveBeenCalledWith('Error fetching religious sects:', expect.any(Error));
    });
  });
});