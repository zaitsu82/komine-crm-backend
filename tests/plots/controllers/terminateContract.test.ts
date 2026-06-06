/**
 * terminateContract コントローラのテスト（#236）
 * POST /api/v1/plots/:id/terminate
 *
 * 解約は論理削除と異なり deleted_at を変更せず、解約後も参照・復活可能。
 */

import { Request, Response, NextFunction } from 'express';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
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

const mockPrisma: any = {
  contractPlot: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn((callback: any) => Promise.resolve(callback(mockPrisma))),
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
  // Serializable tx 化（#278）で参照される分離レベル定数
  Prisma: {
    TransactionIsolationLevel: { Serializable: 'Serializable' },
  },
  ContractStatus: {
    vacant: 'vacant',
    active: 'active',
    terminated: 'terminated',
  },
  PaymentStatus: {
    unpaid: 'unpaid',
    partial_paid: 'partial_paid',
    paid: 'paid',
    overdue: 'overdue',
    refunded: 'refunded',
    cancelled: 'cancelled',
  },
}));

const mockRecordEntityUpdated = jest.fn();
jest.mock('../../../src/plots/services/historyService', () => ({
  recordEntityUpdated: (...args: unknown[]) => mockRecordEntityUpdated(...args),
}));

const mockUpdatePhysicalPlotStatus = jest.fn();
jest.mock('../../../src/plots/utils', () => ({
  updatePhysicalPlotStatus: (...args: unknown[]) => mockUpdatePhysicalPlotStatus(...args),
}));

import { terminateContract } from '../../../src/plots/controllers/terminateContract';
import { NotFoundError, ConflictError } from '../../../src/middleware/errorHandler';

const buildRes = (): Response => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res) as unknown as Response['status'];
  res.json = jest.fn().mockReturnValue(res) as unknown as Response['json'];
  return res;
};

const buildReq = (overrides: Partial<Request> = {}): Request => {
  const req = {
    params: { id: 'cp-1' },
    body: { reason: '利用者からの解約申請のため' },
    user: {
      id: 1,
      email: 'staff@example.com',
      name: 'Test Staff',
      role: 'operator',
      is_active: true,
      supabase_uid: 'sup-1',
    },
    ip: '127.0.0.1',
    get: jest.fn().mockReturnValue(undefined),
    ...overrides,
  } as unknown as Request;
  return req;
};

describe('terminateContract (#236)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('成功ケース', () => {
    it('active → terminated への解約が成功し、履歴と物理区画再計算が行われる', async () => {
      mockPrisma.contractPlot.findUnique.mockResolvedValue({
        id: 'cp-1',
        physical_plot_id: 'pp-1',
        contract_status: 'active',
        deleted_at: null,
      });
      mockPrisma.contractPlot.update.mockResolvedValue({
        id: 'cp-1',
        contract_status: 'terminated',
      });

      const req = buildReq();
      const res = buildRes();
      const next = jest.fn() as NextFunction;

      await terminateContract(req, res, next);

      expect(mockPrisma.contractPlot.update).toHaveBeenCalledWith({
        where: { id: 'cp-1' },
        data: { contract_status: 'terminated' },
      });
      // deleted_at は変更しない（解約後も参照・復活可能）
      const updateData = mockPrisma.contractPlot.update.mock.calls[0][0].data;
      expect(updateData).not.toHaveProperty('deleted_at');

      // 物理区画ステータスの再計算（restore #210 と対称）
      expect(mockUpdatePhysicalPlotStatus).toHaveBeenCalledWith(mockPrisma, 'pp-1');

      // 読取り・検証・更新は単一 Serializable tx で原子化される（#278）
      expect(mockPrisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
        isolationLevel: 'Serializable',
      });

      // 履歴記録
      expect(mockRecordEntityUpdated).toHaveBeenCalledTimes(1);
      const historyCall = mockRecordEntityUpdated.mock.calls[0]?.[1] as Record<string, unknown>;
      expect(historyCall).toMatchObject({
        entityType: 'ContractPlot',
        entityId: 'cp-1',
        physicalPlotId: 'pp-1',
        contractPlotId: 'cp-1',
        beforeRecord: { contract_status: 'active' },
        afterRecord: { contract_status: 'terminated' },
        changeReason: '利用者からの解約申請のため',
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          message: '契約区画を解約しました',
          id: 'cp-1',
          contractStatus: 'terminated',
        },
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('失敗ケース', () => {
    it('存在しない（または論理削除済み）ContractPlot は NotFoundError', async () => {
      mockPrisma.contractPlot.findUnique.mockResolvedValue(null);

      const req = buildReq();
      const res = buildRes();
      const next = jest.fn() as NextFunction;

      await terminateContract(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect((next as jest.Mock).mock.calls[0]?.[0]).toBeInstanceOf(NotFoundError);
      expect(mockPrisma.contractPlot.update).not.toHaveBeenCalled();
    });

    it('terminated 状態からの解約は ConflictError', async () => {
      mockPrisma.contractPlot.findUnique.mockResolvedValue({
        id: 'cp-1',
        physical_plot_id: 'pp-1',
        contract_status: 'terminated',
        deleted_at: null,
      });

      const req = buildReq();
      const res = buildRes();
      const next = jest.fn() as NextFunction;

      await terminateContract(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = (next as jest.Mock).mock.calls[0]?.[0] as Error;
      expect(err).toBeInstanceOf(ConflictError);
      expect(err.message).toContain('active のみ解約可能');
      expect(mockPrisma.contractPlot.update).not.toHaveBeenCalled();
    });

    it('vacant 状態からの解約も ConflictError', async () => {
      mockPrisma.contractPlot.findUnique.mockResolvedValue({
        id: 'cp-1',
        physical_plot_id: 'pp-1',
        contract_status: 'vacant',
        deleted_at: null,
      });

      const req = buildReq();
      const res = buildRes();
      const next = jest.fn() as NextFunction;

      await terminateContract(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect((next as jest.Mock).mock.calls[0]?.[0]).toBeInstanceOf(ConflictError);
      expect(mockPrisma.contractPlot.update).not.toHaveBeenCalled();
    });

    it('DB エラーは next に伝播される', async () => {
      mockPrisma.contractPlot.findUnique.mockRejectedValue(new Error('connection lost'));

      const req = buildReq();
      const res = buildRes();
      const next = jest.fn() as NextFunction;

      await terminateContract(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(((next as jest.Mock).mock.calls[0]?.[0] as Error).message).toBe('connection lost');
    });
  });
});
