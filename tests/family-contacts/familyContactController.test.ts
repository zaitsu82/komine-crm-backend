import { Request, Response } from 'express';

// モックプリズマインスタンスの作成
const mockPrisma = {
  familyContact: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  contract: {
    findUnique: jest.fn(),
  },
};

// PrismaClientをモック化
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

import {
  getFamilyContacts,
  createFamilyContact,
  updateFamilyContact,
  deleteFamilyContact
} from '../../src/family-contacts/familyContactController';

describe('FamilyContact Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockRequest = {
      params: {},
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

  describe('getFamilyContacts', () => {
    it('should return family contacts for a contract', async () => {
      const mockContacts = [
        {
          id: 1,
          name: 'テスト太郎',
          nameKana: 'てすとたろう',
          birthDate: new Date('1980-01-01'),
          relationship: '長男',
          postalCode: '123-4567',
          address1: '福岡県福岡市',
          address2: '博多区住吉',
          address3: '1-20-15',
          phone1: '012-345-6789',
          phone2: null,
          fax: null,
          email: 'test@example.com',
          permanentAddress: '福岡県福岡市',
          mailingAddressType: 'home',
          workplaceName: 'テスト会社',
          workplaceKana: 'てすとがいしゃ',
          workplacePostalCode: '123-4567',
          workplaceAddress1: '福岡県福岡市',
          workplaceAddress2: '中央区天神',
          workplaceAddress3: '1-1-1',
          workplacePhone1: '092-111-2222',
          workplacePhone2: null,
          notes: 'テスト備考',
        },
      ];

      mockRequest.params = { contract_id: '1' };
      mockPrisma.familyContact.findMany.mockResolvedValue(mockContacts);

      await getFamilyContacts(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.familyContact.findMany).toHaveBeenCalledWith({
        where: {
          contractId: 1,
        },
        select: expect.any(Object),
        orderBy: {
          id: 'asc',
        },
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            id: 1,
            name: 'テスト太郎',
            name_kana: 'てすとたろう',
            relationship: '長男',
          }),
        ]),
      });
    });

    it('should handle database error when fetching family contacts', async () => {
      mockRequest.params = { contract_id: '1' };
      mockPrisma.familyContact.findMany.mockRejectedValue(new Error('Database error'));

      await getFamilyContacts(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラーが発生しました',
          details: [],
        },
      });
      expect(console.error).toHaveBeenCalledWith('Error fetching family contacts:', expect.any(Error));
    });
  });

  describe('createFamilyContact', () => {
    it('should create family contact successfully', async () => {
      const contactData = {
        name: 'テスト太郎',
        name_kana: 'てすとたろう',
        phone1: '012-345-6789',
        mailing_address_type: 'home',
      };

      mockRequest.params = { contract_id: '1' };
      mockRequest.body = contactData;
      mockPrisma.familyContact.create.mockResolvedValue({ id: 1 });

      await createFamilyContact(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          id: 1,
          message: '連絡先が正常に作成されました',
        },
      });
    });

    it('should return validation error when required fields missing', async () => {
      mockRequest.params = { contract_id: '1' };
      mockRequest.body = { name: 'テスト太郎' }; // 必須項目不足

      await createFamilyContact(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(422);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '必須項目が不足しています',
          details: expect.any(Array),
        },
      });
    });
  });

  describe('updateFamilyContact', () => {
    it('should return validation error when required fields missing', async () => {
      mockRequest.params = { contact_id: '1' };
      mockRequest.body = { name: 'テスト太郎' }; // 必須項目不足

      await updateFamilyContact(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(422);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '必須項目が不足しています',
          details: expect.any(Array),
        },
      });
    });
  });

  describe('deleteFamilyContact', () => {
    it('should handle database error during deletion', async () => {
      mockRequest.params = { contact_id: '1' };
      mockPrisma.familyContact.delete.mockRejectedValue(new Error('Database error'));

      await deleteFamilyContact(mockRequest as Request, mockResponse as Response);

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