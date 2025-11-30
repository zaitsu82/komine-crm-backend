import { Request, Response } from 'express';
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
  customer: {
    create: jest.fn(),
    update: jest.fn(),
  },
  workInfo: {
    create: jest.fn(),
    update: jest.fn(),
  },
  billingInfo: {
    create: jest.fn(),
    update: jest.fn(),
  },
  usageFee: {
    create: jest.fn(),
    update: jest.fn(),
  },
  managementFee: {
    create: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn((callback: any) => callback(mockPrisma)),
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
}));

// ユーティリティ関数のモック化
jest.mock('../../src/utils/inventoryUtils', () => ({
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
import { validateContractArea, updatePhysicalPlotStatus } from '../../src/utils/inventoryUtils';

describe('Plot Controller (ContractPlot Model)', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let responseJson: jest.Mock;
  let responseStatus: jest.Mock;

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

    // モックのリセット
    jest.clearAllMocks();
    (validateContractArea as jest.Mock).mockResolvedValue({ isValid: true });
    (updatePhysicalPlotStatus as jest.Mock).mockResolvedValue(undefined);
  });

  describe('getPlots', () => {
    it('should return list of contract plots', async () => {
      const mockContractPlots = [
        {
          id: 'cp1',
          physical_plot_id: 'pp1',
          contract_area_sqm: new Prisma.Decimal(3.6),
          sale_status: 'contracted',
          location_description: 'A区画',
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01'),
          deleted_at: null,
          PhysicalPlot: {
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
          SaleContract: {
            id: 'sc1',
            contract_date: new Date('2024-01-01'),
            price: new Prisma.Decimal(1000000),
            payment_status: 'paid',
            customer_role: null,
            Customer: {
              id: 'c1',
              name: '山田太郎',
              name_kana: 'ヤマダタロウ',
              phone_number: '03-1234-5678',
              address: '東京都渋谷区',
            },
          },
          ManagementFee: null,
        },
      ];

      mockPrisma.contractPlot.findMany.mockResolvedValue(mockContractPlots);
      mockPrisma.contractPlot.count.mockResolvedValue(1);

      mockRequest.query = { page: '1', limit: '10' };

      await getPlots(mockRequest as Request, mockResponse as Response);

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
            }),
          ]),
        })
      );
    });

    it('should handle errors gracefully', async () => {
      mockPrisma.contractPlot.findMany.mockRejectedValue(new Error('Database error'));

      await getPlots(mockRequest as Request, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(500);
      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INTERNAL_SERVER_ERROR',
          }),
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
        sale_status: 'contracted',
        location_description: 'A区画',
        PhysicalPlot: {
          id: 'pp1',
          plot_number: 'A-01',
          area_name: '一般墓地A',
          area_sqm: new Prisma.Decimal(3.6),
          status: 'sold_out',
          notes: null,
          BuriedPersons: [],
          CollectiveBurials: [],
          FamilyContacts: [],
        },
        SaleContract: {
          id: 'sc1',
          contract_date: new Date('2024-01-01'),
          price: new Prisma.Decimal(1000000),
          payment_status: 'paid',
          customer_role: null,
          reservation_date: null,
          acceptance_number: null,
          permit_date: null,
          start_date: null,
          notes: null,
          Customer: {
            id: 'c1',
            name: '山田太郎',
            name_kana: 'ヤマダタロウ',
            birth_date: null,
            gender: null,
            postal_code: '150-0001',
            address: '東京都渋谷区',
            registered_address: null,
            phone_number: '03-1234-5678',
            fax_number: null,
            email: null,
            notes: null,
            WorkInfo: null,
            BillingInfo: null,
          },
        },
        UsageFee: null,
        ManagementFee: null,
      };

      mockPrisma.contractPlot.findUnique.mockResolvedValue(mockContractPlot);
      mockRequest.params = { id: 'cp1' };

      await getPlotById(mockRequest as Request, mockResponse as Response);

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

      await getPlotById(mockRequest as Request, mockResponse as Response);

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
          phoneNumber: '03-1234-5678',
        },
      };

      const mockPhysicalPlot = { id: 'pp1', plot_number: 'A-01' };
      const mockCustomer = { id: 'c1', name: '山田太郎' };
      const mockContractPlot = { id: 'cp1', physical_plot_id: 'pp1' };
      const mockSaleContract = { id: 'sc1', contract_plot_id: 'cp1' };

      mockPrisma.physicalPlot.create.mockResolvedValue(mockPhysicalPlot);
      mockPrisma.customer.create.mockResolvedValue(mockCustomer);
      mockPrisma.contractPlot.create.mockResolvedValue(mockContractPlot);
      mockPrisma.saleContract.create.mockResolvedValue(mockSaleContract);

      mockRequest.body = mockInput;

      await createPlot(mockRequest as Request, mockResponse as Response);

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

    it('should return 400 when required fields are missing', async () => {
      mockRequest.body = {
        physicalPlot: {},
        // contractPlot, saleContract, customer が欠けている
      };

      await createPlot(mockRequest as Request, mockResponse as Response);

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
          phoneNumber: '03-1234-5678',
        },
      };

      await createPlot(mockRequest as Request, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(400);
    });
  });

  describe('updatePlot', () => {
    it('should update existing contract plot', async () => {
      const mockExistingPlot = {
        id: 'cp1',
        physical_plot_id: 'pp1',
        contract_area_sqm: new Prisma.Decimal(3.6),
        SaleContract: {
          id: 'sc1',
          Customer: {
            id: 'c1',
            WorkInfo: null,
            BillingInfo: null,
          },
        },
        UsageFee: null,
        ManagementFee: null,
      };

      const mockPhysicalPlot = {
        id: 'pp1',
        area_sqm: new Prisma.Decimal(3.6),
      };

      mockPrisma.contractPlot.findUnique.mockResolvedValue(mockExistingPlot);
      mockPrisma.physicalPlot.findUnique.mockResolvedValue(mockPhysicalPlot);
      mockPrisma.contractPlot.findMany.mockResolvedValue([]);

      mockRequest.params = { id: 'cp1' };
      mockRequest.body = {
        contractPlot: {
          saleStatus: 'completed',
        },
      };

      await updatePlot(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(responseStatus).toHaveBeenCalledWith(200);
    });

    it('should return 404 when contract plot not found', async () => {
      mockPrisma.contractPlot.findUnique.mockResolvedValue(null);
      mockRequest.params = { id: 'non-existent' };
      mockRequest.body = {};

      await updatePlot(mockRequest as Request, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(400);
    });
  });

  describe('deletePlot', () => {
    it('should soft delete contract plot and related data', async () => {
      const mockContractPlot = {
        id: 'cp1',
        physical_plot_id: 'pp1',
        SaleContract: {
          id: 'sc1',
          Customer: {
            id: 'c1',
            WorkInfo: { id: 'wi1' },
            BillingInfo: { id: 'bi1' },
          },
        },
        UsageFee: { id: 'uf1' },
        ManagementFee: { id: 'mf1' },
      };

      mockPrisma.contractPlot.findUnique.mockResolvedValue(mockContractPlot);
      mockPrisma.saleContract.findMany.mockResolvedValue([]); // 他の契約なし

      mockRequest.params = { id: 'cp1' };

      await deletePlot(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(updatePhysicalPlotStatus).toHaveBeenCalled();
      expect(responseStatus).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            message: '契約区画を削除しました',
          }),
        })
      );
    });

    it('should return 404 when contract plot not found', async () => {
      mockPrisma.contractPlot.findUnique.mockResolvedValue(null);
      mockRequest.params = { id: 'non-existent' };

      await deletePlot(mockRequest as Request, mockResponse as Response);

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
        ContractPlots: [
          {
            id: 'cp1',
            contract_area_sqm: new Prisma.Decimal(3.6),
            sale_status: 'contracted',
            location_description: 'A区画-1',
            created_at: new Date('2024-01-01'),
            SaleContract: {
              id: 'sc1',
              contract_date: new Date('2024-01-01'),
              price: new Prisma.Decimal(1000000),
              payment_status: 'paid',
              Customer: {
                id: 'c1',
                name: '山田太郎',
                name_kana: 'ヤマダタロウ',
                phone_number: '03-1234-5678',
              },
            },
            UsageFee: null,
            ManagementFee: null,
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
    it('should create new contract for existing physical plot', async () => {
      const mockPhysicalPlot = { id: 'pp1', area_sqm: new Prisma.Decimal(7.2) };
      const mockCustomer = { id: 'c1' };
      const mockContractPlot = { id: 'cp2' };
      const mockSaleContract = { id: 'sc2' };

      mockPrisma.physicalPlot.findUnique.mockResolvedValue(mockPhysicalPlot);
      mockPrisma.customer.create.mockResolvedValue(mockCustomer);
      mockPrisma.contractPlot.create.mockResolvedValue(mockContractPlot);
      mockPrisma.saleContract.create.mockResolvedValue(mockSaleContract);

      mockRequest.params = { id: 'pp1' };
      mockRequest.body = {
        contractPlot: {
          contractAreaSqm: 3.6,
        },
        saleContract: {
          contractDate: '2024-01-01',
          price: 1000000,
        },
        customer: {
          name: '田中花子',
          nameKana: 'タナカハナコ',
          postalCode: '150-0001',
          address: '東京都渋谷区',
          phoneNumber: '03-1234-5678',
        },
      };

      await createPlotContract(mockRequest as Request, mockResponse as Response);

      expect(validateContractArea).toHaveBeenCalled();
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(updatePhysicalPlotStatus).toHaveBeenCalled();
      expect(responseStatus).toHaveBeenCalledWith(201);
    });

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
        ContractPlots: [
          {
            id: 'cp1',
            contract_area_sqm: new Prisma.Decimal(3.6),
            sale_status: 'contracted',
            SaleContract: {
              Customer: {
                name: '山田太郎',
              },
            },
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
