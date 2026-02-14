import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';

// Express.Request型を拡張（認証ミドルウェアで使用される型定義）
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        name: string;
        role: string;
        is_active: boolean;
        supabase_uid: string;
      };
    }
  }
}

// モックプリズマインスタンスの作成（新モデル対応）
const mockPrisma: any = {
  physicalPlot: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  contractPlot: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  saleContract: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  saleContractRole: {
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  customer: {
    create: jest.fn(),
    update: jest.fn(),
  },
  workInfo: {
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  billingInfo: {
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  usageFee: {
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  managementFee: {
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  $transaction: jest.fn((callback: any) => Promise.resolve(callback(mockPrisma))),
};

// PrismaClientをモック化
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
  Prisma: {
    Decimal: class MockDecimal {
      constructor(private value: number) {}
      toNumber() {
        return this.value;
      }
    },
  },
  PaymentStatus: {
    unpaid: 'unpaid',
    partial: 'partial',
    paid: 'paid',
  },
  ContractRole: {
    applicant: 'applicant',
    contractor: 'contractor',
  },
}));

// ユーティリティ関数のモック化
jest.mock('../../src/plots/utils', () => ({
  validateContractArea: jest.fn(),
  updatePhysicalPlotStatus: jest.fn(),
}));

import {
  getPlots,
  getPlotById,
  createPlot,
  updatePlot,
  deletePlot,
  getPlotContracts,
  createPlotContract,
  getPlotInventory,
} from '../../src/plots/controllers';
import { validateContractArea, updatePhysicalPlotStatus } from '../../src/plots/utils';

describe('Plot Controller (ContractPlot Model)', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let responseJson: jest.Mock;
  let responseStatus: jest.Mock;
  let mockNext: jest.Mock;

  beforeEach(() => {
    responseJson = jest.fn().mockReturnThis();
    responseStatus = jest.fn().mockReturnThis();

    mockRequest = {
      params: {},
      body: {},
      query: {},
      user: {
        id: 1,
        name: 'テストユーザー',
        email: 'test@example.com',
        role: 'admin',
        is_active: true,
        supabase_uid: 'test-uid',
      },
    };

    mockResponse = {
      status: responseStatus,
      json: responseJson,
    };

    mockNext = jest.fn();
    // モックのリセット
    jest.clearAllMocks();
    (validateContractArea as jest.Mock).mockResolvedValue({ isValid: true });
    (updatePhysicalPlotStatus as jest.Mock).mockResolvedValue(undefined);
    // $transactionモックの再設定（clearAllMocksでクリアされるため）
    mockPrisma.$transaction.mockImplementation((callback: any) =>
      Promise.resolve(callback(mockPrisma))
    );
  });

  describe('getPlots', () => {
    it('should return list of contract plots', async () => {
      const mockContractPlots = [
        {
          id: 'cp1',
          physical_plot_id: 'pp1',
          contract_area_sqm: new Prisma.Decimal(3.6),
          location_description: 'A区画',
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01'),
          deleted_at: null,
          contract_date: new Date('2024-01-01'),
          price: 1000000,
          payment_status: 'paid',
          physicalPlot: {
            id: 'pp1',
            plot_number: 'A-01',
            area_name: '一般墓地A',
            area_sqm: new Prisma.Decimal(3.6),
            status: 'sold_out',
            notes: null,
            created_at: new Date('2024-01-01'),
            updated_at: new Date('2024-01-01'),
            deleted_at: null,
          },
          saleContractRoles: [
            {
              id: 'scr1',
              role: 'contractor',
              customer: {
                id: 'c1',
                name: '山田太郎',
                name_kana: 'ヤマダタロウ',
                phone_number: '0312345678',
                address: '東京都渋谷区',
              },
            },
          ],
          managementFee: null,
        },
      ];

      mockPrisma.contractPlot.findMany.mockResolvedValue(mockContractPlots);
      mockPrisma.contractPlot.count.mockResolvedValue(1);

      mockRequest.query = { page: '1', limit: '10' };

      await getPlots(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockPrisma.contractPlot.findMany).toHaveBeenCalled();
      expect(responseStatus).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.any(Array),
        })
      );
      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              id: 'cp1',
              plotNumber: 'A-01',
              customerName: '山田太郎',
              customerRole: 'contractor',
            }),
          ]),
        })
      );
    });

    it('should calculate next billing date from last_billing_month', async () => {
      const mockContractPlots = [
        {
          id: 'cp1',
          physical_plot_id: 'pp1',
          contract_area_sqm: new Prisma.Decimal(3.6),
          location_description: 'A区画',
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01'),
          deleted_at: null,
          contract_date: new Date('2024-01-01'),
          price: 1000000,
          payment_status: 'paid',
          physicalPlot: {
            plot_number: 'A-01',
            area_name: '一般墓地A',
            area_sqm: new Prisma.Decimal(3.6),
            status: 'sold_out',
          },
          saleContractRoles: [
            {
              id: 'scr1',
              role: 'contractor',
              customer: {
                name: '山田太郎',
                name_kana: 'ヤマダタロウ',
                phone_number: '0312345678',
                address: '東京都渋谷区',
              },
            },
          ],
          managementFee: {
            management_fee: '12000',
            last_billing_month: '2024年3月',
          },
        },
      ];

      mockPrisma.contractPlot.findMany.mockResolvedValue(mockContractPlots);

      await getPlots(mockRequest as Request, mockResponse as Response, mockNext);

      expect(responseStatus).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.arrayContaining([
            expect.objectContaining({
              nextBillingDate: expect.any(Date),
              managementFee: '12000',
            }),
          ]),
        })
      );
    });

    it('should handle contract plots without sale contract', async () => {
      const mockContractPlots = [
        {
          id: 'cp1',
          physical_plot_id: 'pp1',
          contract_area_sqm: new Prisma.Decimal(3.6),
          location_description: 'A区画',
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01'),
          contract_date: new Date('2024-01-01'),
          price: 1000000, // Int型
          payment_status: 'unpaid',
          physicalPlot: {
            plot_number: 'A-01',
            area_name: '一般墓地A',
            area_sqm: new Prisma.Decimal(3.6),
            status: 'available',
          },
          saleContractRoles: [],
          managementFee: null,
        },
      ];

      mockPrisma.contractPlot.findMany.mockResolvedValue(mockContractPlots);

      await getPlots(mockRequest as Request, mockResponse as Response, mockNext);

      expect(responseStatus).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.arrayContaining([
            expect.objectContaining({
              id: 'cp1',
              customerName: null,
              customerNameKana: null,
              customerPhoneNumber: null,
              customerAddress: null,
              customerRole: null,
              contractDate: new Date('2024-01-01'),
              price: 1000000,
              paymentStatus: 'unpaid',
            }),
          ]),
        })
      );
    });

    it('should return empty array when no contract plots exist', async () => {
      mockPrisma.contractPlot.findMany.mockResolvedValue([]);

      await getPlots(mockRequest as Request, mockResponse as Response, mockNext);

      expect(responseStatus).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: [],
        })
      );
    });
  });

  describe('getPlotById', () => {
    it('should return contract plot details', async () => {
      const mockContractPlot = {
        id: 'cp1',
        physical_plot_id: 'pp1',
        contract_area_sqm: new Prisma.Decimal(3.6),
        location_description: 'A区画',
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01'),
        deleted_at: null,
        contract_date: new Date('2024-01-01'),
        price: 1000000,
        payment_status: 'paid',
        reservation_date: null,
        acceptance_number: null,
        permit_date: null,
        start_date: null,
        notes: null,
        physicalPlot: {
          id: 'pp1',
          plot_number: 'A-01',
          area_name: '一般墓地A',
          area_sqm: new Prisma.Decimal(3.6),
          status: 'sold_out',
          notes: null,
        },
        buriedPersons: [],
        familyContacts: [],
        gravestoneInfo: null,
        constructionInfos: [],
        collectiveBurial: null,
        saleContractRoles: [
          {
            id: 'scr1',
            role: 'contractor',
            role_start_date: null,
            role_end_date: null,
            notes: null,
            customer: {
              id: 'c1',
              name: '山田太郎',
              name_kana: 'ヤマダタロウ',
              birth_date: null,
              gender: null,
              postal_code: '150-0001',
              address: '東京都渋谷区',
              registered_address: null,
              phone_number: '0312345678',
              fax_number: null,
              email: null,
              notes: null,
              workInfo: null,
              billingInfo: null,
            },
          },
        ],
        usageFee: null,
        managementFee: null,
      };

      mockPrisma.contractPlot.findUnique.mockResolvedValue(mockContractPlot);
      mockRequest.params = { id: 'cp1' };

      await getPlotById(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockPrisma.contractPlot.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'cp1' }),
        })
      );
      expect(responseStatus).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.any(Object),
        })
      );
    });

    it('should return 404 when contract plot not found', async () => {
      mockPrisma.contractPlot.findUnique.mockResolvedValue(null);
      mockRequest.params = { id: 'non-existent' };

      await getPlotById(mockRequest as Request, mockResponse as Response, mockNext);

      expect(responseStatus).toHaveBeenCalledWith(404);
      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'NOT_FOUND',
          }),
        })
      );
    });
  });

  describe('createPlot', () => {
    it('should create new contract plot with all related data', async () => {
      const mockInput = {
        physicalPlot: {
          plotNumber: 'A-01',
          areaName: '一般墓地A',
          areaSqm: 3.6,
        },
        contractPlot: {
          contractAreaSqm: 3.6,
          saleStatus: 'contracted',
        },
        saleContract: {
          contractDate: '2024-01-01',
          price: 1000000,
        },
        customer: {
          name: '山田太郎',
          nameKana: 'ヤマダタロウ',
          postalCode: '150-0001',
          address: '東京都渋谷区',
          phoneNumber: '0312345678',
        },
      };

      const mockPhysicalPlot = {
        id: 'pp1',
        plot_number: 'A-01',
        area_name: '一般墓地A',
        area_sqm: new Prisma.Decimal(3.6),
        status: 'sold_out',
      };
      const mockCustomer = { id: 'c1', name: '山田太郎' };
      const mockContractPlot = {
        id: 'cp1',
        physical_plot_id: 'pp1',
        contract_date: new Date('2024-01-01'),
        price: 1000000,
        payment_status: 'unpaid',
      };
      const mockCreatedContractPlot = {
        id: 'cp1',
        physical_plot_id: 'pp1',
        contract_area_sqm: new Prisma.Decimal(3.6),
        location_description: null,
        contract_date: new Date('2024-01-01'),
        price: 1000000,
        payment_status: 'unpaid',
        created_at: new Date(),
        updated_at: new Date(),
        physicalPlot: mockPhysicalPlot,
        saleContractRoles: [
          {
            id: 'scr1',
            role: 'contractor',
            customer: mockCustomer,
          },
        ],
        usageFee: null,
        managementFee: null,
      };

      mockPrisma.physicalPlot.create.mockResolvedValue(mockPhysicalPlot);
      mockPrisma.customer.create.mockResolvedValue(mockCustomer);
      mockPrisma.contractPlot.create.mockResolvedValue(mockContractPlot);
      mockPrisma.saleContractRole.create.mockResolvedValue({ id: 'scr1', customer: mockCustomer });
      mockPrisma.contractPlot.findUnique.mockResolvedValue(mockCreatedContractPlot);

      mockRequest.body = mockInput;

      try {
        await createPlot(mockRequest as Request, mockResponse as Response, mockNext);
      } catch (error) {
        console.error('Error during createPlot:', error);
      }

      // デバッグ: 実際のレスポンスを確認
      console.log('responseStatus called:', responseStatus.mock.calls.length, 'times');
      console.log('responseJson called:', responseJson.mock.calls.length, 'times');
      if (responseStatus.mock.calls.length > 0) {
        console.log('Response Status:', responseStatus.mock.calls[0][0]);
      }
      if (responseJson.mock.calls.length > 0) {
        console.log('Response JSON:', JSON.stringify(responseJson.mock.calls[0][0], null, 2));
      }
      console.log('$transaction called:', mockPrisma.$transaction.mock.calls.length, 'times');

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(validateContractArea).toHaveBeenCalled();
      expect(updatePhysicalPlotStatus).toHaveBeenCalled();
      expect(responseStatus).toHaveBeenCalledWith(201);
      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
    });

    it('should use existing physical plot when id is provided', async () => {
      const mockInput = {
        physicalPlot: {
          id: 'pp1',
        },
        contractPlot: {
          contractAreaSqm: 3.6,
        },
        saleContract: {
          contractDate: '2024-01-01',
          price: 1000000,
        },
        customer: {
          name: '山田太郎',
          nameKana: 'ヤマダタロウ',
          postalCode: '150-0001',
          address: '東京都渋谷区',
          phoneNumber: '0312345678',
        },
      };

      const mockPhysicalPlot = {
        id: 'pp1',
        plot_number: 'A-01',
        area_sqm: new Prisma.Decimal(7.2),
      };
      const mockCustomer = { id: 'c1' };
      const mockContractPlot = { id: 'cp1' };
      const mockSaleContract = { id: 'sc1' };

      mockPrisma.physicalPlot.findUnique.mockResolvedValue(mockPhysicalPlot);
      mockPrisma.customer.create.mockResolvedValue(mockCustomer);
      mockPrisma.contractPlot.create.mockResolvedValue(mockContractPlot);
      mockPrisma.saleContract.create.mockResolvedValue(mockSaleContract);

      mockRequest.body = mockInput;

      await createPlot(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockPrisma.physicalPlot.findUnique).toHaveBeenCalled();
      expect(mockPrisma.physicalPlot.create).not.toHaveBeenCalled();
      expect(responseStatus).toHaveBeenCalledWith(201);
    });

    it('should return 400 when required fields are missing', async () => {
      mockRequest.body = {
        physicalPlot: {},
        // contractPlot, saleContract, customer が欠けている
      };

      await createPlot(mockRequest as Request, mockResponse as Response, mockNext);

      expect(responseStatus).toHaveBeenCalledWith(400);
      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
          }),
        })
      );
    });

    it('should return 400 when contract area is zero or negative', async () => {
      mockRequest.body = {
        physicalPlot: {
          plotNumber: 'A-01',
          areaName: '一般墓地A',
        },
        contractPlot: {
          contractAreaSqm: 0,
        },
        saleContract: {
          contractDate: '2024-01-01',
          price: 1000000,
        },
        customer: {
          name: '山田太郎',
          nameKana: 'ヤマダタロウ',
          postalCode: '150-0001',
          address: '東京都渋谷区',
          phoneNumber: '0312345678',
        },
      };

      await createPlot(mockRequest as Request, mockResponse as Response, mockNext);

      expect(responseStatus).toHaveBeenCalledWith(400);
      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: '契約面積は0より大きい値を指定してください',
          }),
        })
      );
    });

    it('should return 400 when contract area validation fails', async () => {
      (validateContractArea as jest.Mock).mockResolvedValue({
        isValid: false,
        message: '契約面積が物理区画の面積を超えています',
      });

      mockPrisma.physicalPlot.create.mockResolvedValue({ id: 'pp1' });

      mockRequest.body = {
        physicalPlot: {
          plotNumber: 'A-01',
          areaName: '一般墓地A',
          areaSqm: 3.6,
        },
        contractPlot: {
          contractAreaSqm: 10.0, // 超過
        },
        saleContract: {
          contractDate: '2024-01-01',
          price: 1000000,
        },
        customer: {
          name: '山田太郎',
          nameKana: 'ヤマダタロウ',
          postalCode: '150-0001',
          address: '東京都渋谷区',
          phoneNumber: '0312345678',
        },
      };

      await createPlot(mockRequest as Request, mockResponse as Response, mockNext);

      expect(responseStatus).toHaveBeenCalledWith(400);
    });

    it('should create work info and billing info when provided', async () => {
      const mockInput = {
        physicalPlot: {
          plotNumber: 'A-01',
          areaName: '一般墓地A',
          areaSqm: 3.6,
        },
        contractPlot: {
          contractAreaSqm: 3.6,
        },
        saleContract: {
          contractDate: '2024-01-01',
          price: 1000000,
        },
        customer: {
          name: '山田太郎',
          nameKana: 'ヤマダタロウ',
          postalCode: '150-0001',
          address: '東京都渋谷区',
          phoneNumber: '0312345678',
        },
        workInfo: {
          companyName: 'テスト株式会社',
          companyNameKana: 'テストカブシキガイシャ',
          workPostalCode: '100-0001',
          workAddress: '東京都千代田区',
          workPhoneNumber: '0311111111',
          dmSetting: 'allow',
          addressType: 'work',
        },
        billingInfo: {
          billingType: 'company',
          bankName: 'テスト銀行',
          branchName: 'テスト支店',
          accountType: 'ordinary',
          accountNumber: '1234567',
          accountHolder: 'ヤマダタロウ',
        },
      };

      mockPrisma.physicalPlot.create.mockResolvedValue({ id: 'pp1' });
      mockPrisma.customer.create.mockResolvedValue({ id: 'c1' });
      mockPrisma.contractPlot.create.mockResolvedValue({ id: 'cp1' });
      mockPrisma.saleContract.create.mockResolvedValue({ id: 'sc1' });
      mockPrisma.workInfo.create.mockResolvedValue({ id: 'wi1' });
      mockPrisma.billingInfo.create.mockResolvedValue({ id: 'bi1' });

      mockRequest.body = mockInput;

      await createPlot(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockPrisma.workInfo.create).toHaveBeenCalled();
      expect(mockPrisma.billingInfo.create).toHaveBeenCalled();
      expect(responseStatus).toHaveBeenCalledWith(201);
    });

    it('should create usage fee and management fee when provided', async () => {
      const mockInput = {
        physicalPlot: {
          plotNumber: 'A-01',
          areaName: '一般墓地A',
          areaSqm: 3.6,
        },
        contractPlot: {
          contractAreaSqm: 3.6,
        },
        saleContract: {
          contractDate: '2024-01-01',
          price: 1000000,
        },
        customer: {
          name: '山田太郎',
          nameKana: 'ヤマダタロウ',
          postalCode: '150-0001',
          address: '東京都渋谷区',
          phoneNumber: '0312345678',
        },
        usageFee: {
          calculationType: 'area',
          taxType: 'included',
          usageFee: 50000,
          area: 3.6,
          unitPrice: 13888.89,
          paymentMethod: 'cash',
        },
        managementFee: {
          calculationType: 'area',
          taxType: 'included',
          billingType: 'annual',
          billingYears: 1,
          area: 3.6,
          billingMonth: '4月',
          managementFee: 12000,
          unitPrice: 3333.33,
          lastBillingMonth: '2024年4月',
          paymentMethod: 'bank_transfer',
        },
      };

      mockPrisma.physicalPlot.create.mockResolvedValue({ id: 'pp1' });
      mockPrisma.customer.create.mockResolvedValue({ id: 'c1' });
      mockPrisma.contractPlot.create.mockResolvedValue({ id: 'cp1' });
      mockPrisma.saleContract.create.mockResolvedValue({ id: 'sc1' });
      mockPrisma.usageFee.create.mockResolvedValue({ id: 'uf1' });
      mockPrisma.managementFee.create.mockResolvedValue({ id: 'mf1' });

      mockRequest.body = mockInput;

      await createPlot(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockPrisma.usageFee.create).toHaveBeenCalled();
      expect(mockPrisma.managementFee.create).toHaveBeenCalled();
      expect(responseStatus).toHaveBeenCalledWith(201);
    });

    it('should return error when plotNumber and areaName are missing for new physical plot', async () => {
      mockRequest.body = {
        physicalPlot: {
          areaSqm: 3.6,
          // plotNumber and areaName missing
        },
        contractPlot: {
          contractAreaSqm: 3.6,
        },
        saleContract: {
          contractDate: '2024-01-01',
          price: 1000000,
        },
        customer: {
          name: '山田太郎',
          nameKana: 'ヤマダタロウ',
          postalCode: '150-0001',
          address: '東京都渋谷区',
          phoneNumber: '0312345678',
        },
      };

      await createPlot(mockRequest as Request, mockResponse as Response, mockNext);

      expect(responseStatus).toHaveBeenCalledWith(400);
      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: '新規物理区画作成時は plotNumber と areaName が必須です',
          }),
        })
      );
    });
  });

  describe('updatePlot', () => {
    it('should return error when contract area exceeds physical plot area', async () => {
      const mockExistingPlot = {
        id: 'cp1',
        physical_plot_id: 'pp1',
        contract_area_sqm: new Prisma.Decimal(3.6),
        physicalPlot: {
          id: 'pp1',
          area_sqm: new Prisma.Decimal(7.2),
        },
        saleContractRoles: [
          {
            id: 'scr1',
            customer: {
              id: 'c1',
              workInfo: null,
              billingInfo: null,
            },
          },
        ],
        usageFee: null,
        managementFee: null,
      };

      mockPrisma.contractPlot.findUnique.mockResolvedValue(mockExistingPlot);
      mockPrisma.contractPlot.findMany.mockResolvedValue([
        {
          id: 'cp2',
          contract_area_sqm: new Prisma.Decimal(3.0),
        },
      ]);

      mockRequest.params = { id: 'cp1' };
      mockRequest.body = {
        contractPlot: {
          contractAreaSqm: 5.0, // Total would be 8.0 > 7.2
        },
      };

      await updatePlot(mockRequest as Request, mockResponse as Response, mockNext);

      expect(responseStatus).toHaveBeenCalledWith(400);
      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
          }),
        })
      );
    });
  });

  describe('deletePlot', () => {
    it('should return 404 when contract plot not found', async () => {
      mockPrisma.contractPlot.findUnique.mockResolvedValue(null);
      mockRequest.params = { id: 'non-existent' };

      await deletePlot(mockRequest as Request, mockResponse as Response, mockNext);

      expect(responseStatus).toHaveBeenCalledWith(404);
    });
  });

  describe('getPlotContracts', () => {
    it('should return all contracts for a physical plot', async () => {
      const mockPhysicalPlot = {
        id: 'pp1',
        plot_number: 'A-01',
        area_name: '一般墓地A',
        area_sqm: new Prisma.Decimal(7.2),
        status: 'partial',
        contractPlots: [
          {
            id: 'cp1',
            contract_area_sqm: new Prisma.Decimal(3.6),
            location_description: 'A区画-1',
            created_at: new Date('2024-01-01'),
            contract_date: new Date('2024-01-01'),
            price: 1000000,
            payment_status: 'paid',
            saleContractRoles: [
              {
                id: 'scr1',
                role: 'contractor',
                customer: {
                  id: 'c1',
                  name: '山田太郎',
                  name_kana: 'ヤマダタロウ',
                  phone_number: '0312345678',
                },
              },
            ],
            usageFee: null,
            managementFee: null,
          },
        ],
      };

      mockPrisma.physicalPlot.findUnique.mockResolvedValue(mockPhysicalPlot);
      mockRequest.params = { id: 'pp1' };

      await getPlotContracts(mockRequest as Request, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            physicalPlot: expect.any(Object),
            contracts: expect.any(Array),
            summary: expect.objectContaining({
              totalContracts: 1,
              totalAllocatedArea: 3.6,
            }),
          }),
        })
      );
    });

    it('should return 404 when physical plot not found', async () => {
      mockPrisma.physicalPlot.findUnique.mockResolvedValue(null);
      mockRequest.params = { id: 'non-existent' };

      await getPlotContracts(mockRequest as Request, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(404);
    });
  });

  describe('createPlotContract', () => {
    it('should return 404 when physical plot not found', async () => {
      mockPrisma.physicalPlot.findUnique.mockResolvedValue(null);
      mockRequest.params = { id: 'non-existent' };
      mockRequest.body = {};

      await createPlotContract(mockRequest as Request, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(404);
    });

    it('should return 400 when contract area validation fails', async () => {
      (validateContractArea as jest.Mock).mockResolvedValue({
        isValid: false,
        message: '契約面積が利用可能面積を超えています',
      });

      mockPrisma.physicalPlot.findUnique.mockResolvedValue({ id: 'pp1' });
      mockRequest.params = { id: 'pp1' };
      mockRequest.body = {
        contractPlot: {
          contractAreaSqm: 10.0,
        },
        saleContract: {},
        customer: {},
      };

      await createPlotContract(mockRequest as Request, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(400);
    });
  });

  describe('getPlotInventory', () => {
    it('should return inventory status for physical plot', async () => {
      const mockPhysicalPlot = {
        id: 'pp1',
        plot_number: 'A-01',
        area_name: '一般墓地A',
        area_sqm: new Prisma.Decimal(7.2),
        status: 'partial',
        contractPlots: [
          {
            id: 'cp1',
            contract_area_sqm: new Prisma.Decimal(3.6),
            saleContractRoles: [
              {
                id: 'scr1',
                role: 'contractor',
                customer: {
                  name: '山田太郎',
                },
              },
            ],
          },
        ],
      };

      mockPrisma.physicalPlot.findUnique.mockResolvedValue(mockPhysicalPlot);
      mockRequest.params = { id: 'pp1' };

      await getPlotInventory(mockRequest as Request, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            inventory: expect.objectContaining({
              totalArea: 7.2,
              allocatedArea: 3.6,
              availableArea: 3.6,
              utilizationRate: 50,
              status: 'partial',
            }),
          }),
        })
      );
    });

    it('should return 404 when physical plot not found', async () => {
      mockPrisma.physicalPlot.findUnique.mockResolvedValue(null);
      mockRequest.params = { id: 'non-existent' };

      await getPlotInventory(mockRequest as Request, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(404);
    });
  });
});
