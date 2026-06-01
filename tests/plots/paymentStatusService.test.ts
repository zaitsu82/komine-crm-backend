import {
  paymentStatusFromTotals,
  uncollectedFromTotals,
  deriveContractPlotPayment,
  deriveContractPlotPaymentStatus,
  recalculateContractPlotPaymentStatus,
} from '../../src/plots/services/paymentStatusService';

describe('paymentStatusFromTotals', () => {
  it('returns "paid" when paid amount equals or exceeds billed amount (amount > 0)', () => {
    expect(paymentStatusFromTotals(10000, 10000)).toBe('paid');
    expect(paymentStatusFromTotals(10000, 12000)).toBe('paid');
  });

  it('returns "partial_paid" when 0 < paid < amount', () => {
    expect(paymentStatusFromTotals(10000, 1)).toBe('partial_paid');
    expect(paymentStatusFromTotals(10000, 9999)).toBe('partial_paid');
  });

  it('returns "unpaid" when no payment is made', () => {
    expect(paymentStatusFromTotals(10000, 0)).toBe('unpaid');
  });

  it('does not auto-assign "paid" when amount is 0 (no obligation, no payment)', () => {
    // 請求額 0 円・入金 0 円 → unpaid（amount > 0 を paid 条件にしているため）
    expect(paymentStatusFromTotals(0, 0)).toBe('unpaid');
  });

  it('treats a payment with no obligation (amount 0, paid > 0) as partial_paid', () => {
    expect(paymentStatusFromTotals(0, 5000)).toBe('partial_paid');
  });

  it('preserves manually-set "overdue" when there is no payment (#162: overdue は自動判定しない)', () => {
    expect(paymentStatusFromTotals(10000, 0, 'overdue')).toBe('overdue');
  });

  it('transitions "overdue" → "paid"/"partial_paid" once a payment lands', () => {
    expect(paymentStatusFromTotals(10000, 10000, 'overdue')).toBe('paid');
    expect(paymentStatusFromTotals(10000, 3000, 'overdue')).toBe('partial_paid');
  });

  it('preserves manually-set "refunded" regardless of totals', () => {
    expect(paymentStatusFromTotals(10000, 10000, 'refunded')).toBe('refunded');
    expect(paymentStatusFromTotals(10000, 0, 'refunded')).toBe('refunded');
  });
});

describe('deriveContractPlotPaymentStatus', () => {
  it('sums amount and paid across billings', () => {
    expect(
      deriveContractPlotPaymentStatus([
        { amount: 10000, paid_amount: 10000, terminated: false },
        { amount: 5000, paid_amount: 0, terminated: false },
      ])
    ).toBe('partial_paid');
  });

  it('returns "paid" when every active billing is fully covered', () => {
    expect(
      deriveContractPlotPaymentStatus([
        { amount: 10000, paid_amount: 10000, terminated: false },
        { amount: 5000, paid_amount: 5000, terminated: false },
      ])
    ).toBe('paid');
  });

  it('excludes terminated billings from the obligation (paid-then-terminated stays "paid")', () => {
    // 解約済み未払い請求は債務消滅扱い → 残りの全額入金済み請求のみで判定
    expect(
      deriveContractPlotPaymentStatus([
        { amount: 10000, paid_amount: 10000, terminated: false },
        { amount: 99999, paid_amount: 0, terminated: true },
      ])
    ).toBe('paid');
  });

  it('returns "unpaid" when there are no active billings', () => {
    expect(
      deriveContractPlotPaymentStatus([{ amount: 99999, paid_amount: 0, terminated: true }])
    ).toBe('unpaid');
    expect(deriveContractPlotPaymentStatus([])).toBe('unpaid');
  });
});

describe('uncollectedFromTotals', () => {
  it('returns billed minus paid', () => {
    expect(uncollectedFromTotals(10000, 3000, 'partial_paid')).toBe(7000);
    expect(uncollectedFromTotals(10000, 0, 'unpaid')).toBe(10000);
  });

  it('returns 0 when fully paid', () => {
    expect(uncollectedFromTotals(10000, 10000, 'paid')).toBe(0);
  });

  it('clamps to 0 on overpayment (never negative)', () => {
    expect(uncollectedFromTotals(10000, 12000, 'paid')).toBe(0);
  });

  it('returns the remaining debt for overdue', () => {
    expect(uncollectedFromTotals(10000, 0, 'overdue')).toBe(10000);
  });

  it('returns 0 for refunded regardless of totals (#170: 債権消滅)', () => {
    expect(uncollectedFromTotals(10000, 0, 'refunded')).toBe(0);
    expect(uncollectedFromTotals(10000, 3000, 'refunded')).toBe(0);
  });
});

