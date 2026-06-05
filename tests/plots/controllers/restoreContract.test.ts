/**
 * restoreContract コントローラのテスト
 * POST /api/v1/plots/:id/restore
 */

import { Request, Response, NextFunction } from 'express';

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

const mockPrisma: any = {
  contractPlot: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  history: {
    create: jest.fn(),
  },
  $transaction: jest.fn((callback: any) => Promise.resolve(callback(mockPrisma))),
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
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

import { restoreContract } from '../../../src/plots/controllers/restoreContract';
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
    body: { reason: '誤って解約したため復活' },
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

describe('restoreContract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('成功ケース', () => {
    it('terminated → active への復活が成功し、履歴も記録される', async () => {
      mockPrisma.contractPlot.findUnique.mockResolvedValue({
        id: 'cp-1',
        physical_plot_id: 'pp-1',
        contract_status: 'terminated',
        deleted_at: null,
      });
      mockPrisma.contractPlot.update.mockResolvedValue({
        id: 'cp-1',
        contract_status: 'active',
      });

      const req = buildReq();
      const res = buildRes();
      const next = jest.fn() as NextFunction;

      await restoreContract(req, res, next);

      expect(mockPrisma.contractPlot.update).toHaveBeenCalledWith({
        where: { id: 'cp-1' },
        data: { contract_status: 'active' },
      });
      // 物理区画ステータスの再計算がトランザクション内で呼ばれること（#210）
      expect(mockUpdatePhysicalPlotStatus).toHaveBeenCalledWith(mockPrisma, 'pp-1');
      expect(mockRecordEntityUpdated).toHaveBeenCalledTimes(1);
      const historyCall = mockRecordEntityUpdated.mock.calls[0]?.[1] as Record<string, unknown>;
      expect(historyCall).toMatchObject({
        entityType: 'ContractPlot',
        entityId: 'cp-1',
        physicalPlotId: 'pp-1',
        contractPlotId: 'cp-1',
        beforeRecord: { contract_status: 'terminated' },
        afterRecord: { contract_status: 'active' },
        changeReason: '誤って解約したため復活',
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          message: '契約区画を復活しました',
          id: 'cp-1',
          contractStatus: 'active',
        },
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('失敗ケース', () => {
    it('存在しない ContractPlot は NotFoundError', async () => {
      mockPrisma.contractPlot.findUnique.mockResolvedValue(null);

      const req = buildReq();
      const res = buildRes();
      const next = jest.fn() as NextFunction;

      await restoreContract(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = (next as jest.Mock).mock.calls[0]?.[0] as Error;
      expect(err).toBeInstanceOf(NotFoundError);
      expect(mockPrisma.contractPlot.update).not.toHaveBeenCalled();
      expect(mockRecordEntityUpdated).not.toHaveBeenCalled();
    });

    it('active 状態からの復活は ConflictError', async () => {
      mockPrisma.contractPlot.findUnique.mockResolvedValue({
        id: 'cp-1',
        physical_plot_id: 'pp-1',
        contract_status: 'active',
        deleted_at: null,
      });

      const req = buildReq();
      const res = buildRes();
      const next = jest.fn() as NextFunction;

      await restoreContract(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = (next as jest.Mock).mock.calls[0]?.[0] as Error;
      expect(err).toBeInstanceOf(ConflictError);
      expect((err as Error).message).toContain('terminated のみ復活可能');
      expect(mockPrisma.contractPlot.update).not.toHaveBeenCalled();
      expect(mockRecordEntityUpdated).not.toHaveBeenCalled();
    });

    it('vacant 状態からの復活も ConflictError', async () => {
      mockPrisma.contractPlot.findUnique.mockResolvedValue({
        id: 'cp-1',
        physical_plot_id: 'pp-1',
        contract_status: 'vacant',
        deleted_at: null,
      });

      const req = buildReq();
      const res = buildRes();
      const next = jest.fn() as NextFunction;

      await restoreContract(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = (next as jest.Mock).mock.calls[0]?.[0] as Error;
      expect(err).toBeInstanceOf(ConflictError);
      expect(mockPrisma.contractPlot.update).not.toHaveBeenCalled();
    });

    it('DB エラーは next に伝播される', async () => {
      mockPrisma.contractPlot.findUnique.mockRejectedValue(new Error('connection lost'));

      const req = buildReq();
      const res = buildRes();
      const next = jest.fn() as NextFunction;

      await restoreContract(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = (next as jest.Mock).mock.calls[0]?.[0] as Error;
      expect(err.message).toBe('connection lost');
    });
  });

  describe('履歴記録の詳細', () => {
    it('reason がトリム後の値で履歴に記録される（zod schema 前提）', async () => {
      mockPrisma.contractPlot.findUnique.mockResolvedValue({
        id: 'cp-1',
        physical_plot_id: 'pp-1',
        contract_status: 'terminated',
        deleted_at: null,
      });
      mockPrisma.contractPlot.update.mockResolvedValue({
        id: 'cp-1',
        contract_status: 'active',
      });

      const req = buildReq({ body: { reason: '担当者の入力ミス - リカバリ' } } as Partial<Request>);
      const res = buildRes();
      const next = jest.fn() as NextFunction;

      await restoreContract(req, res, next);

      const historyCall = mockRecordEntityUpdated.mock.calls[0]?.[1] as Record<string, unknown>;
      expect(historyCall['changeReason']).toBe('担当者の入力ミス - リカバリ');
    });
  });
});
