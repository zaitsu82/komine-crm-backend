/**
 * 回帰テスト: 支払方法(shiharai) の旧int値 → 新マスタ code 変換（#108）
 *
 * 業務確認（2026-06-08）で確定した対応:
 *   0 = 銀行振込(BANK_TRANSFER) / 1 = 口座振替(ACCOUNT_TRANSFER) / 2 = 永代＝支払なし(null)
 */
import { mapShiharai } from '../../../../scripts/legacy-migration/steps/05-contract-plot';

describe('mapShiharai: 旧shiharai値 → payment_method code (#108)', () => {
  it('0 は銀行振込(BANK_TRANSFER)', () => {
    expect(mapShiharai(0)).toBe('BANK_TRANSFER');
  });

  it('1 は口座振替(ACCOUNT_TRANSFER)', () => {
    expect(mapShiharai(1)).toBe('ACCOUNT_TRANSFER');
  });

  it('2 は永代＝支払なしのため null', () => {
    expect(mapShiharai(2)).toBeNull();
  });

  it('null / undefined はそのまま null', () => {
    expect(mapShiharai(null)).toBeNull();
    expect(mapShiharai(undefined)).toBeNull();
  });

  it('対応表に無い想定外値は legacy- prefix で温存する', () => {
    expect(mapShiharai(9)).toBe('legacy-shiharai-9');
  });
});
