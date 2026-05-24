/**
 * buildBillingSummary（B10: 年度別請求 status サマリ集計）のテスト
 *
 * 旧画面01 の「受付済 / 09年 / 10年 …」を一覧で 1 列に集約する際の集計ロジック。
 */

import { buildBillingSummary } from '../../../src/plots/controllers/getPlots';

describe('buildBillingSummary', () => {
  it('Billing が無い場合は hasBilling=false で全て空', () => {
    expect(buildBillingSummary([])).toEqual({
      hasBilling: false,
      latestYear: null,
      latestYearStatus: null,
      unpaidYearCount: 0,
    });
  });

  it('null / undefined も空サマリを返す', () => {
    const empty = {
      hasBilling: false,
      latestYear: null,
      latestYearStatus: null,
      unpaidYearCount: 0,
    };
    expect(buildBillingSummary(null)).toEqual(empty);
    expect(buildBillingSummary(undefined)).toEqual(empty);
  });

  it('完納済み 1 件: 最新年度 status=paid、未納 0', () => {
    expect(
      buildBillingSummary([{ use_start_year: 2023, use_end_year: 2023, status: 'paid' }])
    ).toEqual({
      hasBilling: true,
      latestYear: 2023,
      latestYearStatus: 'paid',
      unpaidYearCount: 0,
    });
  });

  it('最新年度は use_end_year ?? use_start_year の最大値で判定する', () => {
    const result = buildBillingSummary([
      { use_start_year: 2020, use_end_year: 2020, status: 'paid' },
      { use_start_year: 2022, use_end_year: 2024, status: 'billed' },
      { use_start_year: 2021, use_end_year: 2021, status: 'paid' },
    ]);
    expect(result.latestYear).toBe(2024);
    expect(result.latestYearStatus).toBe('billed');
  });

  it('未納カウントは billed / partial_paid / overdue のみ', () => {
    const result = buildBillingSummary([
      { use_start_year: 2019, use_end_year: 2019, status: 'paid' }, // 除外
      { use_start_year: 2020, use_end_year: 2020, status: 'billed' }, // ○
      { use_start_year: 2021, use_end_year: 2021, status: 'partial_paid' }, // ○
      { use_start_year: 2022, use_end_year: 2022, status: 'overdue' }, // ○
      { use_start_year: 2023, use_end_year: 2023, status: 'pending' }, // 除外（請求前）
      { use_start_year: 2024, use_end_year: 2024, status: 'terminated' }, // 除外
      { use_start_year: 2025, use_end_year: 2025, status: 'written_off' }, // 除外
    ]);
    expect(result.unpaidYearCount).toBe(3);
  });

  it('use_end_year が null なら use_start_year にフォールバックする', () => {
    const result = buildBillingSummary([
      { use_start_year: 2021, use_end_year: null, status: 'paid' },
      { use_start_year: 2023, use_end_year: null, status: 'overdue' },
    ]);
    expect(result.latestYear).toBe(2023);
    expect(result.latestYearStatus).toBe('overdue');
    expect(result.unpaidYearCount).toBe(1);
  });

  it('年度が全て null でも hasBilling=true、未納件数は集計する', () => {
    const result = buildBillingSummary([
      { use_start_year: null, use_end_year: null, status: 'billed' },
      { use_start_year: null, use_end_year: null, status: 'paid' },
    ]);
    expect(result.hasBilling).toBe(true);
    expect(result.latestYear).toBeNull();
    expect(result.latestYearStatus).toBeNull();
    expect(result.unpaidYearCount).toBe(1);
  });
});