describe('deriveContractPlotPayment', () => {
  it('derives status and uncollected from the same aggregation', () => {
    expect(
      deriveContractPlotPayment([
        { amount: 10000, paid_amount: 10000, terminated: false },
        { amount: 5000, paid_amount: 0, terminated: false },
      ])
    ).toEqual({ status: 'partial_paid', uncollectedAmount: 5000 });
  });

  it('excludes terminated billings from both status and uncollected', () => {
    expect(
      deriveContractPlotPayment([
        { amount: 10000, paid_amount: 10000, terminated: false },
        { amount: 99999, paid_amount: 0, terminated: true },
      ])
    ).toEqual({ status: 'paid', uncollectedAmount: 0 });
  });

  it('reports the full billed amount as uncollected when nothing is paid (#170 主因)', () => {
    expect(
      deriveContractPlotPayment([{ amount: 162000, paid_amount: 0, terminated: false }])
    ).toEqual({ status: 'unpaid', uncollectedAmount: 162000 });
  });

  it('returns unpaid / 0 when there are no active billings', () => {
    expect(deriveContractPlotPayment([])).toEqual({ status: 'unpaid', uncollectedAmount: 0 });
  });

  it('zeroes uncollected for refunded (currentStatus preserved)', () => {
    expect(
      deriveContractPlotPayment([{ amount: 10000, paid_amount: 0, terminated: false }], 'refunded')
    ).toEqual({ status: 'refunded', uncollectedAmount: 0 });
  });
});

describe('recalculateContractPlotPaymentStatus', () => {
  let contractPlotFindFirst: jest.Mock;
  let contractPlotUpdate: jest.Mock;
  let billingFindMany: jest.Mock;

  const buildClient = () => {
    contractPlotFindFirst = jest.fn();
    contractPlotUpdate = jest.fn();
    billingFindMany = jest.fn();
    return {
      contractPlot: { findFirst: contractPlotFindFirst, update: contractPlotUpdate },
      billing: { findMany: billingFindMany },
    } as unknown as Parameters<typeof recalculateContractPlotPaymentStatus>[0];
  };

  it('updates payment_status from the aggregated billings and returns it', async () => {
    const client = buildClient();
    contractPlotFindFirst.mockResolvedValue({ payment_status: 'unpaid' });
    billingFindMany.mockResolvedValue([
      { amount: 10000, paid_amount: 10000, terminated: false },
      { amount: 5000, paid_amount: 5000, terminated: false },
    ]);

    const result = await recalculateContractPlotPaymentStatus(client, 'cp1');

    expect(result).toBe('paid');
    expect(contractPlotUpdate).toHaveBeenCalledWith({
      where: { id: 'cp1' },
      data: { payment_status: 'paid', uncollected_amount: 0 },
    });
  });

  it('passes the current status through so manual overdue/refunded is preserved', async () => {
    const client = buildClient();
    contractPlotFindFirst.mockResolvedValue({ payment_status: 'overdue' });
    billingFindMany.mockResolvedValue([{ amount: 10000, paid_amount: 0, terminated: false }]);

    const result = await recalculateContractPlotPaymentStatus(client, 'cp1');

    expect(result).toBe('overdue');
    expect(contractPlotUpdate).toHaveBeenCalledWith({
      where: { id: 'cp1' },
      data: { payment_status: 'overdue', uncollected_amount: 10000 },
    });
  });

  it('returns null and skips update when the contract plot is not found', async () => {
    const client = buildClient();
    contractPlotFindFirst.mockResolvedValue(null);

    const result = await recalculateContractPlotPaymentStatus(client, 'missing');

    expect(result).toBeNull();
    expect(billingFindMany).not.toHaveBeenCalled();
    expect(contractPlotUpdate).not.toHaveBeenCalled();
  });
});
