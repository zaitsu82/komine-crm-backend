/**
 * dateUtils のテスト
 * - #214: @db.Date 列向けの JST 暦日 → UTC 00:00 正規化
 * - #215: 和暦変換の元号境界日判定
 */
import {
  formatDate,
  parseDate,
  todayJstAsUtcDate,
  addYearsUtc,
  toJapaneseDate,
  toJapaneseYearMonth,
} from '../../src/utils/dateUtils';

describe('dateUtils', () => {
  describe('todayJstAsUtcDate (#214)', () => {
    it('JST 早朝（UTC では前日）の時刻を JST の暦日の UTC 00:00 に正規化する', () => {
      // UTC 2026-06-04 20:00 = JST 2026-06-05 05:00
      const base = new Date('2026-06-04T20:00:00Z');
      expect(todayJstAsUtcDate(base).toISOString()).toBe('2026-06-05T00:00:00.000Z');
    });

    it('年末年始の境界（JST 元日早朝）でも年がずれない', () => {
      // UTC 2026-12-31 20:00 = JST 2027-01-01 05:00
      const base = new Date('2026-12-31T20:00:00Z');
      expect(todayJstAsUtcDate(base).toISOString()).toBe('2027-01-01T00:00:00.000Z');
    });

    it('JST 日中はそのままの暦日になる', () => {
      // UTC 2026-06-05 03:00 = JST 2026-06-05 12:00
      const base = new Date('2026-06-05T03:00:00Z');
      expect(todayJstAsUtcDate(base).toISOString()).toBe('2026-06-05T00:00:00.000Z');
    });
  });

  describe('addYearsUtc (#214)', () => {
    it('UTC 00:00 を維持したまま年を加算する', () => {
      const base = new Date('2026-06-05T00:00:00Z');
      expect(addYearsUtc(base, 33).toISOString()).toBe('2059-06-05T00:00:00.000Z');
    });

    it('うるう日は翌日へ繰り上がる（JS Date仕様）', () => {
      const base = new Date('2024-02-29T00:00:00Z');
      expect(addYearsUtc(base, 1).toISOString()).toBe('2025-03-01T00:00:00.000Z');
    });
  });

  describe('toJapaneseDate (#215 元号境界)', () => {
    it('2019年1〜4月は平成31年（令和ではない）', () => {
      expect(toJapaneseDate(new Date(2019, 2, 1))).toBe('平成31年3月1日');
      expect(toJapaneseDate(new Date(2019, 3, 30))).toBe('平成31年4月30日');
    });

    it('令和は2019年5月1日から', () => {
      expect(toJapaneseDate(new Date(2019, 4, 1))).toBe('令和元年5月1日');
      expect(toJapaneseDate(new Date(2026, 5, 5))).toBe('令和8年6月5日');
    });

    it('1989年1月初週は昭和64年（平成ではない）', () => {
      expect(toJapaneseDate(new Date(1989, 0, 7))).toBe('昭和64年1月7日');
    });

    it('平成は1989年1月8日から', () => {
      expect(toJapaneseDate(new Date(1989, 0, 8))).toBe('平成元年1月8日');
    });

    it('昭和は1926年12月25日から', () => {
      expect(toJapaneseDate(new Date(1926, 11, 25))).toBe('昭和元年12月25日');
      expect(toJapaneseDate(new Date(1926, 11, 24))).toBe('1926年12月24日'); // 大正は西暦表記
    });

    it('null/undefined は null を返す', () => {
      expect(toJapaneseDate(null)).toBeNull();
      expect(toJapaneseDate(undefined)).toBeNull();
    });
  });

  describe('toJapaneseYearMonth (#215 元号境界)', () => {
    it('2019年4月は平成31年4月', () => {
      expect(toJapaneseYearMonth(new Date(2019, 3, 15))).toBe('平成31年4月');
    });

    it('2019年5月は令和元年5月', () => {
      expect(toJapaneseYearMonth(new Date(2019, 4, 15))).toBe('令和1年5月');
    });

    it('昭和の年月も変換できる（従来は分岐が欠落していた）', () => {
      expect(toJapaneseYearMonth(new Date(1980, 5, 15))).toBe('昭和55年6月');
    });
  });

  describe('formatDate / parseDate（既存動作の確認）', () => {
    it('formatDate は YYYY-MM-DD を返す', () => {
      expect(formatDate(new Date('2026-06-05T00:00:00Z'))).toBe('2026-06-05');
      expect(formatDate(null)).toBeNull();
    });

    it('parseDate は不正文字列で null を返す', () => {
      expect(parseDate('not-a-date')).toBeNull();
      expect(parseDate('2026-06-05')?.toISOString()).toBe('2026-06-05T00:00:00.000Z');
    });
  });
});
