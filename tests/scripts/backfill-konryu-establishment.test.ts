/**
 * 回帰テスト: backfill-konryu-establishment の捏造防止ガード（#390）
 *
 * 新移行コード（PR#342 以降の step05）適用済み DB では permit_date=start_date=contract_date
 * となり establishment は GravestoneInfo に正しく入る。この状態で本スクリプトを実行すると、
 * 旧版なら全契約日有り行が候補に入り contract_date を establishment へ捏造していた。
 * isPass1Target で「permit=start=contract_date」の新マッピング済み行を除外することを検証する。
 */
import { isPass1Target, sameDate } from '../../scripts/backfill-konryu-establishment';

const d = (s: string): Date => new Date(s);

describe('sameDate', () => {
  it('同一日付は true', () => {
    expect(sameDate(d('2019-04-01'), d('2019-04-01'))).toBe(true);
  });
  it('異なる日付は false', () => {
    expect(sameDate(d('2019-04-01'), d('2020-01-01'))).toBe(false);
  });
  it('両方 null は true / 片方 null は false', () => {
    expect(sameDate(null, null)).toBe(true);
    expect(sameDate(d('2019-04-01'), null)).toBe(false);
    expect(sameDate(null, d('2019-04-01'))).toBe(false);
  });
});

describe('isPass1Target (#390 捏造防止)', () => {
  it('新マッピング済み（permit=start=contract_date）の行は除外する', () => {
    // 新移行コード適用済み・konryu 無し（establishment 未投入）。
    // 旧版ガードでは establishment が null のため通過し contract_date を捏造していた。
    expect(
      isPass1Target({
        permit_date: d('2019-04-01'),
        start_date: d('2019-04-01'),
        contract_date: d('2019-04-01'),
        gravestoneInfo: null,
      })
    ).toBe(false);
  });

  it('新マッピング済みで establishment が既に入っている行も除外する', () => {
    expect(
      isPass1Target({
        permit_date: d('2019-04-01'),
        start_date: d('2019-04-01'),
        contract_date: d('2019-04-01'),
        gravestoneInfo: {
          establishment_deadline: d('2020-01-01'),
          establishment_date: d('2020-02-01'),
        },
      })
    ).toBe(false);
  });

  it('旧誤投入行（permit に konryu 値が入り contract_date と不一致・establishment 未投入）は対象', () => {
    expect(
      isPass1Target({
        permit_date: d('2020-01-01'), // konryu_kigen が誤投入された値
        start_date: d('2020-02-01'), // konryu_date が誤投入された値
        contract_date: d('2019-04-01'),
        gravestoneInfo: null,
      })
    ).toBe(true);
  });

  it('permit のみ contract_date と不一致でも対象（start は一致でも片方ずれていれば旧誤投入の疑い）', () => {
    expect(
      isPass1Target({
        permit_date: d('2020-01-01'),
        start_date: d('2019-04-01'),
        contract_date: d('2019-04-01'),
        gravestoneInfo: null,
      })
    ).toBe(true);
  });

  it('establishment が既に埋まっている誤投入行は二重処理しない（除外）', () => {
    expect(
      isPass1Target({
        permit_date: d('2020-01-01'),
        start_date: d('2020-02-01'),
        contract_date: d('2019-04-01'),
        gravestoneInfo: {
          establishment_deadline: d('2020-01-01'),
          establishment_date: null,
        },
      })
    ).toBe(false);
  });
});
