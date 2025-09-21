import { Request, Response } from 'express';

// モックプリズマインスタンスの作成
const mockPrisma = {
  contractor: {
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
    jest.spyOn(console, 'error').mockImplementation(() => { });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('checkContractNumber', () => {
    it('should return not duplicate when contract number does not exist', async () => {
      mockRequest.query = { number: '1234' };
      (mockPrisma.contractor.findFirst as jest.Mock).mockResolvedValue(null);

      await checkContractNumber(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.contractor.findFirst).toHaveBeenCalledWith({
        where: {
          consent_form_number: '1234',
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
      (mockPrisma.contractor.findFirst as jest.Mock).mockResolvedValue({ id: 1 });

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
      (mockPrisma.contractor.findFirst as jest.Mock).mockResolvedValue(null);

      await checkContractNumber(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.contractor.findFirst).toHaveBeenCalledWith({
        where: {
          consent_form_number: '1234',
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
      expect(mockPrisma.contractor.findFirst).not.toHaveBeenCalled();
    });

    it('should handle database error', async () => {
      mockRequest.query = { number: '1234' };
      (mockPrisma.contractor.findFirst as jest.Mock).mockRejectedValue(new Error('Database error'));

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
      (mockPrisma.contractor.findFirst as jest.Mock).mockResolvedValue(null);

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
      (mockPrisma.contractor.findFirst as jest.Mock).mockResolvedValue({ id: 1 });

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
      (mockPrisma.contractor.findFirst as jest.Mock).mockRejectedValue(new Error('Database error'));

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

    it('should validate all applicant required fields', async () => {
      mockRequest.body = {
        applicant: {}, // 空の申込者情報
        contract: { contract_number: 'test' },
        contractor: { name: 'test' },
        usage_fee: {},
        management_fee: {},
        gravestone: {},
        contractor_detail: {}
      };
      (mockPrisma.contractor.findFirst as jest.Mock).mockResolvedValue(null);

      await validateContractData(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(422);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '入力値にエラーがあります',
          details: expect.arrayContaining([
            { field: 'applicant.name', message: '申込者の氏名は必須です' },
            { field: 'applicant.name_kana', message: '申込者のふりがなは必須です' },
            { field: 'applicant.postal_code', message: '申込者の郵便番号は必須です' },
            { field: 'applicant.address1', message: '申込者の住所1は必須です' },
            { field: 'applicant.address2', message: '申込者の住所2は必須です' },
            { field: 'applicant.phone1', message: '申込者の電話番号1は必須です' },
          ]),
        },
      });
    });

    it('should validate all contract required fields', async () => {
      mockRequest.body = {
        applicant: { name: 'test' },
        contract: {}, // 空の契約情報
        contractor: { name: 'test' },
        usage_fee: {},
        management_fee: {},
        gravestone: {},
        contractor_detail: {}
      };

      await validateContractData(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(422);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '入力値にエラーがあります',
          details: expect.arrayContaining([
            { field: 'contract.contract_number', message: '承諾書番号は必須です' },
            { field: 'contract.application_date', message: '申込日は必須です' },
            { field: 'contract.permission_date', message: '許可日は必須です' },
            { field: 'contract.start_date', message: '開始年月日は必須です' },
          ]),
        },
      });
    });

    it('should validate all contractor required fields', async () => {
      mockRequest.body = {
        applicant: { name: 'test' },
        contract: { contract_number: 'test' },
        contractor: {}, // 空の契約者情報
        usage_fee: {},
        management_fee: {},
        gravestone: {},
        contractor_detail: {}
      };
      (mockPrisma.contractor.findFirst as jest.Mock).mockResolvedValue(null);

      await validateContractData(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(422);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '入力値にエラーがあります',
          details: expect.arrayContaining([
            { field: 'contractor.name', message: '契約者の氏名は必須です' },
            { field: 'contractor.name_kana', message: '契約者のふりがなは必須です' },
            { field: 'contractor.birth_date', message: '契約者の生年月日は必須です' },
            { field: 'contractor.gender', message: '契約者の性別は必須です' },
            { field: 'contractor.postal_code', message: '契約者の郵便番号は必須です' },
            { field: 'contractor.address1', message: '契約者の住所1は必須です' },
            { field: 'contractor.address2', message: '契約者の住所2は必須です' },
            { field: 'contractor.phone1', message: '契約者の電話番号1は必須です' },
            { field: 'contractor.permanent_address1', message: '契約者の本籍住所1は必須です' },
            { field: 'contractor.permanent_address2', message: '契約者の本籍住所2は必須です' },
          ]),
        },
      });
    });

    it('should validate all usage_fee required fields including zero values', async () => {
      mockRequest.body = {
        applicant: { name: 'test' },
        contract: { contract_number: 'test' },
        contractor: { name: 'test' },
        usage_fee: {
          billing_years: undefined,
          area: null,
          total_amount: undefined
        }, // 使用料情報の一部がundefined/null
        management_fee: {},
        gravestone: {},
        contractor_detail: {}
      };
      (mockPrisma.contractor.findFirst as jest.Mock).mockResolvedValue(null);

      await validateContractData(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(422);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '入力値にエラーがあります',
          details: expect.arrayContaining([
            { field: 'usage_fee.calculation_type', message: '使用料の計算区分は必須です' },
            { field: 'usage_fee.tax_type', message: '使用料の税区分は必須です' },
            { field: 'usage_fee.billing_type', message: '使用料の請求区分は必須です' },
            { field: 'usage_fee.billing_years', message: '使用料の請求年数は必須です' },
            { field: 'usage_fee.area', message: '使用料の面積は必須です' },
            { field: 'usage_fee.total_amount', message: '使用料は必須です' },
            { field: 'usage_fee.payment_method_id', message: '使用料の支払方法は必須です' },
          ]),
        },
      });
    });

    it('should validate all management_fee required fields including zero values', async () => {
      mockRequest.body = {
        applicant: { name: 'test' },
        contract: { contract_number: 'test' },
        contractor: { name: 'test' },
        usage_fee: { billing_years: 1, area: 1, total_amount: 1 },
        management_fee: {
          billing_years: null,
          area: undefined,
          billing_month_interval: null,
          management_fee: undefined
        }, // 管理料情報の一部がundefined/null
        gravestone: {},
        contractor_detail: {}
      };
      (mockPrisma.contractor.findFirst as jest.Mock).mockResolvedValue(null);

      await validateContractData(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(422);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '入力値にエラーがあります',
          details: expect.arrayContaining([
            { field: 'management_fee.calculation_type', message: '管理料の計算区分は必須です' },
            { field: 'management_fee.tax_type', message: '管理料の税区分は必須です' },
            { field: 'management_fee.billing_type', message: '管理料の請求区分は必須です' },
            { field: 'management_fee.billing_years', message: '管理料の請求年数は必須です' },
            { field: 'management_fee.area', message: '管理料の面積は必須です' },
            { field: 'management_fee.billing_month_interval', message: '管理料の請求月間隔は必須です' },
            { field: 'management_fee.management_fee', message: '管理料は必須です' },
            { field: 'management_fee.last_billing_month', message: '管理料の最終請求月は必須です' },
            { field: 'management_fee.payment_method_id', message: '管理料の支払方法は必須です' },
          ]),
        },
      });
    });

    it('should validate all gravestone required fields including zero values', async () => {
      mockRequest.body = {
        applicant: { name: 'test' },
        contract: { contract_number: 'test' },
        contractor: { name: 'test' },
        usage_fee: { billing_years: 1, area: 1, total_amount: 1 },
        management_fee: { billing_years: 1, area: 1, billing_month_interval: 1, management_fee: 1 },
        gravestone: {
          gravestone_price: undefined
        }, // 墓石情報の一部がundefined
        contractor_detail: {}
      };
      (mockPrisma.contractor.findFirst as jest.Mock).mockResolvedValue(null);

      await validateContractData(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(422);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '入力値にエラーがあります',
          details: expect.arrayContaining([
            { field: 'gravestone.gravestone_price', message: '墓石代は必須です' },
            { field: 'gravestone.dealer', message: '墓石取扱は必須です' },
            { field: 'gravestone.grave_type_id', message: '墓地タイプは必須です' },
          ]),
        },
      });
    });

    it('should validate all contractor_detail required fields', async () => {
      mockRequest.body = {
        applicant: { name: 'test' },
        contract: { contract_number: 'test' },
        contractor: { name: 'test' },
        usage_fee: { billing_years: 1, area: 1, total_amount: 1 },
        management_fee: { billing_years: 1, area: 1, billing_month_interval: 1, management_fee: 1 },
        gravestone: { gravestone_price: 1 },
        contractor_detail: {} // 空の契約者詳細情報
      };
      (mockPrisma.contractor.findFirst as jest.Mock).mockResolvedValue(null);

      await validateContractData(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(422);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '入力値にエラーがあります',
          details: expect.arrayContaining([
            { field: 'contractor_detail.dm_setting', message: 'DM設定は必須です' },
            { field: 'contractor_detail.mailing_address_type', message: '宛先区分は必須です' },
          ]),
        },
      });
    });

    it('should not check for duplicate when contract_number is not provided', async () => {
      mockRequest.body = {
        applicant: { name: 'test' },
        contract: {}, // contract_numberなし
        contractor: { name: 'test' },
        usage_fee: {},
        management_fee: {},
        gravestone: {},
        contractor_detail: {}
      };

      await validateContractData(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.contractor.findFirst).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(422);
    });
  });
});