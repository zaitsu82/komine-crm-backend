/**
 * changeContractor コントローラのテスト（#310）
 * POST /api/v1/plots/:id/change-contractor
 *
 * 名義変更 = 同一販売契約上で contractor role を旧契約者から新契約者へ交代。
 * 契約・申込者（applicant role）・区画情報は不変。履歴に change_reason
 * 「名義変更」で before/after を記録する。
 */

import { Request, Response } from 'express';

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
  },
  customer: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  saleContractRole: {
    update: jest.fn(),
    create: jest.fn(),
  },
  $transaction: jest.fn((callback: any) => Promise.resolve(callback(mockPrisma))),
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
  Prisma: {
    TransactionIsolationLevel: { Serializable: 'Serializable' },
  },
  ContractStatus: {
    vacant: 'vacant',
    active: 'active',
    terminated: 'terminated',
  },
  ContractRole: {
    applicant: 'applicant',
    contractor: 'contractor',
  },
}));

const mockRecordEntityUpdated = jest.fn();
jest.mock('../../../src/plots/services/historyService', () => ({
  recordEntityUpdated: (...args: unknown[]) => mockRecordEntityUpdated(...args),
}));

const mockSyncPrimaryContractorNameKana = jest.fn();
jest.mock('../../../src/plots/utils', () => ({
  syncPrimaryContractorNameKana: (...args: unknown[]) => mockSyncPrimaryContractorNameKana(...args),
}));

import { changeContractor } from '../../../src/plots/controllers/changeContractor';
import {
  NotFoundError,
  ConflictError,
  ValidationError,
} from '../../../src/middleware/errorHandler';

const buildRes = (): Response => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res) as unknown as Response['status'];
  res.json = jest.fn().mockReturnValue(res) as unknown as Response['json'];
  return res;
};

const buildReq = (body: Record<string, unknown>): Request => {
  const req = {
    params: { id: 'cp-1' },
    body,
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
  } as unknown as Request;
  return req;
};

const OLD_CUSTOMER = {
  id: 'cust-old',
  name: '山田太郎',
  name_kana: 'ヤマダタロウ',
};

const buildContractPlot = (overrides: Record<string, unknown> = {}) => ({
  id: 'cp-1',
  physical_plot_id: 'pp-1',
  contract_status: 'active',
  deleted_at: null,
  saleContractRoles: [
    {
      id: 'role-old',
      contract_plot_id: 'cp-1',
      customer_id: 'cust-old',
      role: 'contractor',
      role_start_date: null,
      role_end_date: null,
      deleted_at: null,
      customer: OLD_CUSTOMER,
    },
  ],
  ...overrides,
});

const NEW_CUSTOMER = {
  id: 'cust-new',
  name: '佐藤次郎',
  name_kana: 'サトウジロウ',
  is_terminated: false,
  deleted_at: null,
};

