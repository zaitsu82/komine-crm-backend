/**
 * dateUtils のテスト
 * - #214: @db.Date 列向けの JST 暦日 → UTC 00:00 正規化
 */
import { todayJstAsUtcDate, addYearsUtc } from '../../src/utils/dateUtils';

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
});
