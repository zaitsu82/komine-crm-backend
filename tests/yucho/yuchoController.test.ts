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

const mockPrisma = {
  managementFee: { findMany: jest.fn() },
  collectiveBurial: { findMany: jest.fn() },
};

jest.mock('../../src/db/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

import { getYuchoBilling, exportYuchoCsv } from '../../src/yucho/yuchoController';

const buildContractPlot = (overrides: Record<string, unknown> = {}) => ({
  id: 'cp-1',
  contract_date: new Date('2024-01-15'),
  payment_status: 'unpaid',
  contract_status: 'active',
  physicalPlot: {
    id: 'pp-1',
    plot_number: 'A-1',
    area_name: '第1期',
  },
  saleContractRoles: [
    {
      role: 'contractor',
      customer: {
        id: 'cust-1',
        name: '山田太郎',
        name_kana: 'ヤマダタロウ',
        billingInfo: {
          bank_name: 'ゆうちょ銀行',
          branch_name: '〇一八',
          account_type: 'ordinary',
          account_number: '1234567',
          account_holder: 'ヤマダタロウ',
        },
      },
    },
  ],
  ...overrides,
});

const buildResponse = (): Partial<Response> => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
  setHeader: jest.fn().mockReturnThis(),
  send: jest.fn().mockReturnThis(),
});

const buildRequest = (query: Record<string, string>): Partial<Request> => ({
  query,
  params: {},
  body: {},
  user: {
    id: 1,
    email: 'admin@example.com',
    name: 'Admin',
    role: 'admin',
    is_active: true,
    supabase_uid: 'admin-uid',
  },
});

