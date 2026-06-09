// payment_status 再計算はここでは検証対象外のため no-op に差し替える
jest.mock('../../src/plots/services/paymentStatusService', () => ({
  recalculateContractPlotPaymentStatus: jest.fn().mockResolvedValue('unpaid'),
}));

import {
  generateManagementFeeBillings,
  parseFeeAmount,
  parseBillingMonth,
  parseBillingYears,
  DEFAULT_BILLING_MONTH,
} from '../../src/billings/managementFeeBillingService';

interface MockContract {
  id: string;
  managementFee: {
    management_fee: string | null;
    billing_month: string | null;
    billing_years: string | null;
  } | null;
  saleContractRoles: Array<{ role: string; customer_id: string }>;
  billings: Array<{ id: string }>;
}

const buildContract = (over: Partial<MockContract> = {}): MockContract => ({
  id: 'cp1',
  managementFee: { management_fee: '5000', billing_month: '3', billing_years: '1' },
  saleContractRoles: [{ role: 'contractor', customer_id: 'c1' }],
  billings: [],
  ...over,
});

function buildPrisma(contracts: MockContract[]) {
  const billingCreate = jest.fn().mockResolvedValue({ id: 'b-new' });
  const prisma = {
    contractPlot: { findMany: jest.fn().mockResolvedValue(contracts) },
    $transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({ billing: { create: billingCreate } })
    ),
  };
  return { prisma: prisma as never, billingCreate };
}

describe('parse helpers (#196)', () => {
  it('parseFeeAmount は数字以外を除去し 0/不能は null', () => {
    expect(parseFeeAmount('5000')).toBe(5000);
    expect(parseFeeAmount('¥5,000')).toBe(5000);
    expect(parseFeeAmount('0')).toBeNull();
    expect(parseFeeAmount('')).toBeNull();
    expect(parseFeeAmount(null)).toBeNull();
  });
  it('parseBillingMonth は 1..12 以外を既定(3)に', () => {
    expect(parseBillingMonth('3')).toBe(3);
    expect(parseBillingMonth('10')).toBe(10);
    expect(parseBillingMonth('0')).toBe(DEFAULT_BILLING_MONTH);
    expect(parseBillingMonth('13')).toBe(DEFAULT_BILLING_MONTH);
    expect(parseBillingMonth(null)).toBe(DEFAULT_BILLING_MONTH);
  });
  it('parseBillingYears は未設定/0 を 1(年次) に', () => {
    expect(parseBillingYears('1')).toBe(1);
    expect(parseBillingYears('10')).toBe(10);
    expect(parseBillingYears('0')).toBe(1);
    expect(parseBillingYears(null)).toBe(1);
  });
});

describe('generateManagementFeeBillings (#196)', () => {
  it('対象契約に対象年度の管理料Billingを生成する', async () => {
    const { prisma, billingCreate } = buildPrisma([buildContract()]);
    const r = await generateManagementFeeBillings(prisma, { targetYear: 2026, apply: true });

    expect(r.created).toBe(1);
    expect(billingCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contract_plot_id: 'cp1',
          customer_id: 'c1',
          category: 'management_fee',
          amount: 5000,
          use_start_year: 2026,
          target_month: 3,
        }),
      })
    );
  });

  it('対象年度の管理料Billingが既にあれば冪等スキップ', async () => {
    const { prisma, billingCreate } = buildPrisma([buildContract({ billings: [{ id: 'b0' }] })]);
    const r = await generateManagementFeeBillings(prisma, { targetYear: 2026, apply: true });

    expect(r.created).toBe(0);
    expect(r.skippedExisting).toBe(1);
    expect(billingCreate).not.toHaveBeenCalled();
  });

  it('複数年一括前納(billing_years>1)は既定でスキップする', async () => {
    const { prisma } = buildPrisma([
      buildContract({
        managementFee: { management_fee: '5000', billing_month: '3', billing_years: '10' },
      }),
    ]);
    const r = await generateManagementFeeBillings(prisma, { targetYear: 2026, apply: true });

    expect(r.created).toBe(0);
    expect(r.skippedPrepaid).toBe(1);
  });

  it('includePrepaid=true なら前納契約も対象にする', async () => {
    const { prisma } = buildPrisma([
      buildContract({
        managementFee: { management_fee: '5000', billing_month: '3', billing_years: '10' },
      }),
    ]);
    const r = await generateManagementFeeBillings(prisma, {
      targetYear: 2026,
      apply: true,
      includePrepaid: true,
    });

    expect(r.created).toBe(1);
    expect(r.skippedPrepaid).toBe(0);
  });

  it('金額が解釈不能ならスキップ', async () => {
    const { prisma } = buildPrisma([
      buildContract({
        managementFee: { management_fee: null, billing_month: '3', billing_years: '1' },
      }),
    ]);
    const r = await generateManagementFeeBillings(prisma, { targetYear: 2026, apply: true });

    expect(r.created).toBe(0);
    expect(r.skippedNoAmount).toBe(1);
  });

  it('請求先顧客(契約者/申込者)が無ければスキップ', async () => {
    const { prisma } = buildPrisma([buildContract({ saleContractRoles: [] })]);
    const r = await generateManagementFeeBillings(prisma, { targetYear: 2026, apply: true });

    expect(r.created).toBe(0);
    expect(r.skippedNoCustomer).toBe(1);
  });

  it('dry-run(apply=false)では作成せず件数のみ算出', async () => {
    const { prisma, billingCreate } = buildPrisma([buildContract()]);
    const r = await generateManagementFeeBillings(prisma, { targetYear: 2026, apply: false });

    expect(r.created).toBe(1);
    expect(billingCreate).not.toHaveBeenCalled();
  });

  it('契約者が無くても申込者を請求先に使う', async () => {
    const { prisma, billingCreate } = buildPrisma([
      buildContract({ saleContractRoles: [{ role: 'applicant', customer_id: 'c-app' }] }),
    ]);
    const r = await generateManagementFeeBillings(prisma, { targetYear: 2026, apply: true });

    expect(r.created).toBe(1);
    expect(billingCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ customer_id: 'c-app' }) })
    );
  });
});
