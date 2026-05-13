/**
 * customerService.tsのテスト
 */

import { PrismaClient } from '@prisma/client';
import {
  createCustomerWithRelations,
  updateCustomerWithRelations,
  deleteCustomerIfUnused,
  findCustomerById,
  validateCustomerExists,
} from '../../../src/plots/services/customerService';

// Prismaクライアントのモック
jest.mock('@prisma/client');

describe('customerService', () => {
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      customer: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
      },
      workInfo: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
        deleteMany: jest.fn(),
      },
      saleContract: {
        findMany: jest.fn(),
      },
      saleContractRole: {
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createCustomerWithRelations', () => {
    it('顧客のみ作成できること', async () => {
      const customerData = {
        name: '山田太郎',
        nameKana: 'ヤマダタロウ',
        postalCode: '150-0001',
        address: '東京都渋谷区',
        phoneNumber: '0312345678',
      };

      const mockCustomer = {
        id: 'customer-1',
        ...customerData,
      };

      mockPrisma.customer.create.mockResolvedValue(mockCustomer);

      const result = await createCustomerWithRelations(mockPrisma, customerData);

      expect(mockPrisma.customer.create).toHaveBeenCalledWith({
        data: {
          name: '山田太郎',
          name_kana: 'ヤマダタロウ',
          birth_date: undefined,
          gender: undefined,
          postal_code: '150-0001',
          address: '東京都渋谷区',
          registered_address: undefined,
          phone_number: '0312345678',
          fax_number: undefined,
          email: undefined,
          notes: undefined,
          staff_id: null,
          legacy_danka_cd: null,
        },
      });
      expect(result).toEqual(mockCustomer);
      expect(mockPrisma.workInfo.create).not.toHaveBeenCalled();
    });

    it('phoneNumber が null でも作成できること（レガシー欠損データ対応）', async () => {
      const customerData = {
        name: '山田太郎',
        nameKana: 'ヤマダタロウ',
        postalCode: '150-0001',
        address: '東京都渋谷区',
        phoneNumber: null,
      };

      const mockCustomer = { id: 'customer-1', ...customerData };
      mockPrisma.customer.create.mockResolvedValue(mockCustomer);

      await createCustomerWithRelations(mockPrisma, customerData);

      expect(mockPrisma.customer.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          phone_number: null,
        }),
      });
    });

    it('顧客と勤務先情報を作成できること', async () => {
      const customerData = {
        name: '山田太郎',
        nameKana: 'ヤマダタロウ',
        postalCode: '150-0001',
        address: '東京都渋谷区',
        phoneNumber: '0312345678',
      };

      const workInfoData = {
        companyName: '株式会社テスト',
        companyNameKana: 'カブシキガイシャテスト',
        workPostalCode: '100-0001',
        workAddress: '東京都千代田区',
        workPhoneNumber: '0398765432',
      };

      const mockCustomer = { id: 'customer-1' };
      mockPrisma.customer.create.mockResolvedValue(mockCustomer);
      mockPrisma.workInfo.create.mockResolvedValue({});

      await createCustomerWithRelations(mockPrisma, customerData, workInfoData);

      expect(mockPrisma.workInfo.create).toHaveBeenCalledWith({
        data: {
          customer_id: 'customer-1',
          company_name: '株式会社テスト',
          company_name_kana: 'カブシキガイシャテスト',
          work_postal_code: '100-0001',
          work_address: '東京都千代田区',
          work_phone_number: '0398765432',
          dm_setting: undefined,
          address_type: undefined,
          notes: undefined,
        },
      });
    });
  });

  describe('updateCustomerWithRelations', () => {
    it('顧客情報のみ更新できること', async () => {
      const customerData = {
        name: '山田花子',
        phoneNumber: '0399999999',
      };

      mockPrisma.customer.update.mockResolvedValue({});

      await updateCustomerWithRelations(mockPrisma, 'customer-1', customerData);

      expect(mockPrisma.customer.update).toHaveBeenCalledWith({
        where: { id: 'customer-1' },
        data: {
          name: '山田花子',
          name_kana: undefined,
          birth_date: undefined,
          gender: undefined,
          postal_code: undefined,
          address: undefined,
          registered_address: undefined,
          phone_number: '0399999999',
          fax_number: undefined,
          email: undefined,
          notes: undefined,
        },
      });
    });

    it('勤務先情報が存在する場合、更新すること', async () => {
      const workInfoData = {
        companyName: '株式会社新テスト',
      };

      mockPrisma.workInfo.findUnique.mockResolvedValue({ id: 'work-1' });
      mockPrisma.workInfo.update.mockResolvedValue({});

      await updateCustomerWithRelations(mockPrisma, 'customer-1', undefined, workInfoData);

      expect(mockPrisma.workInfo.findUnique).toHaveBeenCalledWith({
        where: { customer_id: 'customer-1' },
      });
      expect(mockPrisma.workInfo.update).toHaveBeenCalled();
      expect(mockPrisma.workInfo.create).not.toHaveBeenCalled();
    });

    it('勤務先情報が存在しない場合、新規作成すること', async () => {
      const workInfoData = {
        companyName: '株式会社新テスト',
      };

      mockPrisma.workInfo.findUnique.mockResolvedValue(null);
      mockPrisma.workInfo.create.mockResolvedValue({});

      await updateCustomerWithRelations(mockPrisma, 'customer-1', undefined, workInfoData);

      expect(mockPrisma.workInfo.findUnique).toHaveBeenCalled();
      expect(mockPrisma.workInfo.create).toHaveBeenCalledWith({
        data: {
          customer_id: 'customer-1',
          company_name: '株式会社新テスト',
          company_name_kana: undefined,
          work_postal_code: undefined,
          work_address: undefined,
          work_phone_number: undefined,
          dm_setting: undefined,
          address_type: undefined,
          notes: undefined,
        },
      });
    });
  });

  describe('deleteCustomerIfUnused', () => {
    it('他に契約がない場合、顧客を削除すること', async () => {
      mockPrisma.saleContractRole.findMany.mockResolvedValue([]);
      mockPrisma.workInfo.deleteMany.mockResolvedValue({});
      mockPrisma.customer.update.mockResolvedValue({});

      await deleteCustomerIfUnused(mockPrisma, 'customer-1');

      expect(mockPrisma.saleContractRole.findMany).toHaveBeenCalledWith({
        where: {
          customer_id: 'customer-1',
          deleted_at: null,
        },
      });
      expect(mockPrisma.workInfo.deleteMany).toHaveBeenCalledWith({
        where: { customer_id: 'customer-1' },
      });
      expect(mockPrisma.customer.update).toHaveBeenCalledWith({
        where: { id: 'customer-1' },
        data: { deleted_at: expect.any(Date) },
      });
    });

    it('他に契約がある場合、顧客を削除しないこと', async () => {
      mockPrisma.saleContractRole.findMany.mockResolvedValue([{ id: 'role-1' }]);

      await deleteCustomerIfUnused(mockPrisma, 'customer-1');

      expect(mockPrisma.workInfo.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.customer.update).not.toHaveBeenCalled();
    });

    it('除外する契約IDを指定した場合、その契約を除いて検索すること', async () => {
      mockPrisma.saleContractRole.findMany.mockResolvedValue([]);
      mockPrisma.workInfo.deleteMany.mockResolvedValue({});
      mockPrisma.customer.update.mockResolvedValue({});

      await deleteCustomerIfUnused(mockPrisma, 'customer-1', 'exclude-contract-1');

      expect(mockPrisma.saleContractRole.findMany).toHaveBeenCalledWith({
        where: {
          customer_id: 'customer-1',
          deleted_at: null,
          sale_contract_id: { not: 'exclude-contract-1' },
        },
      });
    });
  });

  describe('findCustomerById', () => {
    it('顧客をIDで検索できること', async () => {
      const mockCustomer = {
        id: 'customer-1',
        name: '山田太郎',
        deleted_at: null,
        workInfo: null,
      };

      mockPrisma.customer.findUnique.mockResolvedValue(mockCustomer);

      const result = await findCustomerById(mockPrisma, 'customer-1');

      expect(mockPrisma.customer.findUnique).toHaveBeenCalledWith({
        where: { id: 'customer-1', deleted_at: null },
        include: {
          workInfo: true,
        },
      });
      expect(result).toEqual(mockCustomer);
    });

    it('存在しない顧客の場合nullを返すこと', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue(null);

      const result = await findCustomerById(mockPrisma, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('validateCustomerExists', () => {
    it('顧客が存在する場合、顧客を返すこと', async () => {
      const mockCustomer = {
        id: 'customer-1',
        name: '山田太郎',
        deleted_at: null,
      };

      mockPrisma.customer.findUnique.mockResolvedValue(mockCustomer);

      const result = await validateCustomerExists(mockPrisma, 'customer-1');

      expect(result).toEqual(mockCustomer);
    });

    it('顧客が存在しない場合、エラーをスローすること', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue(null);

      await expect(validateCustomerExists(mockPrisma, 'nonexistent')).rejects.toThrow(
        '指定された顧客が見つかりません'
      );
    });
  });
});
