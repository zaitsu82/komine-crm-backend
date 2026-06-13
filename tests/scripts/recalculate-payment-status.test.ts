import { BillingCategory, PaymentStatus } from '@prisma/client';

import { buildRecalcPlan } from '../../scripts/recalculate-payment-status';

type Plot = {
  id: string;
  payment_status: PaymentStatus;
  uncollected_amount: number;
};

type Grouped = {
  contract_plot_id: string;
  category: BillingCategory;
  _sum: { amount: number | null; paid_amount: number | null };
};

const g = (id: string, category: BillingCategory, amount: number, paid: number): Grouped => ({
  contract_plot_id: id,
  category,
  _sum: { amount, paid_amount: paid },
});

describe('buildRecalcPlan (#389)', () => {
  it('旧定義（全区分）の未収格納値を現行定義（管理料限定）へ収束させる', () => {
    // 区画 P1: 旧 backfill が「使用料未払い 50000 + 管理料完納」を全区分で未収 50000 と格納していた。
    // 現行定義（管理料限定）では管理料は完納のため未収は 0 になるべき。
    const plots: Plot[] = [
      { id: 'P1', payment_status: PaymentStatus.partial_paid, uncollected_amount: 50000 },
    ];
    const grouped: Grouped[] = [
      g('P1', BillingCategory.usage_fee, 50000, 0), // 使用料未払い
      g('P1', BillingCategory.management_fee, 10000, 10000), // 管理料完納
    ];

    const plan = buildRecalcPlan(plots, grouped);

    expect(plan.scanned).toBe(1);
    expect(plan.changed).toBe(1);
    // status は全区分で判定 → 使用料未払いがあるので partial_paid 維持、uncollected は管理料限定で 0。
    const bucket = plan.buckets.get(`${PaymentStatus.partial_paid}|0`);
    expect(bucket?.ids).toEqual(['P1']);
  });

  it('現行定義と既に一致する区画は no-op（更新対象外）', () => {
    const plots: Plot[] = [
      { id: 'P2', payment_status: PaymentStatus.unpaid, uncollected_amount: 10000 },
    ];
    const grouped: Grouped[] = [g('P2', BillingCategory.management_fee, 10000, 0)];

    const plan = buildRecalcPlan(plots, grouped);

    expect(plan.changed).toBe(0);
    expect(plan.noop).toBe(1);
    expect(plan.buckets.size).toBe(0);
  });

  it('請求の無い区画に残った旧未収格納値を 0 へ戻す', () => {
    // 請求/入金を一度も触らない区画。旧 backfill 由来で uncollected>0 が残っているケース。
    const plots: Plot[] = [
      { id: 'P3', payment_status: PaymentStatus.unpaid, uncollected_amount: 30000 },
    ];

    const plan = buildRecalcPlan(plots, []);

    expect(plan.changed).toBe(1);
    const bucket = plan.buckets.get(`${PaymentStatus.unpaid}|0`);
    expect(bucket?.ids).toEqual(['P3']);
  });

  it('管理料未払いの区画は未収を管理料額で再計算する', () => {
    const plots: Plot[] = [
      // 旧格納値が古い（5000）→ 現行で 10000 に直る。
      { id: 'P4', payment_status: PaymentStatus.unpaid, uncollected_amount: 5000 },
    ];
    const grouped: Grouped[] = [
      g('P4', BillingCategory.management_fee, 10000, 0),
      g('P4', BillingCategory.usage_fee, 80000, 80000),
    ];

    const plan = buildRecalcPlan(plots, grouped);

    expect(plan.changed).toBe(1);
    const bucket = plan.buckets.get(`${PaymentStatus.partial_paid}|10000`);
    expect(bucket?.ids).toEqual(['P4']);
  });

  it('refunded は手動設定を尊重し未収 0 のまま維持する', () => {
    const plots: Plot[] = [
      { id: 'P5', payment_status: PaymentStatus.refunded, uncollected_amount: 0 },
    ];
    const grouped: Grouped[] = [g('P5', BillingCategory.management_fee, 10000, 0)];

    const plan = buildRecalcPlan(plots, grouped);

    // refunded 維持 + uncollected 0 維持 → no-op
    expect(plan.changed).toBe(0);
    expect(plan.noop).toBe(1);
  });
});
