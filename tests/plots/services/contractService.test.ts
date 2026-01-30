/**
 * contractService.tsのテスト
 */

import { PrismaClient } from '@prisma/client';
import {
  findContractPlotById,
  validateContractPlotExists,
  buildContractPlotDetailResponse,
  buildContractPlotSummaryResponse,
} from '../../../src/plots/services/contractService';

// Prismaクライアントのモック
jest.mock('@prisma/client');

describe('contractService', () => {
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      contractPlot: {
        findUnique: jest.fn(),
      },
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findContractPlotById', () => {
    it('契約区画をIDで検索できること', async () => {
      const mockContractPlot = {
        id: 'contract-1',
        contract_area_sqm: 3.6,
        deleted_at: null,
        PhysicalPlot: {
          id: 'plot-1',
          plot_number: 'A-01',
          BuriedPersons: [],
          CollectiveBurial: null,
          FamilyContacts: [],
        },
        SaleContractRoles: [
          {
            id: 'role-1',
            Customer: {
              id: 'customer-1',
              name: '山田太郎',
              WorkInfo: null,
              BillingInfo: null,
            },
          },
        ],
        UsageFee: null,
        ManagementFee: null,
      };

      mockPrisma.contractPlot.findUnique.mockResolvedValue(mockContractPlot);

      const result = await findContractPlotById(mockPrisma, 'contract-1');

      expect(mockPrisma.contractPlot.findUnique).toHaveBeenCalledWith({
        where: { id: 'contract-1', deleted_at: null },
        include: {
          physicalPlot: true,
          buriedPersons: {
            where: { deleted_at: null },
            orderBy: { created_at: 'desc' },
          },
          collectiveBurial: true,
          familyContacts: {
            where: { deleted_at: null },
            orderBy: { created_at: 'desc' },
          },
          saleContractRoles: {
            where: { deleted_at: null },
            include: {
              customer: {
                include: {
                  workInfo: true,
                  billingInfo: true,
                },
              },
            },
          },
          usageFee: true,
          managementFee: true,
        },
      });
      expect(result).toEqual(mockContractPlot);
    });

    it('存在しない契約区画の場合nullを返すこと', async () => {
      mockPrisma.contractPlot.findUnique.mockResolvedValue(null);

      const result = await findContractPlotById(mockPrisma, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('validateContractPlotExists', () => {
    it('契約区画が存在する場合、区画を返すこと', async () => {
      const mockContractPlot = {
        id: 'contract-1',
        deleted_at: null,
        PhysicalPlot: {},
        SaleContract: { Customer: {} },
      };

      mockPrisma.contractPlot.findUnique.mockResolvedValue(mockContractPlot);

      const result = await validateContractPlotExists(mockPrisma, 'contract-1');

      expect(result).toEqual(mockContractPlot);
    });

    it('契約区画が存在しない場合、エラーをスローすること', async () => {
      mockPrisma.contractPlot.findUnique.mockResolvedValue(null);

      await expect(validateContractPlotExists(mockPrisma, 'nonexistent')).rejects.toThrow(
        '指定された契約区画が見つかりません'
      );
    });
  });

  describe('buildContractPlotDetailResponse', () => {
    it('契約区画詳細レスポンスを正しくフォーマットすること', () => {
      const mockContractPlot = {
        id: 'contract-1',
        contract_area_sqm: { toNumber: () => 3.6 },
        location_description: '南側',
        // 販売契約情報（ContractPlotに統合済み）
        contract_date: new Date('2024-01-01'),
        price: 1000000,
        payment_status: 'paid',
        reservation_date: null,
        acceptance_number: null,
        permit_date: null,
        start_date: null,
        notes: null,
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-02'),
        physicalPlot: {
          id: 'plot-1',
          plot_number: 'A-01',
          area_name: '一般墓地A',
          area_sqm: { toNumber: () => 3.6 },
          status: 'sold_out',
          notes: '備考',
        },
        buriedPersons: [],
        collectiveBurial: null,
        familyContacts: [],
        saleContractRoles: [
          {
            id: 'role-1',
            role: 'contractor',
            role_start_date: null,
            role_end_date: null,
            notes: null,
            customer: {
              id: 'customer-1',
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

      const result = buildContractPlotDetailResponse(mockContractPlot);

      expect(result).toEqual({
        id: 'contract-1',
        contractAreaSqm: 3.6,
        locationDescription: '南側',
        // 販売契約情報（ContractPlotに統合済み）
        contractDate: new Date('2024-01-01'),
        price: 1000000,
        paymentStatus: 'paid',
        reservationDate: null,
        acceptanceNumber: null,
        permitDate: null,
        startDate: null,
        notes: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        physicalPlot: {
          id: 'plot-1',
          plotNumber: 'A-01',
          areaName: '一般墓地A',
          areaSqm: 3.6,
          status: 'sold_out',
          notes: '備考',
          buriedPersons: [],
          collectiveBurial: null,
          familyContacts: [],
        },
        // 後方互換性: 主契約者の情報
        primaryCustomer: {
          id: 'customer-1',
          name: '山田太郎',
          nameKana: 'ヤマダタロウ',
          birthDate: null,
          gender: null,
          postalCode: '150-0001',
          address: '東京都渋谷区',
          registeredAddress: null,
          phoneNumber: '0312345678',
          faxNumber: null,
          email: null,
          notes: null,
          role: 'contractor',
          workInfo: null,
          billingInfo: null,
        },
        // 全ての役割と顧客情報
        roles: [
          {
            id: 'role-1',
            role: 'contractor',
            roleStartDate: null,
            roleEndDate: null,
            notes: null,
            customer: {
              id: 'customer-1',
              name: '山田太郎',
              nameKana: 'ヤマダタロウ',
              gender: null,
              birthDate: null,
              phoneNumber: '0312345678',
              faxNumber: null,
              email: null,
              postalCode: '150-0001',
              address: '東京都渋谷区',
              registeredAddress: null,
              notes: null,
              workInfo: null,
              billingInfo: null,
            },
          },
        ],
        usageFee: null,
        managementFee: null,
      });
    });

    it('オプション情報（UsageFee、ManagementFee）を含む場合、正しくフォーマットすること', () => {
      const mockContractPlot = {
        id: 'contract-1',
        contract_area_sqm: { toNumber: () => 3.6 },
        location_description: '南側',
        // 販売契約情報（ContractPlotに統合済み）
        contract_date: new Date('2024-01-01'),
        price: 1000000,
        payment_status: 'paid',
        reservation_date: null,
        acceptance_number: null,
        permit_date: null,
        start_date: null,
        notes: null,
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-02'),
        physicalPlot: {
          id: 'plot-1',
          plot_number: 'A-01',
          area_name: '一般墓地A',
          area_sqm: { toNumber: () => 3.6 },
          status: 'sold_out',
          notes: null,
        },
        buriedPersons: [],
        collectiveBurial: null,
        familyContacts: [],
        saleContractRoles: [
          {
            id: 'role-1',
            role: 'contractor',
            role_start_date: null,
            role_end_date: null,
            notes: null,
            customer: {
              id: 'customer-1',
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
        usageFee: {
          id: 'usage-1',
          calculation_type: 'area',
          tax_type: 'included',
          billing_type: 'lump_sum',
          billing_years: null,
          area: null,
          unit_price: null,
          usage_fee: null,
          payment_method: 'cash',
        },
        managementFee: {
          id: 'management-1',
          calculation_type: 'area',
          tax_type: 'included',
          billing_type: 'annual',
          billing_years: null,
          area: null,
          billing_month: null,
          management_fee: null,
          unit_price: null,
          last_billing_month: null,
          payment_method: 'bank_transfer',
        },
      };

      const result = buildContractPlotDetailResponse(mockContractPlot);

      expect(result.usageFee).toEqual({
        id: 'usage-1',
        calculationType: 'area',
        taxType: 'included',
        billingType: 'lump_sum',
        billingYears: null,
        area: null,
        unitPrice: null,
        usageFee: null,
        paymentMethod: 'cash',
      });

      expect(result.managementFee).toEqual({
        id: 'management-1',
        calculationType: 'area',
        taxType: 'included',
        billingType: 'annual',
        billingYears: null,
        area: null,
        billingMonth: null,
        managementFee: null,
        unitPrice: null,
        lastBillingMonth: null,
        paymentMethod: 'bank_transfer',
      });
    });
  });

  describe('buildContractPlotSummaryResponse', () => {
    it('契約区画サマリーレスポンスを正しくフォーマットすること', () => {
      const mockContractPlot = {
        id: 'contract-1',
        contract_area_sqm: { toNumber: () => 3.6 },
        location_description: '南側',
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-02'),
        contract_date: new Date('2024-01-01'),
        price: 1000000,
        payment_status: 'paid',
        physicalPlot: {
          plot_number: 'A-01',
          area_name: '一般墓地A',
          area_sqm: { toNumber: () => 3.6 },
          status: 'sold_out',
        },
        saleContractRoles: [
          {
            id: 'role-1',
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
      };

      const result = buildContractPlotSummaryResponse(mockContractPlot);

      expect(result).toEqual({
        id: 'contract-1',
        contractAreaSqm: 3.6,
        locationDescription: '南側',
        plotNumber: 'A-01',
        areaName: '一般墓地A',
        physicalPlotAreaSqm: 3.6,
        physicalPlotStatus: 'sold_out',
        customerName: '山田太郎',
        customerNameKana: 'ヤマダタロウ',
        customerPhoneNumber: '0312345678',
        customerAddress: '東京都渋谷区',
        customerRole: 'contractor',
        contractDate: new Date('2024-01-01'),
        price: 1000000,
        paymentStatus: 'paid',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        roles: [
          {
            role: 'contractor',
            customer: {
              id: 'c1',
              name: '山田太郎',
              nameKana: 'ヤマダタロウ',
              phoneNumber: '0312345678',
              address: '東京都渋谷区',
            },
          },
        ],
      });
    });
  });
});
