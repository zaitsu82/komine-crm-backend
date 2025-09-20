import { Request, Response } from 'express';

// モックプリズマインスタンスの作成
const mockPrisma = {
  familyContact: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  gravestone: {
    findFirst: jest.fn(),
  },
  contractor: {
    findFirst: jest.fn(),
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
    jest.spyOn(console, 'error').mockImplementation(() => { });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getFamilyContacts', () => {
    it('should return 501 not implemented', async () => {
      await getFamilyContacts(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(501);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_IMPLEMENTED',
          message: 'この機能は実装されていません。契約者詳細APIをご利用ください。',
          details: [],
        },
      });
    });
  });

  describe('createFamilyContact', () => {
    it('should create family contact successfully', async () => {
      const contactData = {
        gravestone_id: 1,
        contractor_id: 1,
        name: 'テスト太郎',
        phone: '012-345-6789',
        relation: '長男',
      };

      const mockGravestone = { id: 1, gravestone_code: 'A-01' };
      const mockContractor = { id: 1, name: 'テスト契約者' };
      const mockCreatedContact = {
        id: 1,
        ...contactData,
        Gravestone: mockGravestone,
        Contractor: mockContractor,
      };

      mockRequest.body = contactData;
      mockPrisma.gravestone.findFirst.mockResolvedValue(mockGravestone);
      mockPrisma.contractor.findFirst.mockResolvedValue(mockContractor);
      mockPrisma.familyContact.create.mockResolvedValue(mockCreatedContact);

      await createFamilyContact(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockCreatedContact,
      });
    });

    it('should return validation error when required fields missing', async () => {
      mockRequest.body = { name: 'テスト太郎' }; // gravestone_id and contractor_id missing

      await createFamilyContact(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '必須項目が不足しています',
          details: [
            { message: '墓石IDと契約者IDは必須です' },
          ],
        },
      });
    });

    it('should return 404 when gravestone not found', async () => {
      const contactData = {
        gravestone_id: 999,
        contractor_id: 1,
        name: 'テスト太郎',
      };

      mockRequest.body = contactData;
      mockPrisma.gravestone.findFirst.mockResolvedValue(null);
      mockPrisma.contractor.findFirst.mockResolvedValue({ id: 1 });

      await createFamilyContact(mockRequest as Request, mockResponse as Response);

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
      const contactData = {
        gravestone_id: 1,
        contractor_id: 1,
        name: 'テスト太郎',
      };

      mockRequest.body = contactData;
      mockPrisma.gravestone.findFirst.mockResolvedValue({ id: 1 });
      mockPrisma.contractor.findFirst.mockResolvedValue({ id: 1 });
      mockPrisma.familyContact.create.mockRejectedValue(new Error('Database error'));

      await createFamilyContact(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラー',
          details: [],
        },
      });
      expect(console.error).toHaveBeenCalledWith('家族連絡先登録エラー:', expect.any(Error));
    });
  });

  describe('updateFamilyContact', () => {
    it('should update family contact successfully', async () => {
      const updateData = {
        name: 'テスト太郎更新',
        phone: '090-1234-5678',
        relation: '次男',
      };

      const existingContact = { id: 1, name: 'テスト太郎' };
      const updatedContact = {
        id: 1,
        ...updateData,
        Gravestone: { id: 1 },
        Contractor: { id: 1 },
      };

      mockRequest.params = { id: '1' };
      mockRequest.body = updateData;
      mockPrisma.familyContact.findFirst.mockResolvedValue(existingContact);
      mockPrisma.familyContact.update.mockResolvedValue(updatedContact);

      await updateFamilyContact(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.familyContact.findFirst).toHaveBeenCalledWith({
        where: {
          id: 1,
          deleted_at: null,
        },
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: updatedContact,
      });
    });

    it('should return 404 when family contact not found', async () => {
      mockRequest.params = { id: '999' };
      mockRequest.body = { name: 'テスト太郎' };
      mockPrisma.familyContact.findFirst.mockResolvedValue(null);

      await updateFamilyContact(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '家族連絡先が見つかりません',
          details: [],
        },
      });
    });

    it('should handle database error during update', async () => {
      mockRequest.params = { id: '1' };
      mockRequest.body = { name: 'テスト太郎' };
      mockPrisma.familyContact.findFirst.mockResolvedValue({ id: 1 });
      mockPrisma.familyContact.update.mockRejectedValue(new Error('Database error'));

      await updateFamilyContact(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラー',
          details: [],
        },
      });
      expect(console.error).toHaveBeenCalledWith('家族連絡先更新エラー:', expect.any(Error));
    });
  });

  describe('deleteFamilyContact', () => {
    it('should delete family contact successfully (logical delete)', async () => {
      const existingContact = { id: 1, name: 'テスト太郎' };

      mockRequest.params = { id: '1' };
      mockPrisma.familyContact.findFirst.mockResolvedValue(existingContact);
      mockPrisma.familyContact.update.mockResolvedValue({ id: 1, deleted_at: new Date() });

      await deleteFamilyContact(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.familyContact.findFirst).toHaveBeenCalledWith({
        where: {
          id: 1,
          deleted_at: null,
        },
      });

      expect(mockPrisma.familyContact.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          deleted_at: expect.any(Date),
        },
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { message: '家族連絡先を削除しました' },
      });
    });

    it('should return 404 when family contact not found for deletion', async () => {
      mockRequest.params = { id: '999' };
      mockPrisma.familyContact.findFirst.mockResolvedValue(null);

      await deleteFamilyContact(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '家族連絡先が見つかりません',
          details: [],
        },
      });
    });

    it('should handle database error during deletion', async () => {
      mockRequest.params = { id: '1' };
      mockPrisma.familyContact.findFirst.mockResolvedValue({ id: 1 });
      mockPrisma.familyContact.update.mockRejectedValue(new Error('Database error'));

      await deleteFamilyContact(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラー',
          details: [],
        },
      });
      expect(console.error).toHaveBeenCalledWith('家族連絡先削除エラー:', expect.any(Error));
    });
  });
});