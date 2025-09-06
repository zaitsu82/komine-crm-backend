import { Request, Response } from 'express';

const mockPrisma = {
  contractorHistory: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

import {
  getContractorHistories,
  createContractorHistory
} from '../../src/contractor-histories/contractorHistoryController';

describe('ContractorHistory Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockRequest = { params: {}, body: {} };
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

  describe('getContractorHistories', () => {
    it('should return contractor histories', async () => {
      mockRequest.params = { contract_id: '1' };
      mockPrisma.contractorHistory.findMany.mockResolvedValue([]);

      await getContractorHistories(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: [],
      });
    });

    it('should handle database error', async () => {
      mockRequest.params = { contract_id: '1' };
      mockPrisma.contractorHistory.findMany.mockRejectedValue(new Error('DB error'));

      await getContractorHistories(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  describe('createContractorHistory', () => {
    it('should return validation error for missing fields', async () => {
      mockRequest.params = { contract_id: '1' };
      mockRequest.body = {};

      await createContractorHistory(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(422);
    });

    it('should create contractor history successfully', async () => {
      mockRequest.params = { contract_id: '1' };
      mockRequest.body = {
        contractor_id: 1,
        name: 'テストユーザー',
        name_kana: 'てすとゆーざー',
        birth_date: '1980-01-01',
        postal_code: '123-4567',
        address1: '東京都',
        address2: '新宿区',
        phone1: '03-1234-5678',
        change_date: '2024-01-01',
        change_reason: '結婚',
      };
      
      const mockHistory = { id: 1 };
      mockPrisma.contractorHistory.create.mockResolvedValue(mockHistory);

      await createContractorHistory(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          id: 1,
          message: '契約者履歴が正常に作成されました'
        }
      });
    });

    it('should handle database error', async () => {
      mockRequest.params = { contract_id: '1' };
      mockRequest.body = {
        contractor_id: 1,
        name: 'テストユーザー',
        name_kana: 'てすとゆーざー',
        birth_date: '1980-01-01',
        postal_code: '123-4567',
        address1: '東京都',
        address2: '新宿区',
        phone1: '03-1234-5678',
        change_date: '2024-01-01',
        change_reason: '結婚',
      };
      mockPrisma.contractorHistory.create.mockRejectedValue(new Error('DB error'));

      await createContractorHistory(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });
});