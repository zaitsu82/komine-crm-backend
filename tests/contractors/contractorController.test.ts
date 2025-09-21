import { Request, Response } from 'express';

const mockPrisma = {
  contractor: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  gravestone: {
    findFirst: jest.fn(),
  },
  billingInfo: {
    findFirst: jest.fn(),
  },
  familyContact: {
    findFirst: jest.fn(),
  },
  burial: {
    findFirst: jest.fn(),
  },
  history: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

import {
  getContractorById,
  searchContractors,
  createContractor,
  updateContractor,
  deleteContractor,
  transferContractor
} from '../../src/contractors/contractorController';

describe('Contractor Controller', () => {
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

  describe('getContractorById', () => {
    it('should return contractor details successfully', async () => {
      const mockContractor = {
        id: 1,
        name: 'テスト契約者',
        kana: 'テストケイヤクシャ',
        phone: '012-345-6789',
        Gravestone: { id: 1, gravestone_code: 'A-01' },
        BillingInfos: [],
        FamilyContacts: [],
        Burials: [],
      };

      mockRequest.params = { id: '1' };
      mockPrisma.contractor.findFirst.mockResolvedValue(mockContractor);

      await getContractorById(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.contractor.findFirst).toHaveBeenCalledWith({
        where: {
          id: 1,
          deleted_at: null,
        },
        include: {
          Gravestone: true,
          BillingInfos: {
            where: { deleted_at: null },
          },
          FamilyContacts: {
            where: { deleted_at: null },
          },
          Burials: {
            where: { deleted_at: null },
          },
        },
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockContractor,
      });
    });

    it('should return 404 when contractor not found', async () => {
      mockRequest.params = { id: '999' };
      mockPrisma.contractor.findFirst.mockResolvedValue(null);

      await getContractorById(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '契約者が見つかりません',
          details: [],
        },
      });
    });

    it('should handle database error', async () => {
      mockRequest.params = { id: '1' };
      mockPrisma.contractor.findFirst.mockRejectedValue(new Error('Database error'));

      await getContractorById(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラー',
          details: [],
        },
      });
      expect(console.error).toHaveBeenCalledWith('契約者詳細取得エラー:', expect.any(Error));
    });
  });

  describe('searchContractors', () => {
    it('should search contractors with default pagination', async () => {
      const mockContractors = [
        { id: 1, name: 'テスト契約者1', Gravestone: { id: 1 } },
        { id: 2, name: 'テスト契約者2', Gravestone: { id: 2 } },
      ];
      const totalCount = 2;

      mockRequest.query = {};
      mockPrisma.contractor.findMany.mockResolvedValue(mockContractors);
      mockPrisma.contractor.count.mockResolvedValue(totalCount);

      await searchContractors(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.contractor.findMany).toHaveBeenCalledWith({
        where: { deleted_at: null },
        include: { Gravestone: true },
        skip: 0,
        take: 20,
        orderBy: { id: 'desc' },
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          contractors: mockContractors,
          pagination: {
            current_page: 1,
            per_page: 20,
            total_count: totalCount,
            total_pages: 1,
          },
        },
      });
    });

    it('should search contractors with name filter', async () => {
      const mockContractors = [{ id: 1, name: 'テスト', Gravestone: { id: 1 } }];

      mockRequest.query = { name: 'テスト', page: '2', limit: '10' };
      mockPrisma.contractor.findMany.mockResolvedValue(mockContractors);
      mockPrisma.contractor.count.mockResolvedValue(1);

      await searchContractors(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.contractor.findMany).toHaveBeenCalledWith({
        where: {
          deleted_at: null,
          name: { contains: 'テスト' },
        },
        include: { Gravestone: true },
        skip: 10,
        take: 10,
        orderBy: { id: 'desc' },
      });
    });

    it('should search contractors with multiple filters', async () => {
      const mockContractors: any[] = [];

      mockRequest.query = {
        name: 'テスト',
        kana: 'テスト',
        phone: '012',
        gravestone_code: 'A-01',
        usage_status: 'available',
      };
      mockPrisma.contractor.findMany.mockResolvedValue(mockContractors);
      mockPrisma.contractor.count.mockResolvedValue(0);

      await searchContractors(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.contractor.findMany).toHaveBeenCalledWith({
        where: {
          deleted_at: null,
          name: { contains: 'テスト' },
          kana: { contains: 'テスト' },
          phone: { contains: '012' },
          Gravestone: {
            gravestone_code: { contains: 'A-01' },
            usage_status: 'available',
            deleted_at: null,
          },
        },
        include: { Gravestone: true },
        skip: 0,
        take: 20,
        orderBy: { id: 'desc' },
      });
    });

    it('should handle database error during search', async () => {
      mockRequest.query = {};
      mockPrisma.contractor.findMany.mockRejectedValue(new Error('Database error'));

      await searchContractors(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラー',
          details: [],
        },
      });
      expect(console.error).toHaveBeenCalledWith('契約者検索エラー:', expect.any(Error));
    });
  });

  describe('createContractor', () => {
    it('should create contractor successfully', async () => {
      const contractorData = {
        gravestone_id: 1,
        start_date: '2024-01-01',
        name: 'テスト契約者',
        kana: 'テストケイヤクシャ',
        postal_code: '123-4567',
        address: 'テスト住所',
        phone: '012-345-6789',
      };

      const mockGravestone = { id: 1, gravestone_code: 'A-01' };
      const mockCreatedContractor = {
        id: 1,
        ...contractorData,
        Gravestone: mockGravestone,
      };

      mockRequest.body = contractorData;
      mockPrisma.gravestone.findFirst.mockResolvedValue(mockGravestone);
      mockPrisma.contractor.create.mockResolvedValue(mockCreatedContractor);

      await createContractor(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockCreatedContractor,
      });
    });

    it('should create contractor with all optional fields', async () => {
      const contractorData = {
        gravestone_id: 1,
        reservation_date: '2023-12-01',
        consent_form_number: 'CF-001',
        permission_date: '2023-12-15',
        start_date: '2024-01-01',
        name: 'テスト契約者',
        kana: 'テストケイヤクシャ',
        birth_date: '1980-01-01',
        gender: 'male',
        postal_code: '123-4567',
        address: 'テスト住所',
        phone: '012-345-6789',
        fax: '012-345-6788',
        email: 'test@example.com',
        domicile_address: 'テスト本籍地',
        workplace_name: 'テスト会社',
        workplace_kana: 'テストカイシャ',
        workplace_address: 'テスト会社住所',
        workplace_phone: '012-345-6787',
        dm_setting: 'mail',
        recipient_type: 'self',
        remarks: 'テスト備考',
        effective_start_date: '2024-01-01',
        effective_end_date: '2024-12-31',
      };

      const mockGravestone = { id: 1 };
      const mockCreatedContractor = { id: 1, ...contractorData };

      mockRequest.body = contractorData;
      mockPrisma.gravestone.findFirst.mockResolvedValue(mockGravestone);
      mockPrisma.contractor.create.mockResolvedValue(mockCreatedContractor);

      await createContractor(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.contractor.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          reservation_date: new Date('2023-12-01'),
          permission_date: new Date('2023-12-15'),
          birth_date: new Date('1980-01-01'),
          effective_start_date: new Date('2024-01-01'),
          effective_end_date: new Date('2024-12-31'),
        }),
        include: { Gravestone: true },
      });
    });

    it('should return validation error when required fields missing', async () => {
      mockRequest.body = { name: 'テスト契約者' };

      await createContractor(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '必須項目が不足しています',
          details: [
            { message: '墓石ID、開始年月日、氏名、ふりがな、郵便番号、住所、電話番号は必須です' },
          ],
        },
      });
    });

    it('should return 404 when gravestone not found', async () => {
      const contractorData = {
        gravestone_id: 999,
        start_date: '2024-01-01',
        name: 'テスト契約者',
        kana: 'テストケイヤクシャ',
        postal_code: '123-4567',
        address: 'テスト住所',
        phone: '012-345-6789',
      };

      mockRequest.body = contractorData;
      mockPrisma.gravestone.findFirst.mockResolvedValue(null);

      await createContractor(mockRequest as Request, mockResponse as Response);

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
      const contractorData = {
        gravestone_id: 1,
        start_date: '2024-01-01',
        name: 'テスト契約者',
        kana: 'テストケイヤクシャ',
        postal_code: '123-4567',
        address: 'テスト住所',
        phone: '012-345-6789',
      };

      mockRequest.body = contractorData;
      mockPrisma.gravestone.findFirst.mockResolvedValue({ id: 1 });
      mockPrisma.contractor.create.mockRejectedValue(new Error('Database error'));

      await createContractor(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラー',
          details: [],
        },
      });
      expect(console.error).toHaveBeenCalledWith('契約者登録エラー:', expect.any(Error));
    });
  });

  describe('updateContractor', () => {
    it('should update contractor successfully', async () => {
      const updateData = {
        name: 'テスト契約者更新',
        phone: '090-1234-5678',
        email: 'updated@example.com',
      };

      const existingContractor = { id: 1, name: 'テスト契約者' };
      const updatedContractor = {
        id: 1,
        ...updateData,
        Gravestone: { id: 1 },
      };

      mockRequest.params = { id: '1' };
      mockRequest.body = updateData;
      mockPrisma.contractor.findFirst.mockResolvedValue(existingContractor);
      mockPrisma.contractor.update.mockResolvedValue(updatedContractor);

      await updateContractor(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.contractor.findFirst).toHaveBeenCalledWith({
        where: {
          id: 1,
          deleted_at: null,
        },
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: updatedContractor,
      });
    });

    it('should update contractor with date fields', async () => {
      const updateData = {
        reservation_date: '2023-12-01',
        permission_date: '2023-12-15',
        start_date: '2024-01-01',
        birth_date: '1985-05-15',
        effective_start_date: '2024-06-01',
        effective_end_date: '2025-05-31',
      };

      const existingContractor = { id: 1, name: 'テスト契約者' };
      const updatedContractor = { id: 1, ...updateData };

      mockRequest.params = { id: '1' };
      mockRequest.body = updateData;
      mockPrisma.contractor.findFirst.mockResolvedValue(existingContractor);
      mockPrisma.contractor.update.mockResolvedValue(updatedContractor);

      await updateContractor(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.contractor.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          reservation_date: new Date('2023-12-01'),
          permission_date: new Date('2023-12-15'),
          start_date: new Date('2024-01-01'),
          birth_date: new Date('1985-05-15'),
          effective_start_date: new Date('2024-06-01'),
          effective_end_date: new Date('2025-05-31'),
        }),
        include: { Gravestone: true },
      });
    });

    it('should update contractor with undefined date fields when not provided', async () => {
      const updateData = {
        name: 'テスト契約者更新',
        phone: '090-1234-5678',
      };

      const existingContractor = { id: 1, name: 'テスト契約者' };
      const updatedContractor = { id: 1, ...updateData };

      mockRequest.params = { id: '1' };
      mockRequest.body = updateData;
      mockPrisma.contractor.findFirst.mockResolvedValue(existingContractor);
      mockPrisma.contractor.update.mockResolvedValue(updatedContractor);

      await updateContractor(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.contractor.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          reservation_date: undefined,
          permission_date: undefined,
          start_date: undefined,
          birth_date: undefined,
          effective_start_date: undefined,
          effective_end_date: undefined,
        }),
        include: { Gravestone: true },
      });
    });

    it('should return 404 when contractor not found', async () => {
      mockRequest.params = { id: '999' };
      mockRequest.body = { name: 'テスト契約者' };
      mockPrisma.contractor.findFirst.mockResolvedValue(null);

      await updateContractor(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '契約者が見つかりません',
          details: [],
        },
      });
    });

    it('should handle database error during update', async () => {
      mockRequest.params = { id: '1' };
      mockRequest.body = { name: 'テスト契約者' };
      mockPrisma.contractor.findFirst.mockResolvedValue({ id: 1 });
      mockPrisma.contractor.update.mockRejectedValue(new Error('Database error'));

      await updateContractor(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラー',
          details: [],
        },
      });
      expect(console.error).toHaveBeenCalledWith('契約者更新エラー:', expect.any(Error));
    });
  });

  describe('deleteContractor', () => {
    it('should delete contractor successfully when no related data exists', async () => {
      const existingContractor = { id: 1, name: 'テスト契約者' };

      mockRequest.params = { id: '1' };
      mockPrisma.contractor.findFirst.mockResolvedValue(existingContractor);
      mockPrisma.billingInfo.findFirst.mockResolvedValue(null);
      mockPrisma.familyContact.findFirst.mockResolvedValue(null);
      mockPrisma.burial.findFirst.mockResolvedValue(null);
      mockPrisma.contractor.update.mockResolvedValue({ id: 1, deleted_at: new Date() });

      await deleteContractor(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.contractor.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          deleted_at: expect.any(Date),
        },
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { message: '契約者を削除しました' },
      });
    });

    it('should return 404 when contractor not found for deletion', async () => {
      mockRequest.params = { id: '999' };
      mockPrisma.contractor.findFirst.mockResolvedValue(null);

      await deleteContractor(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '契約者が見つかりません',
          details: [],
        },
      });
    });

    it('should return 409 when related billing info exists', async () => {
      const existingContractor = { id: 1, name: 'テスト契約者' };
      const relatedBillingInfo = { id: 1, contractor_id: 1 };

      mockRequest.params = { id: '1' };
      mockPrisma.contractor.findFirst.mockResolvedValue(existingContractor);
      mockPrisma.billingInfo.findFirst.mockResolvedValue(relatedBillingInfo);
      mockPrisma.familyContact.findFirst.mockResolvedValue(null);
      mockPrisma.burial.findFirst.mockResolvedValue(null);

      await deleteContractor(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(409);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'この契約者に関連するデータが存在するため削除できません',
          details: [],
        },
      });
    });

    it('should return 409 when related family contact exists', async () => {
      const existingContractor = { id: 1, name: 'テスト契約者' };
      const relatedFamilyContact = { id: 1, contractor_id: 1 };

      mockRequest.params = { id: '1' };
      mockPrisma.contractor.findFirst.mockResolvedValue(existingContractor);
      mockPrisma.billingInfo.findFirst.mockResolvedValue(null);
      mockPrisma.familyContact.findFirst.mockResolvedValue(relatedFamilyContact);
      mockPrisma.burial.findFirst.mockResolvedValue(null);

      await deleteContractor(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(409);
    });

    it('should return 409 when related burial exists', async () => {
      const existingContractor = { id: 1, name: 'テスト契約者' };
      const relatedBurial = { id: 1, contractor_id: 1 };

      mockRequest.params = { id: '1' };
      mockPrisma.contractor.findFirst.mockResolvedValue(existingContractor);
      mockPrisma.billingInfo.findFirst.mockResolvedValue(null);
      mockPrisma.familyContact.findFirst.mockResolvedValue(null);
      mockPrisma.burial.findFirst.mockResolvedValue(relatedBurial);

      await deleteContractor(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(409);
    });

    it('should handle database error during deletion', async () => {
      mockRequest.params = { id: '1' };
      mockPrisma.contractor.findFirst.mockResolvedValue({ id: 1 });
      mockPrisma.billingInfo.findFirst.mockRejectedValue(new Error('Database error'));

      await deleteContractor(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラー',
          details: [],
        },
      });
      expect(console.error).toHaveBeenCalledWith('契約者削除エラー:', expect.any(Error));
    });
  });

  describe('transferContractor', () => {
    it('should transfer contractor successfully', async () => {
      const transferData = {
        new_contractor_data: {
          name: '新契約者',
          kana: 'シンケイヤクシャ',
          postal_code: '111-2222',
          address: '新住所',
          phone: '090-1111-2222',
        },
        transfer_date: '2024-06-01',
        transfer_reason: '相続',
      };

      const existingContractor = {
        id: 1,
        gravestone_id: 1,
        name: '旧契約者',
      };

      const newContractor = {
        id: 2,
        gravestone_id: 1,
        name: '新契約者',
        Gravestone: { id: 1, gravestone_code: 'A-01' },
      };

      mockRequest.params = { id: '1' };
      mockRequest.body = transferData;
      mockPrisma.contractor.findFirst.mockResolvedValue(existingContractor);

      const mockTransaction = jest.fn().mockImplementation(async (callback) => {
        return await callback({
          contractor: {
            update: jest.fn().mockResolvedValue(existingContractor),
            create: jest.fn().mockResolvedValue(newContractor),
          },
          history: {
            create: jest.fn().mockResolvedValue({ id: 1 }),
          },
        });
      });
      mockPrisma.$transaction = mockTransaction;

      await transferContractor(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: newContractor,
      });
    });

    it('should transfer contractor with optional birth_date', async () => {
      const transferData = {
        new_contractor_data: {
          name: '新契約者',
          kana: 'シンケイヤクシャ',
          birth_date: '1990-01-01',
          postal_code: '111-2222',
          address: '新住所',
          phone: '090-1111-2222',
        },
      };

      const existingContractor = {
        id: 1,
        gravestone_id: 1,
        name: '旧契約者',
      };

      const newContractor = { id: 2, ...transferData.new_contractor_data };

      mockRequest.params = { id: '1' };
      mockRequest.body = transferData;
      mockPrisma.contractor.findFirst.mockResolvedValue(existingContractor);

      const mockTransaction = jest.fn().mockImplementation(async (callback) => {
        const tx = {
          contractor: {
            update: jest.fn().mockResolvedValue(existingContractor),
            create: jest.fn().mockResolvedValue(newContractor),
          },
          history: {
            create: jest.fn().mockResolvedValue({ id: 1 }),
          },
        };
        const result = await callback(tx);

        expect(tx.contractor.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            birth_date: new Date('1990-01-01'),
          }),
          include: { Gravestone: true },
        });

        return result;
      });
      mockPrisma.$transaction = mockTransaction;

      await transferContractor(mockRequest as Request, mockResponse as Response);
    });

    it('should return 404 when existing contractor not found', async () => {
      mockRequest.params = { id: '999' };
      mockRequest.body = {
        new_contractor_data: {
          name: '新契約者',
          kana: 'シンケイヤクシャ',
          postal_code: '111-2222',
          address: '新住所',
          phone: '090-1111-2222',
        },
      };
      mockPrisma.contractor.findFirst.mockResolvedValue(null);

      await transferContractor(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '契約者が見つかりません',
          details: [],
        },
      });
    });

    it('should return validation error when new contractor data is incomplete', async () => {
      mockRequest.params = { id: '1' };
      mockRequest.body = {
        new_contractor_data: {
          name: '新契約者',
        },
      };
      mockPrisma.contractor.findFirst.mockResolvedValue({ id: 1 });

      await transferContractor(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '新契約者の必須項目が不足しています',
          details: [],
        },
      });
    });

    it('should handle database error during transfer', async () => {
      mockRequest.params = { id: '1' };
      mockRequest.body = {
        new_contractor_data: {
          name: '新契約者',
          kana: 'シンケイヤクシャ',
          postal_code: '111-2222',
          address: '新住所',
          phone: '090-1111-2222',
        },
      };
      mockPrisma.contractor.findFirst.mockResolvedValue({ id: 1 });
      mockPrisma.$transaction.mockRejectedValue(new Error('Transaction error'));

      await transferContractor(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラー',
          details: [],
        },
      });
      expect(console.error).toHaveBeenCalledWith('契約者変更エラー:', expect.any(Error));
    });
  });
});