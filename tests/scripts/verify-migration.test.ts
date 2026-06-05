/**
 * verify-migration の件数判定テスト（#223）
 *
 * judgeCount は従来「大幅不足」しか ❌ にせず、actual >= reference*0.9 を
 * 無条件 ✅ としていたため、冪等性バグによる件数倍増（重複投入）を
 * 検出できなかった。上振れ（> max(target, reference) * 1.05）を ❌ にする。
 */
import { judgeCount } from '../../scripts/verify-migration';

describe('judgeCount (#223)', () => {
  describe('正常ケース（従来動作の維持）', () => {
    it('参照値なしは ⚠️', () => {
      expect(judgeCount(100, null, null)).toBe('⚠️');
    });

    it('完全未投入は ❌', () => {
      expect(judgeCount(0, 1000, null)).toBe('❌');
    });

    it('大幅不足（50%未満）は ❌', () => {
      expect(judgeCount(400, 1000, null)).toBe('❌');
    });

    it('ベースライン ±2% 以内は ✅', () => {
      expect(judgeCount(2641, 2744, 2641)).toBe('✅');
      expect(judgeCount(2650, 2744, 2641)).toBe('✅');
    });

    it('レガシー比 90% 以上（ベースラインなし）は ✅', () => {
      expect(judgeCount(950, 1000, null)).toBe('✅');
    });

    it('skip が少なく target を超えても legacy 件数以内なら ✅/⚠️（❌ にしない）', () => {
      // FamilyContact: target=2641 < legacy=2744。actual=2744（skip 0）は正常上限
      expect(judgeCount(2744, 2744, 2641)).not.toBe('❌');
    });
  });

  describe('上振れ検出（#223 新規）', () => {
    it('件数が約2倍（重複投入）なら ❌', () => {
      // FamilyContact 2重投入: 2641*2 = 5282 > max(2641,2744)*1.05
      expect(judgeCount(5282, 2744, 2641)).toBe('❌');
      // BuriedPerson 2重投入
      expect(judgeCount(12724, 6484, 6362)).toBe('❌');
    });

    it('レガシー件数の 105% を僅かに超えると ❌', () => {
      expect(judgeCount(1051, 1000, null)).toBe('❌');
    });

    it('105% 以内の上振れは ❌ にしない', () => {
      expect(judgeCount(1049, 1000, null)).not.toBe('❌');
    });
  });
});
