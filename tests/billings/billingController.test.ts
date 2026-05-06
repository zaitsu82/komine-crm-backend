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
  billing: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  payment: {
    updateMany: jest.fn(),
  },
  customer: {
    findFirst: jest.fn(),
  },
  contractPlot: {
    findFirst: jest.fn(),
  },
  $transaction: jest.fn(),
};

jest.mock('../../src/db/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

import {
  getBillings,
  getBillingById,
  createBilling,
  updateBilling,
  deleteBilling,
} from '../../src/billings/billingController';

const VALID_UUID = '11111111-1111-4111-8111-111111111111';
const PLOT_UUID = '22222222-2222-4222-8222-222222222222';
const CUSTOMER_UUID = '33333333-3333-4333-8333-333333333333';

const buildResponse = (): Partial<Response> => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

const buildRequest = (
  overrides: Partial<{
    body: unknown;
    query: Record<string, string>;
    params: Record<string, string>;
  }> = {}
): Partial<Request> => ({
  body: overrides.body ?? {},
  query: overrides.query ?? {},
  params: overrides.params ?? {},
  user: {
    id: 1,
    email: 'admin@example.com',
    name: 'Admin',
    role: 'admin',
    is_active: true,
    supabase_uid: 'admin-uid',
  },
});

const buildBillingRow = (overrides: Record<string, unknown> = {}) => ({
  id: VALID_UUID,
  contract_plot_id: PLOT_UUID,
  customer_id: CUSTOMER_UUID,
  category: 'management_fee',
  amount: 12000,
  use_start_year: 2026,
  use_end_year: 2026,
  target_month: 4,
  billing_years: 1,
  contract_date: new Date('2024-01-15'),
  billing_date: new Date('2026-04-01'),
  paid_amount: 0,
  last_payment_date: null,
  terminated: false,
  terminated_date: null,
  status: 'billed',
  application_type: null,
  billing_type: null,
  notes: null,
  legacy_seikyu_cd: null,
  customer: { id: CUSTOMER_UUID, name: '山田太郎', name_kana: 'ヤマダタロウ' },
  contractPlot: {
    id: PLOT_UUID,
    physicalPlot: { id: 'pp-1', plot_number: 'A-1', area_name: '第1期' },
  },
  created_at: new Date('2026-04-01T00:00:00Z'),
  updated_at: new Date('2026-04-01T00:00:00Z'),
  ...overrides,
});

describe('billingController', () => {
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    res = buildResponse();
    next = jest.fn();
  });

  describe('getBillings', () => {
    it('returns paginated list with formatted items', async () => {
      mockPrisma.billing.findMany.mockResolvedValue([buildBillingRow()]);
      mockPrisma.billing.count.mockResolvedValue(1);

      const req = buildRequest({ query: { page: '1', limit: '10' } });
      await getBillings(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const payload = (res.json as jest.Mock).mock.calls[0][0];
      expect(payload.success).toBe(true);
      expect(payload.data.items).toHaveLength(1);
      expect(payload.data.items[0]).toMatchObject({
        id: VALID_UUID,
        contractPlotId: PLOT_UUID,
        customerId: CUSTOMER_UUID,
        category: 'management_fee',
        amount: 12000,
        billingDate: '2026-04-01',
        plotNumber: 'A-1',
        areaName: '第1期',
      });
      expect(payload.data.pagination).toEqual({
        page: 1,
        limit: 10,
        totalCount: 1,
        totalPages: 1,
      });
    });

    it('applies filter conditions to where clause', async () => {
      mockPrisma.billing.findMany.mockResolvedValue([]);
      mockPrisma.billing.count.mockResolvedValue(0);

      const req = buildRequest({
        query: {
          contractPlotId: PLOT_UUID,
          customerId: CUSTOMER_UUID,
          category: 'management_fee',
          status: 'billed',
          billingDateFrom: '2026-01-01',
          billingDateTo: '2026-12-31',
        },
      });
      await getBillings(req as Request, res as Response, next);

      const callArgs = mockPrisma.billing.findMany.mock.calls[0][0];
      expect(callArgs.where).toMatchObject({
        deleted_at: null,
        contract_plot_id: PLOT_UUID,
        customer_id: CUSTOMER_UUID,
        category: 'management_fee',
        status: 'billed',
      });
      expect(callArgs.where.billing_date.gte).toBeInstanceOf(Date);
      expect(callArgs.where.billing_date.lte).toBeInstanceOf(Date);
    });

    it('rejects invalid query (non-uuid contractPlotId)', async () => {
      const req = buildRequest({ query: { contractPlotId: 'not-a-uuid' } });
      await getBillings(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ name: 'ValidationError' }));
    });
  });

  describe('getBillingById', () => {
    it('returns billing detail with payments', async () => {
      mockPrisma.billing.findFirst.mockResolvedValue({
        ...buildBillingRow(),
        payments: [
          {
            id: 'p1',
            payment_date: new Date('2026-04-15'),
            scheduled_date: new Date('2026-04-15'),
            payment_amount: 12000,
            scheduled_amount: 12000,
            fee_type: '管理料',
            staff_in_charge: '山本',
            notes: null,
          },
        ],
      });

      const req = buildRequest({ params: { id: VALID_UUID } });
      await getBillingById(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const payload = (res.json as jest.Mock).mock.calls[0][0];
      expect(payload.data.id).toBe(VALID_UUID);
      expect(payload.data.payments).toHaveLength(1);
      expect(payload.data.payments[0]).toMatchObject({
        id: 'p1',
        paymentDate: '2026-04-15',
        paymentAmount: 12000,
        feeType: '管理料',
      });
    });

    it('returns NotFoundError when not found', async () => {
      mockPrisma.billing.findFirst.mockResolvedValue(null);

      const req = buildRequest({ params: { id: VALID_UUID } });
      await getBillingById(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ name: 'NotFoundError' }));
    });
  });

  describe('createBilling', () => {
    it('creates a new billing when contract plot and customer exist', async () => {
      mockPrisma.contractPlot.findFirst.mockResolvedValue({ id: PLOT_UUID });
      mockPrisma.customer.findFirst.mockResolvedValue({ id: CUSTOMER_UUID });
      mockPrisma.billing.create.mockResolvedValue(buildBillingRow());

      const req = buildRequest({
        body: {
          contractPlotId: PLOT_UUID,
          customerId: CUSTOMER_UUID,
          category: 'management_fee',
          amount: 12000,
          billingDate: '2026-04-01',
        },
      });
      await createBilling(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(201);
      const payload = (res.json as jest.Mock).mock.calls[0][0];
      expect(payload.success).toBe(true);
      expect(payload.data.id).toBe(VALID_UUID);
      const createCall = mockPrisma.billing.create.mock.calls[0][0];
      expect(createCall.data.contract_plot_id).toBe(PLOT_UUID);
      expect(createCall.data.customer_id).toBe(CUSTOMER_UUID);
      expect(createCall.data.amount).toBe(12000);
    });

    it('returns NotFoundError when contract plot does not exist', async () => {
      mockPrisma.contractPlot.findFirst.mockResolvedValue(null);
      mockPrisma.customer.findFirst.mockResolvedValue({ id: CUSTOMER_UUID });

      const req = buildRequest({
        body: {
          contractPlotId: PLOT_UUID,
          customerId: CUSTOMER_UUID,
          category: 'management_fee',
          amount: 12000,
        },
      });
      await createBilling(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ name: 'NotFoundError' }));
      expect(mockPrisma.billing.create).not.toHaveBeenCalled();
    });

    it('rejects invalid body (missing amount)', async () => {
      const req = buildRequest({
        body: {
          contractPlotId: PLOT_UUID,
          customerId: CUSTOMER_UUID,
          category: 'management_fee',
        },
      });
      await createBilling(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ name: 'ValidationError' }));
    });

    it('rejects invalid category', async () => {
      const req = buildRequest({
        body: {
          contractPlotId: PLOT_UUID,
          customerId: CUSTOMER_UUID,
          category: 'invalid_category',
          amount: 1000,
        },
      });
      await createBilling(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ name: 'ValidationError' }));
    });
  });

  describe('updateBilling', () => {
    it('partially updates a billing', async () => {
      mockPrisma.billing.findFirst.mockResolvedValue({ id: VALID_UUID });
      mockPrisma.billing.update.mockResolvedValue(
        buildBillingRow({ amount: 15000, status: 'partial_paid' })
      );

      const req = buildRequest({
        params: { id: VALID_UUID },
        body: { amount: 15000 },
      });
      await updateBilling(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const updateCall = mockPrisma.billing.update.mock.calls[0][0];
      expect(updateCall.where).toEqual({ id: VALID_UUID });
      expect(updateCall.data).toEqual({ amount: 15000 });
    });

    it('returns NotFoundError when billing does not exist', async () => {
      mockPrisma.billing.findFirst.mockResolvedValue(null);

      const req = buildRequest({
        params: { id: VALID_UUID },
        body: { amount: 1 },
      });
      await updateBilling(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ name: 'NotFoundError' }));
    });
  });

  describe('deleteBilling', () => {
    it('soft-deletes the billing and orphans related payments', async () => {
      mockPrisma.billing.findFirst.mockResolvedValue({ id: VALID_UUID });
      const txMock = {
        billing: { update: jest.fn().mockResolvedValue({}) },
        payment: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
      };
      mockPrisma.$transaction.mockImplementation(async (cb) => cb(txMock));

      const req = buildRequest({ params: { id: VALID_UUID } });
      await deleteBilling(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(txMock.payment.updateMany).toHaveBeenCalledWith({
        where: { billing_id: VALID_UUID, deleted_at: null },
        data: { billing_id: null },
      });
      expect(txMock.billing.update).toHaveBeenCalledWith({
        where: { id: VALID_UUID },
        data: { deleted_at: expect.any(Date) },
      });
    });

    it('returns NotFoundError when billing does not exist', async () => {
      mockPrisma.billing.findFirst.mockResolvedValue(null);

      const req = buildRequest({ params: { id: VALID_UUID } });
      await deleteBilling(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ name: 'NotFoundError' }));
    });
  });
});
