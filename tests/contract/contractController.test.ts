import { Request, Response } from 'express';

// モックプリズマインスタンスの作成
const mockPrisma = {
  contract: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  applicant: {
    create: jest.fn(),
    update: jest.fn(),
    findFirst: jest.fn(),
  },
  contractor: {
    create: jest.fn(),
    update: jest.fn(),
    findFirst: jest.fn(),
  },
  contractorDetail: {
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
  gravestone: {
    create: jest.fn(),
    update: jest.fn(),
  },
  billingAccount: {
    create: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
};

// PrismaClientをモック化
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

import {
  getContracts,
  getContractDetail,
  createContract,
  updateContract,
  deleteContract
} from '../../src/contract/contractController';

describe('Contract Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockRequest = {
      params: {},
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

  describe('getContracts', () => {
    it('should return contracts with default pagination', async () => {
      const mockContracts = [
        {
          id: 1,
          contractNumber: '1234',
          applicationDate: new Date('2024-01-01'),
          status: 'active',
          staff: {
            id: 1,
            name: 'テストスタッフ',
          },
          contractors: [
            {
              name: 'テスト契約者',
            },
          ],
        },
      ];

      mockPrisma.contract.findMany.mockResolvedValue(mockContracts);
      mockPrisma.contract.count.mockResolvedValue(1);

      await getContracts(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.contract.findMany).toHaveBeenCalledWith({
        where: {},
        include: {
          staff: {
            select: {
              id: true,
              name: true,
            },
          },
          contractors: {
            where: {
              isCurrent: true,
            },
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          applicationDate: 'desc',
        },
        skip: 0,
        take: 20,
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          contracts: [
            {
              id: 1,
              contract_number: '1234',
              application_date: mockContracts[0].applicationDate,
              contractor_name: 'テスト契約者',
              status: 'active',
              staff: {
                id: 1,
                name: 'テストスタッフ',
              },
            },
          ],
          pagination: {
            current_page: 1,
            total_pages: 1,
            total_items: 1,
            per_page: 20,
          },
        },
      });
    });

    it('should return contracts with custom pagination', async () => {
      mockRequest.query = { page: '2', limit: '10' };
      mockPrisma.contract.findMany.mockResolvedValue([]);
      mockPrisma.contract.count.mockResolvedValue(25);

      await getContracts(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.contract.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            pagination: {
              current_page: 2,
              total_pages: 3,
              total_items: 25,
              per_page: 10,
            },
          }),
        })
      );
    });

    it('should filter contracts by search term', async () => {
      mockRequest.query = { search: 'テスト' };
      mockPrisma.contract.findMany.mockResolvedValue([]);
      mockPrisma.contract.count.mockResolvedValue(0);

      await getContracts(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.contract.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { contractNumber: { contains: 'テスト' } },
              { contractors: { some: { name: { contains: 'テスト' } } } },
            ],
          },
        })
      );
    });

    it('should filter contracts by status', async () => {
      mockRequest.query = { status: 'active' };
      mockPrisma.contract.findMany.mockResolvedValue([]);
      mockPrisma.contract.count.mockResolvedValue(0);

      await getContracts(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.contract.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: 'active',
          },
        })
      );
    });

    it('should filter contracts by staff_id', async () => {
      mockRequest.query = { staff_id: '1' };
      mockPrisma.contract.findMany.mockResolvedValue([]);
      mockPrisma.contract.count.mockResolvedValue(0);

      await getContracts(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.contract.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            staffId: 1,
          },
        })
      );
    });

    it('should handle database error', async () => {
      mockPrisma.contract.findMany.mockRejectedValue(new Error('Database error'));

      await getContracts(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラーが発生しました',
          details: [],
        },
      });
      expect(console.error).toHaveBeenCalledWith('Error fetching contracts:', expect.any(Error));
    });
  });

  describe('getContractDetail', () => {
    it('should return contract detail when found', async () => {
      const mockContractDetail = {
        id: 1,
        contractNumber: '1234',
        applicationDate: new Date('2024-01-01'),
        reservationDate: null,
        permissionDate: new Date('2024-01-01'),
        startDate: new Date('2024-01-01'),
        staffId: 1,
        status: 'active',
        applicant: {
          name: 'テスト申込者',
          nameKana: 'てすともうしこみしゃ',
          postalCode: '123-4567',
          address1: '福岡県',
          address2: '1-1-1',
          phone1: '012-345-6789',
          phone2: null,
        },
        contractors: [
          {
            id: 1,
            name: 'テスト契約者',
            nameKana: 'てすとけいやくしゃ',
            birthDate: new Date('1958-05-10'),
            gender: 'male',
            postalCode: '123-4567',
            contractorDetails: [{}],
          },
        ],
        usageFee: null,
        managementFee: null,
        gravestone: null,
        billingAccount: null,
      };

      mockRequest.params = { contract_id: '1' };
      mockPrisma.contract.findUnique.mockResolvedValue(mockContractDetail);

      await getContractDetail(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.contract.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: expect.any(Object),
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          contract: expect.objectContaining({
            id: 1,
            contract_number: '1234',
          }),
        }),
      });
    });

    it('should return 404 when contract not found', async () => {
      mockRequest.params = { contract_id: '999' };
      mockPrisma.contract.findUnique.mockResolvedValue(null);

      await getContractDetail(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '指定された契約が見つかりません',
          details: [],
        },
      });
    });

    it('should handle database error', async () => {
      mockRequest.params = { contract_id: '1' };
      mockPrisma.contract.findUnique.mockRejectedValue(new Error('Database error'));

      await getContractDetail(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラーが発生しました',
          details: [],
        },
      });
      expect(console.error).toHaveBeenCalledWith('Error fetching contract detail:', expect.any(Error));
    });
  });

  describe('deleteContract', () => {
    it('should update contract status to TERMINATED successfully', async () => {
      mockRequest.params = { contract_id: '1' };
      mockPrisma.contract.update.mockResolvedValue({ id: 1 });

      await deleteContract(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.contract.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          status: 'TERMINATED',
        },
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          message: '契約が正常に削除されました',
        },
      });
    });

    it('should return 404 when contract not found for deletion', async () => {
      mockRequest.params = { contract_id: '999' };
      const notFoundError = new Error('Record to update not found');
      mockPrisma.contract.update.mockRejectedValue(notFoundError);

      await deleteContract(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '指定された契約が見つかりません',
          details: [],
        },
      });
    });

    it('should handle database error in deletion', async () => {
      mockRequest.params = { contract_id: '1' };
      mockPrisma.contract.update.mockRejectedValue(new Error('Database error'));

      await deleteContract(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラーが発生しました',
          details: [],
        },
      });
      expect(console.error).toHaveBeenCalledWith('Error deleting contract:', expect.any(Error));
    });
  });

  // createContract と updateContract のテストは複雑なので、基本的なテストのみ実装
  describe('createContract', () => {
    it('should create contract successfully with valid data', async () => {
      const validContractData = {
        applicant: {
          name: 'テスト申込者',
          name_kana: 'てすともうしこみしゃ',
          postal_code: '123-4567',
          address1: '福岡県',
          address2: '1-1-1',
          phone1: '012-345-6789',
        },
        contract: {
          contract_number: '1234',
          application_date: '2024-01-01',
          permission_date: '2024-01-01',
          start_date: '2024-01-01',
        },
        contractor: {
          name: 'テスト契約者',
          name_kana: 'てすとけいやくしゃ',
          birth_date: '1958-05-10',
          gender: 'male',
        },
      };

      mockRequest.body = validContractData;
      mockPrisma.$transaction.mockResolvedValue({ id: 1 });

      await createContract(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          message: '契約が正常に作成されました',
          id: 1,
        },
      });
    });

    it('should handle database error during creation', async () => {
      mockRequest.body = {
        applicant: { name: 'テスト' },
        contract: { contract_number: '1234' },
        contractor: { name: 'テスト契約者' },
      };
      mockPrisma.$transaction.mockRejectedValue(new Error('Transaction error'));

      await createContract(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラーが発生しました',
          details: [],
        },
      });
    });
  });

  describe('updateContract', () => {
    it('should update contract successfully', async () => {
      mockRequest.params = { contract_id: '1' };
      mockRequest.body = {
        contract: { contract_number: '1234-updated' },
      };
      mockPrisma.contract.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.$transaction.mockResolvedValue({ id: 1 });

      await updateContract(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          message: '契約が正常に更新されました',
        },
      });
    });

    it('should handle database error during update', async () => {
      mockRequest.params = { contract_id: '1' };
      mockRequest.body = { contract: { contract_number: '1234' } };
      mockPrisma.$transaction.mockRejectedValue(new Error('Database error'));

      await updateContract(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラーが発生しました',
          details: [],
        },
      });
    });
  });
});