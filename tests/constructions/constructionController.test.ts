import { Request, Response } from 'express';

const mockPrisma = {
  construction: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

import {
  getConstructions,
  createConstruction,
  updateConstruction,
  deleteConstruction
} from '../../src/constructions/constructionController';

describe('Construction Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockRequest = { params: {}, body: {} };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => { });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getConstructions', () => {
    it('should return constructions', async () => {
      mockRequest.params = { contract_id: '1' };
      mockPrisma.construction.findMany.mockResolvedValue([]);

      await getConstructions(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: [],
      });
    });

    it('should return error for invalid contract_id', async () => {
      mockRequest.params = { contract_id: 'invalid' };

      await getConstructions(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_PARAMETER',
          message: '無効な契約IDです',
          details: [],
        },
      });
    });

    it('should handle database error', async () => {
      mockRequest.params = { contract_id: '1' };
      mockPrisma.construction.findMany.mockRejectedValue(new Error('DB error'));

      await getConstructions(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  describe('createConstruction', () => {
    it('should return validation error for missing fields', async () => {
      mockRequest.params = { contract_id: '1' };
      mockRequest.body = {};

      await createConstruction(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(422);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'バリデーションエラーが発生しました',
          details: [
            'contractor_name は必須です',
            'construction_type は必須です'
          ],
        },
      });
    });

    it('should return validation error for missing contractor_name only', async () => {
      mockRequest.params = { contract_id: '1' };
      mockRequest.body = {
        construction_type: '新設'
      };

      await createConstruction(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(422);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'バリデーションエラーが発生しました',
          details: [
            'contractor_name は必須です'
          ],
        },
      });
    });

    it('should return validation error for missing construction_type only', async () => {
      mockRequest.params = { contract_id: '1' };
      mockRequest.body = {
        contractor_name: 'テスト業者'
      };

      await createConstruction(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(422);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'バリデーションエラーが発生しました',
          details: [
            'construction_type は必須です'
          ],
        },
      });
    });

    it('should return error for invalid contract_id', async () => {
      mockRequest.params = { contract_id: 'invalid' };
      mockRequest.body = {
        contractor_name: 'テスト業者',
        construction_type: '新設'
      };

      await createConstruction(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_PARAMETER',
          message: '無効な契約IDです',
          details: [],
        },
      });
    });

    it('should create construction successfully', async () => {
      mockRequest.params = { contract_id: '1' };
      mockRequest.body = {
        contractor_name: 'テスト業者',
        construction_type: '新設',
        construction_details: '墓石設置',
        construction_amount: 500000,
        payment_amount: 500000
      };

      const mockConstruction = { id: 1 };
      mockPrisma.construction.create.mockResolvedValue(mockConstruction);

      await createConstruction(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          id: 1,
          message: '工事情報が正常に作成されました'
        }
      });
    });

    it('should create construction with date fields', async () => {
      mockRequest.params = { contract_id: '1' };
      mockRequest.body = {
        contractor_name: 'テスト業者',
        construction_type: '新設',
        start_date: '2024-01-01',
        planned_end_date: '2024-02-01',
        end_date: '2024-01-31'
      };

      const mockConstruction = { id: 1 };
      mockPrisma.construction.create.mockResolvedValue(mockConstruction);

      await createConstruction(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.construction.create).toHaveBeenCalledWith({
        data: {
          gravestone_id: 1,
          contractor_name: 'テスト業者',
          construction_type: '新設',
          start_date: new Date('2024-01-01'),
          planned_end_date: new Date('2024-02-01'),
          end_date: new Date('2024-01-31'),
          description: undefined,
          cost: undefined,
          payment_amount: undefined,
          remarks: undefined,
        },
      });
    });

    it('should create construction without date fields', async () => {
      mockRequest.params = { contract_id: '1' };
      mockRequest.body = {
        contractor_name: 'テスト業者',
        construction_type: '新設'
      };

      const mockConstruction = { id: 1 };
      mockPrisma.construction.create.mockResolvedValue(mockConstruction);

      await createConstruction(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.construction.create).toHaveBeenCalledWith({
        data: {
          gravestone_id: 1,
          contractor_name: 'テスト業者',
          construction_type: '新設',
          start_date: null,
          planned_end_date: null,
          end_date: null,
          description: undefined,
          cost: undefined,
          payment_amount: undefined,
          remarks: undefined,
        },
      });
    });

    it('should handle database error', async () => {
      mockRequest.params = { contract_id: '1' };
      mockRequest.body = {
        contractor_name: 'テスト業者',
        construction_type: '新設'
      };

      mockPrisma.construction.create.mockRejectedValue(new Error('DB error'));

      await createConstruction(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  describe('updateConstruction', () => {
    it('should return validation error for missing fields', async () => {
      mockRequest.params = { construction_id: '1' };
      mockRequest.body = {};

      await updateConstruction(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(422);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'バリデーションエラーが発生しました',
          details: [
            'contractor_name は必須です',
            'construction_type は必須です'
          ],
        },
      });
    });

    it('should return validation error for missing contractor_name only', async () => {
      mockRequest.params = { construction_id: '1' };
      mockRequest.body = {
        construction_type: '修繕'
      };

      await updateConstruction(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(422);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'バリデーションエラーが発生しました',
          details: [
            'contractor_name は必須です'
          ],
        },
      });
    });

    it('should return validation error for missing construction_type only', async () => {
      mockRequest.params = { construction_id: '1' };
      mockRequest.body = {
        contractor_name: '更新業者'
      };

      await updateConstruction(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(422);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'バリデーションエラーが発生しました',
          details: [
            'construction_type は必須です'
          ],
        },
      });
    });

    it('should update construction successfully', async () => {
      mockRequest.params = { construction_id: '1' };
      mockRequest.body = {
        contractor_name: '更新業者',
        construction_type: '修繕'
      };

      const mockConstruction = { id: 1 };
      mockPrisma.construction.update.mockResolvedValue(mockConstruction);

      await updateConstruction(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          id: 1,
          message: '工事情報が正常に更新されました'
        }
      });
    });

    it('should update construction with date fields', async () => {
      mockRequest.params = { construction_id: '1' };
      mockRequest.body = {
        contractor_name: '更新業者',
        construction_type: '修繕',
        start_date: '2024-01-01',
        planned_end_date: '2024-02-01',
        end_date: '2024-01-31'
      };

      const mockConstruction = { id: 1 };
      mockPrisma.construction.update.mockResolvedValue(mockConstruction);

      await updateConstruction(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.construction.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          contractor_name: '更新業者',
          construction_type: '修繕',
          start_date: new Date('2024-01-01'),
          planned_end_date: new Date('2024-02-01'),
          end_date: new Date('2024-01-31'),
          description: undefined,
          cost: undefined,
          payment_amount: undefined,
          remarks: undefined,
        },
      });
    });

    it('should update construction without date fields', async () => {
      mockRequest.params = { construction_id: '1' };
      mockRequest.body = {
        contractor_name: '更新業者',
        construction_type: '修繕'
      };

      const mockConstruction = { id: 1 };
      mockPrisma.construction.update.mockResolvedValue(mockConstruction);

      await updateConstruction(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.construction.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          contractor_name: '更新業者',
          construction_type: '修繕',
          start_date: null,
          planned_end_date: null,
          end_date: null,
          description: undefined,
          cost: undefined,
          payment_amount: undefined,
          remarks: undefined,
        },
      });
    });

    it('should handle record not found error', async () => {
      mockRequest.params = { construction_id: '1' };
      mockRequest.body = {
        contractor_name: '更新業者',
        construction_type: '修繕'
      };

      const error = new Error('Record to update not found');
      mockPrisma.construction.update.mockRejectedValue(error);

      await updateConstruction(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('should handle database error', async () => {
      mockRequest.params = { construction_id: '1' };
      mockRequest.body = {
        contractor_name: '更新業者',
        construction_type: '修繕'
      };

      mockPrisma.construction.update.mockRejectedValue(new Error('DB error'));

      await updateConstruction(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  describe('deleteConstruction', () => {
    it('should delete construction successfully', async () => {
      mockRequest.params = { construction_id: '1' };
      mockPrisma.construction.delete.mockResolvedValue({});

      await deleteConstruction(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          message: '工事情報が正常に削除されました'
        }
      });
    });

    it('should handle record not found error', async () => {
      mockRequest.params = { construction_id: '1' };
      const error = new Error('Record to delete does not exist');
      mockPrisma.construction.delete.mockRejectedValue(error);

      await deleteConstruction(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('should handle database error', async () => {
      mockRequest.params = { construction_id: '1' };
      mockPrisma.construction.delete.mockRejectedValue(new Error('DB error'));

      await deleteConstruction(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });
});