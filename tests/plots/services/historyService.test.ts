/**
 * historyService.ts のテスト
 *
 * 汎用ヘルパー（recordEntityCreated/Updated/Deleted）と
 * 既存の各種ヘルパーが期待通り createHistory を呼び出すことを検証する。
 */

import { Request } from 'express';
import {
  createHistory,
  recordEntityCreated,
  recordEntityUpdated,
  recordEntityDeleted,
} from '../../../src/plots/services/historyService';

// 認証リクエストの型拡張
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

describe('historyService', () => {
  const mockReq = {
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    user: {
      id: 1,
      email: 'test@example.com',
      name: 'テストユーザー',
      role: 'admin',
      is_active: true,
      supabase_uid: 'uid-1',
    },
  } as unknown as Request;

  let mockTx: any;

  beforeEach(() => {
    mockTx = {
      history: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
  });

  describe('createHistory', () => {
    it('CREATE時に履歴レコードを作成する', async () => {
      await createHistory(mockTx, {
        entityType: 'UsageFee',
        entityId: 'uf-1',
        physicalPlotId: 'pp-1',
        contractPlotId: 'cp-1',
        actionType: 'CREATE',
        afterRecord: { id: 'uf-1', usage_fee: '1000' },
        req: mockReq,
      });

      expect(mockTx.history.create).toHaveBeenCalledTimes(1);
      const call = mockTx.history.create.mock.calls[0][0];
      expect(call.data.entity_type).toBe('UsageFee');
      expect(call.data.entity_id).toBe('uf-1');
      expect(call.data.physical_plot_id).toBe('pp-1');
      expect(call.data.contract_plot_id).toBe('cp-1');
      expect(call.data.action_type).toBe('CREATE');
      expect(call.data.changed_by).toBe('テストユーザー');
    });

    it('UPDATE時に変更フィールドを検出して履歴を作成する', async () => {
      await createHistory(mockTx, {
        entityType: 'Customer',
        entityId: 'c-1',
        physicalPlotId: 'pp-1',
        contractPlotId: 'cp-1',
        actionType: 'UPDATE',
        beforeRecord: { name: '田中', phone_number: '090-1111-1111' },
        afterRecord: { name: '田中太郎', phone_number: '090-1111-1111' },
        req: mockReq,
      });

      expect(mockTx.history.create).toHaveBeenCalledTimes(1);
      const call = mockTx.history.create.mock.calls[0][0];
      expect(call.data.changed_fields).toEqual({
        name: { before: '田中', after: '田中太郎' },
      });
    });

    it('UPDATE時に差分が無ければ履歴を作成しない', async () => {
      await createHistory(mockTx, {
        entityType: 'Customer',
        entityId: 'c-1',
        actionType: 'UPDATE',
        beforeRecord: { name: '田中' },
        afterRecord: { name: '田中' },
        req: mockReq,
      });

      expect(mockTx.history.create).not.toHaveBeenCalled();
    });

    it('user情報がない場合は system として記録される', async () => {
      const reqWithoutUser = { ip: '127.0.0.1', socket: {} } as unknown as Request;

      await createHistory(mockTx, {
        entityType: 'Customer',
        entityId: 'c-1',
        actionType: 'CREATE',
        afterRecord: { name: '田中' },
        req: reqWithoutUser,
      });

      expect(mockTx.history.create.mock.calls[0][0].data.changed_by).toBe('system');
    });
  });

  describe('recordEntityCreated', () => {
    it('CREATEアクションで履歴を作成する', async () => {
      await recordEntityCreated(mockTx, {
        entityType: 'WorkInfo',
        entityId: 'wi-1',
        physicalPlotId: 'pp-1',
        contractPlotId: 'cp-1',
        afterRecord: { id: 'wi-1', company_name: 'テスト株式会社' },
        req: mockReq,
      });

      expect(mockTx.history.create).toHaveBeenCalledTimes(1);
      const data = mockTx.history.create.mock.calls[0][0].data;
      expect(data.entity_type).toBe('WorkInfo');
      expect(data.action_type).toBe('CREATE');
      expect(data.after_record).toEqual({ id: 'wi-1', company_name: 'テスト株式会社' });
    });
  });

  describe('recordEntityUpdated', () => {
    it('UPDATEアクションで before/after を渡して履歴を作成する', async () => {
      await recordEntityUpdated(mockTx, {
        entityType: 'BuriedPerson',
        entityId: 'bp-1',
        physicalPlotId: 'pp-1',
        contractPlotId: 'cp-1',
        beforeRecord: { name: '山田' },
        afterRecord: { name: '山田次郎' },
        req: mockReq,
      });

      expect(mockTx.history.create).toHaveBeenCalledTimes(1);
      const data = mockTx.history.create.mock.calls[0][0].data;
      expect(data.action_type).toBe('UPDATE');
      expect(data.changed_fields).toEqual({
        name: { before: '山田', after: '山田次郎' },
      });
    });

    it('変更がない場合は履歴を作成しない', async () => {
      await recordEntityUpdated(mockTx, {
        entityType: 'BuriedPerson',
        entityId: 'bp-1',
        beforeRecord: { name: '山田' },
        afterRecord: { name: '山田' },
        req: mockReq,
      });

      expect(mockTx.history.create).not.toHaveBeenCalled();
    });
  });

  describe('recordEntityDeleted', () => {
    it('DELETEアクションで履歴を作成する', async () => {
      await recordEntityDeleted(mockTx, {
        entityType: 'CollectiveBurial',
        entityId: 'cb-1',
        physicalPlotId: 'pp-1',
        contractPlotId: 'cp-1',
        beforeRecord: { id: 'cb-1', burial_capacity: 5 },
        req: mockReq,
      });

      expect(mockTx.history.create).toHaveBeenCalledTimes(1);
      const data = mockTx.history.create.mock.calls[0][0].data;
      expect(data.entity_type).toBe('CollectiveBurial');
      expect(data.action_type).toBe('DELETE');
      expect(data.before_record).toEqual({ id: 'cb-1', burial_capacity: 5 });
    });
  });
});
