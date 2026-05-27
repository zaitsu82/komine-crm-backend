import {
  generateCollectiveBurialInvoices,
  processBilling,
} from '../../scripts/generate-collective-burial-invoices';
import * as collectiveBurialUtils from '../../src/collective-burials/utils';
import { PrismaClient } from '@prisma/client';

// Prisma Clientのモック
jest.mock('@prisma/client', () => {
  const mockPrismaClient = {
    collectiveBurial: {
      update: jest.fn(),
    },
    $transaction: jest.fn(),
    $disconnect: jest.fn(),
  };
  return {
    PrismaClient: jest.fn(() => mockPrismaClient),
  };
});

// collectiveBurialUtilsのモック
jest.mock('../../src/collective-burials/utils', () => ({
  getBillingTargets: jest.fn(),
}));

type BillingTarget = Parameters<typeof processBilling>[0];

/**
 * getBillingTargets の返り値要素と同じ構造のモックを生成する。
 * （contract_plot_id / contractPlot.physicalPlot.plot_number /
 *   contractPlot.saleContractRoles[].customer.name を持つ #184 の正しい形）
 */
const makeTarget = (overrides: {
  id: string;
  contract_plot_id?: string;
  plot_number?: string;
  billing_amount?: number | null;
  roles?: Array<{ role: string; name: string }>;
}): BillingTarget => {
  const {
    id,
    contract_plot_id = `cp-${id}`,
    plot_number = `A-${id}`,
    billing_amount = 50000,
    roles = [{ role: 'contractor', name: '田中太郎' }],
  } = overrides;
  return {
    id,
    contract_plot_id,
    billing_amount,
    billing_status: 'pending',
    contractPlot: {
      physicalPlot: { plot_number },
      saleContractRoles: roles.map((r) => ({
        role: r.role,
        customer: { name: r.name },
      })),
    },
  } as unknown as BillingTarget;
};