describe('changeContractor (#310)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation((callback: any) =>
      Promise.resolve(callback(mockPrisma))
    );
    mockPrisma.saleContractRole.update.mockResolvedValue({});
    mockPrisma.saleContractRole.create.mockResolvedValue({
      id: 'role-new',
      contract_plot_id: 'cp-1',
      customer_id: 'cust-new',
      role: 'contractor',
    });
  });

  describe('成功ケース（既存顧客の指定）', () => {
    it('旧roleをsoft-delete + role_end_date設定し、新roleを作成して履歴に「名義変更」を記録する', async () => {
      mockPrisma.contractPlot.findUnique.mockResolvedValue(buildContractPlot());
      mockPrisma.customer.findUnique.mockResolvedValue(NEW_CUSTOMER);

      const req = buildReq({ newCustomerId: 'cust-new', changeDate: '2026-06-01' });
      const res = buildRes();
      const next = jest.fn();

      await changeContractor(req, res, next);

      expect(next).not.toHaveBeenCalled();

      // Serializable tx で原子化されている
      expect(mockPrisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
        isolationLevel: 'Serializable',
      });

      // 旧 role: soft-delete + role_end_date = changeDate
      expect(mockPrisma.saleContractRole.update).toHaveBeenCalledWith({
        where: { id: 'role-old' },
        data: {
          deleted_at: expect.any(Date),
          role_end_date: new Date('2026-06-01'),
        },
      });

      // 新 role: contractor として作成、role_start_date = changeDate
      expect(mockPrisma.saleContractRole.create).toHaveBeenCalledWith({
        data: {
          contract_plot_id: 'cp-1',
          customer_id: 'cust-new',
          role: 'contractor',
          role_start_date: new Date('2026-06-01'),
        },
      });

      // 新規 Customer は作成しない
      expect(mockPrisma.customer.create).not.toHaveBeenCalled();

      // 履歴: change_reason「名義変更」+ before/after で過去の契約者を遡れる
      expect(mockRecordEntityUpdated).toHaveBeenCalledWith(
        mockPrisma,
        expect.objectContaining({
          entityType: 'ContractPlot',
          entityId: 'cp-1',
          changeReason: '名義変更',
          beforeRecord: {
            contractor_customer_id: 'cust-old',
            contractor_name: '山田太郎',
            contractor_name_kana: 'ヤマダタロウ',
          },
          afterRecord: {
            contractor_customer_id: 'cust-new',
            contractor_name: '佐藤次郎',
            contractor_name_kana: 'サトウジロウ',
          },
        })
      );

      // 契約者名カナ snapshot の再同期（#282/#297）
      expect(mockSyncPrimaryContractorNameKana).toHaveBeenCalledWith(mockPrisma, 'cp-1');

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          message: '名義変更を実施しました',
          id: 'cp-1',
          oldContractor: { customerId: 'cust-old', name: '山田太郎' },
          newContractor: expect.objectContaining({
            customerId: 'cust-new',
            name: '佐藤次郎',
            roleId: 'role-new',
          }),
        }),
      });
    });

    it('reason 指定時は change_reason に「名義変更: 理由」で付記される', async () => {
      mockPrisma.contractPlot.findUnique.mockResolvedValue(buildContractPlot());
      mockPrisma.customer.findUnique.mockResolvedValue(NEW_CUSTOMER);

      const req = buildReq({ newCustomerId: 'cust-new', reason: '相続のため' });
      const res = buildRes();
      const next = jest.fn();

      await changeContractor(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(mockRecordEntityUpdated).toHaveBeenCalledWith(
        mockPrisma,
        expect.objectContaining({ changeReason: '名義変更: 相続のため' })
      );
    });

    it('changeDate 省略時は当日が role_end_date / role_start_date に入る', async () => {
      mockPrisma.contractPlot.findUnique.mockResolvedValue(buildContractPlot());
      mockPrisma.customer.findUnique.mockResolvedValue(NEW_CUSTOMER);

      const req = buildReq({ newCustomerId: 'cust-new' });
      const res = buildRes();
      const next = jest.fn();

      await changeContractor(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(mockPrisma.saleContractRole.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ role_start_date: expect.any(Date) }),
      });
    });

    it('複数 contractor role が併存する場合は全件交代する（applicant は対象外）', async () => {
      mockPrisma.contractPlot.findUnique.mockResolvedValue(
        buildContractPlot({
          saleContractRoles: [
            {
              id: 'role-old',
              customer_id: 'cust-old',
              role: 'contractor',
              deleted_at: null,
              customer: OLD_CUSTOMER,
            },
            {
              id: 'role-old-2',
              customer_id: 'cust-old-2',
              role: 'contractor',
              deleted_at: null,
              customer: { id: 'cust-old-2', name: '山田花子', name_kana: 'ヤマダハナコ' },
            },
          ],
        })
      );
      mockPrisma.customer.findUnique.mockResolvedValue(NEW_CUSTOMER);

      const req = buildReq({ newCustomerId: 'cust-new' });
      const res = buildRes();
      const next = jest.fn();

      await changeContractor(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(mockPrisma.saleContractRole.update).toHaveBeenCalledTimes(2);
      expect(mockPrisma.saleContractRole.create).toHaveBeenCalledTimes(1);
      // 履歴の before は主契約者（先頭）
      expect(mockRecordEntityUpdated).toHaveBeenCalledWith(
        mockPrisma,
        expect.objectContaining({
          beforeRecord: expect.objectContaining({ contractor_customer_id: 'cust-old' }),
        })
      );
    });
  });

  describe('成功ケース（新規顧客の作成）', () => {
    it('newCustomer 指定で Customer を新規作成して契約者にする', async () => {
      mockPrisma.contractPlot.findUnique.mockResolvedValue(buildContractPlot());
      mockPrisma.customer.create.mockResolvedValue({
        id: 'cust-created',
        name: '鈴木三郎',
        name_kana: 'スズキサブロウ',
      });
      mockPrisma.saleContractRole.create.mockResolvedValue({
        id: 'role-new',
        customer_id: 'cust-created',
        role: 'contractor',
      });

      const req = buildReq({
        newCustomer: {
          name: '鈴木三郎',
          nameKana: 'スズキサブロウ',
          postalCode: '8100001',
          address: '福岡県福岡市中央区天神1-1-1',
          phoneNumber: '092-111-2222',
        },
      });
      const res = buildRes();
      const next = jest.fn();

      await changeContractor(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(mockPrisma.customer.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.customer.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: '鈴木三郎',
          name_kana: 'スズキサブロウ',
          postal_code: '8100001',
          address: '福岡県福岡市中央区天神1-1-1',
          phone_number: '092-111-2222',
        }),
      });
      expect(mockPrisma.saleContractRole.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ customer_id: 'cust-created', role: 'contractor' }),
      });
    });
  });

  describe('失敗ケース', () => {
    it('契約区画が存在しない場合は NotFoundError', async () => {
      mockPrisma.contractPlot.findUnique.mockResolvedValue(null);

      const req = buildReq({ newCustomerId: 'cust-new' });
      const next = jest.fn();

      await changeContractor(req, buildRes(), next);

      expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
      expect(mockPrisma.saleContractRole.update).not.toHaveBeenCalled();
    });

    it.each(['vacant', 'terminated'])('contract_status=%s では ConflictError', async (status) => {
      mockPrisma.contractPlot.findUnique.mockResolvedValue(
        buildContractPlot({ contract_status: status })
      );

      const req = buildReq({ newCustomerId: 'cust-new' });
      const next = jest.fn();

      await changeContractor(req, buildRes(), next);

      expect(next).toHaveBeenCalledWith(expect.any(ConflictError));
      expect(mockPrisma.saleContractRole.update).not.toHaveBeenCalled();
    });

    it('現在の契約者が存在しない場合は ConflictError', async () => {
      mockPrisma.contractPlot.findUnique.mockResolvedValue(
        buildContractPlot({ saleContractRoles: [] })
      );

      const req = buildReq({ newCustomerId: 'cust-new' });
      const next = jest.fn();

      await changeContractor(req, buildRes(), next);

      expect(next).toHaveBeenCalledWith(expect.any(ConflictError));
    });

    it('指定した既存顧客が存在しない場合は NotFoundError', async () => {
      mockPrisma.contractPlot.findUnique.mockResolvedValue(buildContractPlot());
      mockPrisma.customer.findUnique.mockResolvedValue(null);

      const req = buildReq({ newCustomerId: 'cust-missing' });
      const next = jest.fn();

      await changeContractor(req, buildRes(), next);

      expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
      expect(mockPrisma.saleContractRole.update).not.toHaveBeenCalled();
    });

    it('終了顧客（is_terminated）を指定した場合は ValidationError（#129）', async () => {
      mockPrisma.contractPlot.findUnique.mockResolvedValue(buildContractPlot());
      mockPrisma.customer.findUnique.mockResolvedValue({
        ...NEW_CUSTOMER,
        is_terminated: true,
      });

      const req = buildReq({ newCustomerId: 'cust-new' });
      const next = jest.fn();

      await changeContractor(req, buildRes(), next);

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
      expect(mockPrisma.saleContractRole.update).not.toHaveBeenCalled();
    });

    it('指定顧客が既に契約者の場合は ConflictError', async () => {
      mockPrisma.contractPlot.findUnique.mockResolvedValue(buildContractPlot());
      mockPrisma.customer.findUnique.mockResolvedValue({
        ...NEW_CUSTOMER,
        id: 'cust-old',
      });

      const req = buildReq({ newCustomerId: 'cust-old' });
      const next = jest.fn();

      await changeContractor(req, buildRes(), next);

      expect(next).toHaveBeenCalledWith(expect.any(ConflictError));
      expect(mockPrisma.saleContractRole.update).not.toHaveBeenCalled();
    });

    it('DB エラーは next に伝播する', async () => {
      mockPrisma.contractPlot.findUnique.mockRejectedValue(new Error('db down'));

      const req = buildReq({ newCustomerId: 'cust-new' });
      const next = jest.fn();

      await changeContractor(req, buildRes(), next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
