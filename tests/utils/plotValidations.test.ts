/**
 * 区画バリデーションユーティリティのテスト
 */

import { PrismaClient } from '@prisma/client';
import { ValidationError } from '../../src/middleware/errorHandler';
import {
  validatePlotNumberFormat,
  isPlotNumberDuplicate,
  validateAreaSize,
  isStandardContractSize,
  isValidAreaDivision,
  canDeletePhysicalPlot,
  canDeleteContractPlot,
  validateSaleStatus,
  validatePhysicalPlotStatus,
  validateContractDate,
  validateCustomerRole,
  validatePhysicalPlotCreate,
  validatePhysicalPlotUpdate,
} from '../../src/utils/plotValidations';

// Prisma Client のモック（jest.mockの前に定義）
const mockPrismaClient = {
  physicalPlot: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
  },
  contractPlot: {
    findUnique: jest.fn(),
  },
};

jest.mock('@prisma/client', () => {
  const actualPrisma = jest.requireActual('@prisma/client');
  return {
    ...actualPrisma,
    PrismaClient: jest.fn(() => mockPrismaClient),
  };
});

describe('plotValidations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validatePlotNumberFormat', () => {
    it('正しい形式の区画番号を受け入れる', () => {
      expect(validatePlotNumberFormat('A-56')).toBe(true);
      expect(validatePlotNumberFormat('B-23')).toBe(true);
      expect(validatePlotNumberFormat('Z-999')).toBe(true);
    });

    it('不正な形式の区画番号を拒否する', () => {
      expect(validatePlotNumberFormat('a-56')).toBe(false); // 小文字
      expect(validatePlotNumberFormat('A56')).toBe(false); // ハイフンなし
      expect(validatePlotNumberFormat('AA-56')).toBe(false); // 2文字
      expect(validatePlotNumberFormat('A-')).toBe(false); // 番号なし
      expect(validatePlotNumberFormat('-56')).toBe(false); // エリア名なし
    });
  });

  describe('isPlotNumberDuplicate', () => {
    it('重複する区画番号の場合、trueを返す', async () => {
      mockPrismaClient.physicalPlot.findFirst.mockResolvedValue({
        id: 'existing-plot',
        plot_number: 'A-56',
      });

      const result = await isPlotNumberDuplicate(mockPrismaClient, 'A-56');

      expect(result).toBe(true);
      expect(mockPrismaClient.physicalPlot.findFirst).toHaveBeenCalledWith({
        where: {
          plot_number: 'A-56',
          deleted_at: null,
        },
      });
    });

    it('重複しない区画番号の場合、falseを返す', async () => {
      mockPrismaClient.physicalPlot.findFirst.mockResolvedValue(null);

      const result = await isPlotNumberDuplicate(mockPrismaClient, 'A-99');

      expect(result).toBe(false);
    });

    it('除外IDを指定した場合、そのIDを除外して検証', async () => {
      mockPrismaClient.physicalPlot.findFirst.mockResolvedValue(null);

      await isPlotNumberDuplicate(mockPrismaClient, 'A-56', 'plot-1');

      expect(mockPrismaClient.physicalPlot.findFirst).toHaveBeenCalledWith({
        where: {
          plot_number: 'A-56',
          deleted_at: null,
          id: { not: 'plot-1' },
        },
      });
    });
  });

  describe('validateAreaSize', () => {
    it('妥当な面積を受け入れる', () => {
      expect(validateAreaSize(1.8).isValid).toBe(true);
      expect(validateAreaSize(3.6).isValid).toBe(true);
      expect(validateAreaSize(5.0).isValid).toBe(true);
    });

    it('0以下の面積を拒否する', () => {
      const result = validateAreaSize(0);
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('0より大きい値');
    });

    it('1.8㎡未満の面積を拒否する', () => {
      const result = validateAreaSize(1.0);
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('1.8㎡以上');
    });

    it('10㎡を超える面積を拒否する', () => {
      const result = validateAreaSize(11.0);
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('10㎡以下');
    });
  });

  describe('isStandardContractSize', () => {
    it('標準サイズ（1.8㎡、3.6㎡）を受け入れる', () => {
      expect(isStandardContractSize(1.8)).toBe(true);
      expect(isStandardContractSize(3.6)).toBe(true);
    });

    it('非標準サイズを拒否する', () => {
      expect(isStandardContractSize(2.0)).toBe(false);
      expect(isStandardContractSize(5.0)).toBe(false);
    });
  });

  describe('isValidAreaDivision', () => {
    it('妥当な分割を受け入れる', () => {
      expect(isValidAreaDivision(3.6, 1.8).isValid).toBe(true);
      expect(isValidAreaDivision(3.6, 3.6).isValid).toBe(true);
    });

    it('契約面積が物理区画面積を超える場合を拒否する', () => {
      const result = isValidAreaDivision(3.6, 5.0);
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('契約面積が物理区画面積を超えています');
    });

    it('3.6㎡区画の不正な分割を拒否する', () => {
      const result = isValidAreaDivision(3.6, 2.0);
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('1.8㎡または3.6㎡の契約のみ可能');
    });
  });

  describe('canDeletePhysicalPlot', () => {
    it('契約がない物理区画は削除可能', async () => {
      mockPrismaClient.physicalPlot.findUnique.mockResolvedValue({
        id: 'plot-1',
        contractPlots: [],
      });

      const result = await canDeletePhysicalPlot(mockPrismaClient, 'plot-1');

      expect(result.canDelete).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('契約がある物理区画は削除不可', async () => {
      mockPrismaClient.physicalPlot.findUnique.mockResolvedValue({
        id: 'plot-1',
        contractPlots: [{ id: 'contract-1' }],
      });

      const result = await canDeletePhysicalPlot(mockPrismaClient, 'plot-1');

      expect(result.canDelete).toBe(false);
      expect(result.reason).toContain('契約が存在するため削除できません');
    });

    it('存在しない物理区画は削除不可', async () => {
      mockPrismaClient.physicalPlot.findUnique.mockResolvedValue(null);

      const result = await canDeletePhysicalPlot(mockPrismaClient, 'invalid-id');

      expect(result.canDelete).toBe(false);
      expect(result.reason).toContain('物理区画が見つかりません');
    });
  });

  describe('canDeleteContractPlot', () => {
    it('販売契約がない契約区画は削除可能', async () => {
      mockPrismaClient.contractPlot.findUnique.mockResolvedValue({
        id: 'contract-1',
        saleContractRoles: [],
      });

      const result = await canDeleteContractPlot(mockPrismaClient, 'contract-1');

      expect(result.canDelete).toBe(true);
    });

    it('販売契約がある契約区画は削除不可', async () => {
      mockPrismaClient.contractPlot.findUnique.mockResolvedValue({
        id: 'contract-1',
        saleContractRoles: [{ id: 'role-1', deleted_at: null }],
      });

      const result = await canDeleteContractPlot(mockPrismaClient, 'contract-1');

      expect(result.canDelete).toBe(false);
      expect(result.reason).toContain('販売契約が存在するため削除できません');
    });

    it('削除済み販売契約の場合は削除可能', async () => {
      // The query filters out deleted roles with "where: { deleted_at: null }"
      // so deleted roles won't be returned, making saleContractRoles empty
      mockPrismaClient.contractPlot.findUnique.mockResolvedValue({
        id: 'contract-1',
        saleContractRoles: [], // Deleted roles are filtered out by the query
      });

      const result = await canDeleteContractPlot(mockPrismaClient, 'contract-1');

      expect(result.canDelete).toBe(true);
    });
  });

  describe('validateSaleStatus', () => {
    it('妥当な販売ステータスを受け入れる', () => {
      expect(validateSaleStatus('available')).toBe(true);
      expect(validateSaleStatus('reserved')).toBe(true);
      expect(validateSaleStatus('contracted')).toBe(true);
      expect(validateSaleStatus('cancelled')).toBe(true);
    });

    it('不正な販売ステータスを拒否する', () => {
      expect(validateSaleStatus('invalid')).toBe(false);
      expect(validateSaleStatus('sold')).toBe(false);
    });
  });

  describe('validatePhysicalPlotStatus', () => {
    it('妥当な物理区画ステータスを受け入れる', () => {
      expect(validatePhysicalPlotStatus('available')).toBe(true);
      expect(validatePhysicalPlotStatus('partially_sold')).toBe(true);
      expect(validatePhysicalPlotStatus('sold_out')).toBe(true);
    });

    it('不正な物理区画ステータスを拒否する', () => {
      expect(validatePhysicalPlotStatus('invalid')).toBe(false);
      expect(validatePhysicalPlotStatus('reserved')).toBe(false);
    });
  });

  describe('validateContractDate', () => {
    it('過去の日付を受け入れる', () => {
      const pastDate = new Date('2023-01-01');
      const result = validateContractDate(pastDate);
      expect(result.isValid).toBe(true);
    });

    it('本日の日付を受け入れる', () => {
      const today = new Date();
      const result = validateContractDate(today);
      expect(result.isValid).toBe(true);
    });

    it('未来の日付を拒否する', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const result = validateContractDate(futureDate);
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('本日以前の日付');
    });
  });

  describe('validateCustomerRole', () => {
    it('妥当な顧客ロールを受け入れる', () => {
      expect(validateCustomerRole('applicant')).toBe(true);
      expect(validateCustomerRole('contractor')).toBe(true);
    });

    it('不正な顧客ロールを拒否する', () => {
      expect(validateCustomerRole('invalid')).toBe(false);
      expect(validateCustomerRole('customer')).toBe(false);
      expect(validateCustomerRole('heir')).toBe(false); // 'heir' is not in schema
    });
  });

  describe('validatePhysicalPlotCreate', () => {
    it('妥当な入力でエラーをスローしない', async () => {
      mockPrismaClient.physicalPlot.findFirst.mockResolvedValue(null);

      await expect(
        validatePhysicalPlotCreate(mockPrismaClient, 'A-56', 3.6)
      ).resolves.toBeUndefined();
    });

    it('不正な区画番号形式でエラーをスローする', async () => {
      await expect(validatePhysicalPlotCreate(mockPrismaClient, 'invalid', 3.6)).rejects.toThrow(
        ValidationError
      );
    });

    it('重複する区画番号でエラーをスローする', async () => {
      mockPrismaClient.physicalPlot.findFirst.mockResolvedValue({
        id: 'existing-plot',
        plot_number: 'A-56',
      });

      await expect(validatePhysicalPlotCreate(mockPrismaClient, 'A-56', 3.6)).rejects.toThrow(
        ValidationError
      );
    });

    it('不正な面積でエラーをスローする', async () => {
      mockPrismaClient.physicalPlot.findFirst.mockResolvedValue(null);

      await expect(validatePhysicalPlotCreate(mockPrismaClient, 'A-56', 0)).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe('validatePhysicalPlotUpdate', () => {
    it('区画番号を更新する場合、重複チェックを行う', async () => {
      mockPrismaClient.physicalPlot.findFirst.mockResolvedValue(null);

      await expect(
        validatePhysicalPlotUpdate(mockPrismaClient, 'plot-1', 'A-99')
      ).resolves.toBeUndefined();

      expect(mockPrismaClient.physicalPlot.findFirst).toHaveBeenCalledWith({
        where: {
          plot_number: 'A-99',
          deleted_at: null,
          id: { not: 'plot-1' },
        },
      });
    });

    it('不正な区画番号形式でエラーをスローする', async () => {
      await expect(
        validatePhysicalPlotUpdate(mockPrismaClient, 'plot-1', 'invalid')
      ).rejects.toThrow(ValidationError);
    });

    it('面積を更新する場合、既存契約との整合性をチェック', async () => {
      mockPrismaClient.physicalPlot.findUnique.mockResolvedValue({
        id: 'plot-1',
        contractPlots: [{ contract_area_sqm: { toNumber: () => 1.8 } }],
      });

      // 契約済み面積より小さい面積は不可
      await expect(
        validatePhysicalPlotUpdate(mockPrismaClient, 'plot-1', undefined, 1.0)
      ).rejects.toThrow(ValidationError);

      // 契約済み面積以上なら OK
      await expect(
        validatePhysicalPlotUpdate(mockPrismaClient, 'plot-1', undefined, 3.6)
      ).resolves.toBeUndefined();
    });

    it('不正な面積でエラーをスローする', async () => {
      await expect(
        validatePhysicalPlotUpdate(mockPrismaClient, 'plot-1', undefined, 0)
      ).rejects.toThrow(ValidationError);
    });

    it('更新内容がない場合はエラーをスローしない', async () => {
      await expect(validatePhysicalPlotUpdate(mockPrismaClient, 'plot-1')).resolves.toBeUndefined();
    });
  });
});