describe('generate-collective-burial-invoices', () => {
  let mockPrisma: any;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;

  beforeEach(() => {
    mockPrisma = new PrismaClient();
    jest.clearAllMocks();

    // コンソール出力をモック
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
      throw new Error(`Process.exit called with code ${code}`);
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe('generateCollectiveBurialInvoices', () => {
    it('should process billing successfully when targets exist', async () => {
      const mockTargets = [
        makeTarget({
          id: 'cb-1',
          billing_amount: 50000,
          roles: [{ role: 'contractor', name: '田中太郎' }],
        }),
        makeTarget({
          id: 'cb-2',
          billing_amount: 75000,
          roles: [{ role: 'applicant', name: '佐藤花子' }],
        }),
      ];

      (collectiveBurialUtils.getBillingTargets as jest.Mock).mockResolvedValue(mockTargets);

      // トランザクション内の処理をモック
      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return await callback(mockPrisma);
      });

      mockPrisma.collectiveBurial.update.mockResolvedValue({});

      await generateCollectiveBurialInvoices();

      expect(collectiveBurialUtils.getBillingTargets).toHaveBeenCalledWith(mockPrisma);
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(2);
      expect(mockPrisma.collectiveBurial.update).toHaveBeenCalledTimes(2);

      // ログ出力の確認
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('合祀情報請求バッチ処理を開始します')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('2件の請求対象が見つかりました')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('請求処理が正常に完了しました')
      );

      expect(mockPrisma.$disconnect).toHaveBeenCalled();
    });

    it('should exit successfully when no targets exist', async () => {
      (collectiveBurialUtils.getBillingTargets as jest.Mock).mockResolvedValue([]);

      await generateCollectiveBurialInvoices();

      expect(collectiveBurialUtils.getBillingTargets).toHaveBeenCalledWith(mockPrisma);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('請求対象が見つかりませんでした')
      );
      expect(mockPrisma.$disconnect).toHaveBeenCalled();
    });

    it('should handle errors during processing and exit with code 1', async () => {
      const mockError = new Error('Database connection failed');
      (collectiveBurialUtils.getBillingTargets as jest.Mock).mockRejectedValue(mockError);

      await expect(generateCollectiveBurialInvoices()).rejects.toThrow(
        'Process.exit called with code 1'
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('予期しないエラーが発生しました')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(mockError);
      expect(mockPrisma.$disconnect).toHaveBeenCalled();
    });

    it('should exit with code 1 when some billing processes fail', async () => {
      const mockTargets = [makeTarget({ id: 'cb-1', billing_amount: 50000 })];

      (collectiveBurialUtils.getBillingTargets as jest.Mock).mockResolvedValue(mockTargets);

      // トランザクションが失敗するようモック
      mockPrisma.$transaction.mockRejectedValue(new Error('Update failed'));

      await expect(generateCollectiveBurialInvoices()).rejects.toThrow(
        'Process.exit called with code 1'
      );

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('[失敗詳細]'));
      expect(mockPrisma.$disconnect).toHaveBeenCalled();
    });
  });

  describe('processBilling', () => {
    it('should process billing successfully for valid target', async () => {
      const mockTarget = makeTarget({
        id: 'cb-1',
        contract_plot_id: 'cp-1',
        plot_number: 'A-56',
        billing_amount: 50000,
        roles: [{ role: 'contractor', name: '田中太郎' }],
      });

      // トランザクション内の処理をモック
      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return await callback(mockPrisma);
      });

      mockPrisma.collectiveBurial.update.mockResolvedValue({});

      const result = await processBilling(mockTarget);

      expect(result.success).toBe(true);
      expect(result.collectiveBurialId).toBe('cb-1');
      expect(result.contractPlotId).toBe('cp-1');
      expect(result.plotNumber).toBe('A-56');
      expect(result.contractorName).toBe('田中太郎');
      expect(result.billingAmount).toBe(50000);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.collectiveBurial.update).toHaveBeenCalledWith({
        where: { id: 'cb-1' },
        data: {
          billing_status: 'billed',
          updated_at: expect.any(Date),
        },
      });
    });

    it('申込者ロールを優先して契約者名を採用する', async () => {
      const mockTarget = makeTarget({
        id: 'cb-1a',
        roles: [
          { role: 'contractor', name: '契約者タロウ' },
          { role: 'applicant', name: '申込者ハナコ' },
        ],
      });

      mockPrisma.$transaction.mockImplementation(async (callback: any) => callback(mockPrisma));
      mockPrisma.collectiveBurial.update.mockResolvedValue({});

      const result = await processBilling(mockTarget);

      expect(result.contractorName).toBe('申込者ハナコ');
    });

    it('should handle target without contractor', async () => {
      const mockTarget = makeTarget({ id: 'cb-2', billing_amount: 75000, roles: [] });

      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return await callback(mockPrisma);
      });

      mockPrisma.collectiveBurial.update.mockResolvedValue({});

      const result = await processBilling(mockTarget);

      expect(result.success).toBe(true);
      expect(result.contractorName).toBeNull();
      expect(result.billingAmount).toBe(75000);
    });

    it('should handle target without billing amount', async () => {
      const mockTarget = makeTarget({
        id: 'cb-3',
        billing_amount: null,
        roles: [{ role: 'contractor', name: '鈴木一郎' }],
      });

      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return await callback(mockPrisma);
      });

      mockPrisma.collectiveBurial.update.mockResolvedValue({});

      const result = await processBilling(mockTarget);

      expect(result.success).toBe(true);
      expect(result.billingAmount).toBeNull();
    });

    it('should return error result when transaction fails', async () => {
      const mockTarget = makeTarget({
        id: 'cb-4',
        contract_plot_id: 'cp-4',
        plot_number: 'B-4',
        billing_amount: 60000,
        roles: [{ role: 'contractor', name: '山田次郎' }],
      });

      const mockError = new Error('Transaction rollback');
      mockPrisma.$transaction.mockRejectedValue(mockError);

      const result = await processBilling(mockTarget);

      expect(result.success).toBe(false);
      expect(result.collectiveBurialId).toBe('cb-4');
      expect(result.contractPlotId).toBe('cp-4');
      expect(result.plotNumber).toBe('B-4');
      expect(result.error).toBe('Transaction rollback');
    });

    it('should handle non-Error exceptions', async () => {
      const mockTarget = makeTarget({ id: 'cb-5', billing_amount: 55000, roles: [] });

      mockPrisma.$transaction.mockRejectedValue('String error');

      const result = await processBilling(mockTarget);

      expect(result.success).toBe(false);
      expect(result.error).toBe('String error');
    });
  });
});
