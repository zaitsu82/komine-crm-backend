import { Request, Response } from 'express';

// モックプリズマインスタンスの作成
const mockPrisma = {
  contract: {
    findFirst: jest.fn(),
  },
};

// PrismaClientをモック化
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

import { checkContractNumber, validateContractData } from '../../src/validations/validationController';

describe('Validation Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockRequest = {
      query: {},
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

  describe('checkContractNumber', () => {
    it('should return not duplicate when contract number does not exist', async () => {
      mockRequest.query = { number: '1234' };
      (mockPrisma.contract.findFirst as jest.Mock).mockResolvedValue(null);

      await checkContractNumber(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.contract.findFirst).toHaveBeenCalledWith({
        where: {
          contractNumber: '1234',
        },
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          is_duplicate: false,
        },
      });
    });

    it('should return duplicate when contract number exists', async () => {
      mockRequest.query = { number: '1234' };
      (mockPrisma.contract.findFirst as jest.Mock).mockResolvedValue({ id: 1 });

      await checkContractNumber(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          is_duplicate: true,
        },
      });
    });

    it('should exclude specified id when checking duplicate', async () => {
      mockRequest.query = { number: '1234', exclude_id: '1' };
      (mockPrisma.contract.findFirst as jest.Mock).mockResolvedValue(null);

      await checkContractNumber(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.contract.findFirst).toHaveBeenCalledWith({
        where: {
          contractNumber: '1234',
          id: {
            not: 1,
          },
        },
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          is_duplicate: false,
        },
      });
    });

    it('should return validation error when number is not provided', async () => {
      mockRequest.query = {};

      await checkContractNumber(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '承諾書番号が指定されていません',
          details: [],
        },
      });
      expect(mockPrisma.contract.findFirst).not.toHaveBeenCalled();
    });

    it('should handle database error', async () => {
      mockRequest.query = { number: '1234' };
      (mockPrisma.contract.findFirst as jest.Mock).mockRejectedValue(new Error('Database error'));

      await checkContractNumber(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラーが発生しました',
          details: [],
        },
      });
      expect(console.error).toHaveBeenCalledWith('Error checking contract number:', expect.any(Error));
    });
  });

  describe('validateContractData', () => {
    const validContractData = {
      applicant: {
        name: 'テスト申込者',
        name_kana: 'てすともうしこみしゃ',
        postal_code: '123-4567',
        address1: '福岡県福岡市博多区住吉',
        address2: '1-20-15',
        phone1: '012-345-6789',
      },
      contract: {
        contract_number: '1234',
        application_date: '2004-05-01',
        permission_date: '2004-05-01',
        start_date: '2004-05-01',
      },
      contractor: {
        name: 'テスト契約者',
        name_kana: 'てすとけいやくしゃ',
        birth_date: '1958-05-10',
        gender: 'male',
        postal_code: '123-4567',
        address1: '福岡県福岡市博多区住吉',
        address2: '1-20-15',
        phone1: '012-345-6789',
        permanent_address1: '神奈川県相模原市相生',
        permanent_address2: '1-1-1',
      },
      usage_fee: {
        calculation_type: '任意設定',
        tax_type: 'tax_included',
        billing_type: '永代',
        billing_years: 10,
        area: 1.30,
        total_amount: 195000,
        payment_method_id: 1,
      },
      management_fee: {
        calculation_type: '任意設定',
        tax_type: 'tax_included',
        billing_type: 'あり',
        billing_years: 10,
        area: 1.30,
        billing_month_interval: 36,
        management_fee: 29900,
        last_billing_month: '2024-03-01',
        payment_method_id: 1,
      },
      gravestone: {
        gravestone_price: 797600,
        dealer: '小嶺',
        grave_type_id: 1,
      },
      contractor_detail: {
        dm_setting: 'send',
        mailing_address_type: 'home',
      },
    };

    it('should return success for valid contract data', async () => {
      mockRequest.body = validContractData;
      (mockPrisma.contract.findFirst as jest.Mock).mockResolvedValue(null);

      await validateContractData(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          message: 'バリデーションが正常に完了しました',
        },
      });
    });

    it('should return validation errors for missing required fields', async () => {
      mockRequest.body = {};

      await validateContractData(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(422);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '入力値にエラーがあります',
          details: expect.arrayContaining([
            { field: 'applicant.name', message: '申込者の氏名は必須です' },
            { field: 'contractor.name', message: '契約者の氏名は必須です' },
          ]),
        },
      });
    });

    it('should return duplicate contract number error', async () => {
      mockRequest.body = validContractData;
      (mockPrisma.contract.findFirst as jest.Mock).mockResolvedValue({ id: 1 });

      await validateContractData(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(422);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '入力値にエラーがあります',
          details: expect.arrayContaining([
            { field: 'contract.contract_number', message: '承諾書番号が重複しています' },
          ]),
        },
      });
    });

    it('should handle database error', async () => {
      mockRequest.body = validContractData;
      (mockPrisma.contract.findFirst as jest.Mock).mockRejectedValue(new Error('Database error'));

      await validateContractData(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラーが発生しました',
          details: [],
        },
      });
      expect(console.error).toHaveBeenCalledWith('Error validating contract data:', expect.any(Error));
    });
  });
});