import { resolvePaymentFeeTypeLabel } from '../../src/payments/feeTypeLabels';

describe('resolvePaymentFeeTypeLabel (#334)', () => {
  it('legacy-fee-20230001 を「使用料」に解決する', () => {
    expect(resolvePaymentFeeTypeLabel('legacy-fee-20230001')).toBe('使用料');
  });

  it('legacy-fee-20230002 を「管理料」に解決する', () => {
    expect(resolvePaymentFeeTypeLabel('legacy-fee-20230002')).toBe('管理料');
  });

  it('既知センチネル以外（新規入金値）はそのまま返す', () => {
    expect(resolvePaymentFeeTypeLabel('管理料')).toBe('管理料');
    expect(resolvePaymentFeeTypeLabel('使用料')).toBe('使用料');
    expect(resolvePaymentFeeTypeLabel('その他')).toBe('その他');
  });

  it('null / undefined は null を返す', () => {
    expect(resolvePaymentFeeTypeLabel(null)).toBeNull();
    expect(resolvePaymentFeeTypeLabel(undefined)).toBeNull();
  });
});