describe('yuchoController', () => {
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    res = buildResponse();
    next = jest.fn();
  });

  describe('getYuchoBilling', () => {
    it('returns aggregated management + collective items with summary', async () => {
      mockPrisma.managementFee.findMany.mockResolvedValue([
        {
          id: 'fee-1',
          contract_plot_id: 'cp-1',
          billing_month: '4',
          management_fee: '12000',
          contractPlot: buildContractPlot(),
        },
      ]);
      mockPrisma.collectiveBurial.findMany.mockResolvedValue([
        {
          id: 'cb-1',
          contract_plot_id: 'cp-2',
          billing_amount: 50000,
          billing_status: 'pending',
          billing_scheduled_date: new Date('2026-04-15'),
          contractPlot: buildContractPlot({
            id: 'cp-2',
            physicalPlot: { id: 'pp-2', plot_number: 'B-2', area_name: '第2期' },
          }),
        },
      ]);

      const req = buildRequest({ year: '2026', month: '4' });
      await getYuchoBilling(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const payload = (res.json as jest.Mock).mock.calls[0][0];
      expect(payload.success).toBe(true);
      expect(payload.data.period).toEqual({ year: 2026, month: 4 });
      expect(payload.data.items).toHaveLength(2);
      expect(payload.data.summary.totalCount).toBe(2);
      expect(payload.data.summary.totalAmount).toBe(62000);
      expect(payload.data.summary.byCategory.management.amount).toBe(12000);
      expect(payload.data.summary.byCategory.collective.amount).toBe(50000);
    });

    it('filters out management fees whose billing_month does not match', async () => {
      mockPrisma.managementFee.findMany.mockResolvedValue([
        {
          id: 'f1',
          contract_plot_id: 'cp-1',
          billing_month: '4',
          management_fee: '10000',
          contractPlot: buildContractPlot(),
        },
        {
          id: 'f2',
          contract_plot_id: 'cp-2',
          billing_month: '5',
          management_fee: '8000',
          contractPlot: buildContractPlot({ id: 'cp-2' }),
        },
      ]);
      mockPrisma.collectiveBurial.findMany.mockResolvedValue([]);

      const req = buildRequest({ year: '2026', month: '4', category: 'management' });
      await getYuchoBilling(req as Request, res as Response, next);

      const payload = (res.json as jest.Mock).mock.calls[0][0];
      expect(payload.data.items).toHaveLength(1);
      expect(payload.data.items[0].sourceId).toBe('f1');
    });

    it('skips management fees with non-positive amounts', async () => {
      mockPrisma.managementFee.findMany.mockResolvedValue([
        {
          id: 'f1',
          contract_plot_id: 'cp-1',
          billing_month: '4',
          management_fee: '0',
          contractPlot: buildContractPlot(),
        },
        {
          id: 'f2',
          contract_plot_id: 'cp-2',
          billing_month: '4',
          management_fee: '',
          contractPlot: buildContractPlot({ id: 'cp-2' }),
        },
      ]);
      mockPrisma.collectiveBurial.findMany.mockResolvedValue([]);

      const req = buildRequest({ year: '2026', month: '4', category: 'management' });
      await getYuchoBilling(req as Request, res as Response, next);

      const payload = (res.json as jest.Mock).mock.calls[0][0];
      expect(payload.data.items).toHaveLength(0);
    });

    it('honours category=collective by skipping management fee query', async () => {
      mockPrisma.collectiveBurial.findMany.mockResolvedValue([]);

      const req = buildRequest({ year: '2026', category: 'collective' });
      await getYuchoBilling(req as Request, res as Response, next);

      expect(mockPrisma.managementFee.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.collectiveBurial.findMany).toHaveBeenCalled();
    });

    it('returns 400-style ValidationError for invalid year', async () => {
      const req = buildRequest({ year: 'abc' });
      await getYuchoBilling(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ name: 'ValidationError' }));
    });

    it('prefers contractor role over applicant when picking the payer', async () => {
      mockPrisma.managementFee.findMany.mockResolvedValue([
        {
          id: 'f1',
          contract_plot_id: 'cp-1',
          billing_month: '4',
          management_fee: '10000',
          contractPlot: buildContractPlot({
            saleContractRoles: [
              {
                role: 'applicant',
                customer: {
                  id: 'a1',
                  name: '申込太郎',
                  name_kana: 'モウシコミタロウ',
                  billingInfo: null,
                },
              },
              {
                role: 'contractor',
                customer: {
                  id: 'c1',
                  name: '契約花子',
                  name_kana: 'ケイヤクハナコ',
                  billingInfo: {
                    bank_name: 'ゆうちょ銀行',
                    branch_name: '〇一八',
                    account_type: 'ordinary',
                    account_number: '7654321',
                    account_holder: 'ケイヤクハナコ',
                  },
                },
              },
            ],
          }),
        },
      ]);
      mockPrisma.collectiveBurial.findMany.mockResolvedValue([]);

      const req = buildRequest({ year: '2026', month: '4', category: 'management' });
      await getYuchoBilling(req as Request, res as Response, next);

      const payload = (res.json as jest.Mock).mock.calls[0][0];
      expect(payload.data.items[0].customerId).toBe('c1');
      expect(payload.data.items[0].billingInfo.accountNumber).toBe('7654321');
    });
  });

  describe('exportYuchoCsv', () => {
    const validQuery = {
      year: '2026',
      month: '4',
      transferDate: '2026-04-27',
      clientCode: '1234567',
      clientName: 'コミネレイエン',
    };

    it('returns text/csv with attachment disposition and Zengin records', async () => {
      mockPrisma.managementFee.findMany.mockResolvedValue([
        {
          id: 'f1',
          contract_plot_id: 'cp-1',
          billing_month: '4',
          management_fee: '12000',
          contractPlot: buildContractPlot(),
        },
      ]);
      mockPrisma.collectiveBurial.findMany.mockResolvedValue([]);

      const req = buildRequest(validQuery);
      await exportYuchoCsv(req as Request, res as Response, next);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('yucho_202604.csv')
      );
      expect(res.status).toHaveBeenCalledWith(200);
      const sent = (res.send as jest.Mock).mock.calls[0][0] as string;
      const lines = sent.split('\r\n').filter((l) => l.length > 0);
      expect(lines[0]?.[0]).toBe('1');
      expect(lines.find((l) => l[0] === '2')).toBeDefined();
      expect(lines.find((l) => l[0] === '8')).toBeDefined();
      expect(lines.find((l) => l[0] === '9')).toBeDefined();
    });

    it('rejects missing transferDate via ValidationError', async () => {
      const { transferDate: _omit, ...rest } = validQuery;
      void _omit;
      const req = buildRequest(rest);
      await exportYuchoCsv(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ name: 'ValidationError' }));
    });

    it('rejects malformed transferDate', async () => {
      const req = buildRequest({ ...validQuery, transferDate: '2026/04/27' });
      await exportYuchoCsv(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ name: 'ValidationError' }));
    });

    it('uses "all" suffix in filename when month is omitted', async () => {
      mockPrisma.managementFee.findMany.mockResolvedValue([]);
      mockPrisma.collectiveBurial.findMany.mockResolvedValue([]);

      const { month: _m, ...rest } = validQuery;
      void _m;
      const req = buildRequest(rest);
      await exportYuchoCsv(req as Request, res as Response, next);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('yucho_2026all.csv')
      );
    });
  });
});
