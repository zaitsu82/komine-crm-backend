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

  describe('正当な超過の許容（#265/#267）', () => {
    it('allowGrowth ならベースライン超過でも ❌ にしない（マスタの手動追加等）', () => {
      // RelationshipMaster: baseline=35 に admin がアプリから追加して 50 件
      expect(judgeCount(50, null, 35, { allowGrowth: true })).toBe('✅');
      // 2倍超でも growth テーブルは ❌ にしない
      expect(judgeCount(80, null, 35, { allowGrowth: true })).toBe('✅');
    });

    it('allowGrowth でも下限チェック（未投入/大幅不足）は維持する', () => {
      expect(judgeCount(0, null, 35, { allowGrowth: true })).toBe('❌');
      expect(judgeCount(10, null, 35, { allowGrowth: true })).toBe('❌');
    });

    it('allowGrowth 未指定の従来呼び出しは上振れ ❌ のまま（#223 の回帰防止）', () => {
      expect(judgeCount(80, null, 35)).toBe('❌');
    });

    it('Customer: 契約者のみに絞った actual が legacy=baseline と一致すれば ✅（#265 の回帰防止）', () => {
      // 修正前: actual=4587(申込者展開込) > 3487*1.05 で必発 ❌ だった。
      // 修正後は legacy_danka_cd 有のみを数えるため 3487 で比較される。
      expect(judgeCount(3487, 3487, 3487)).toBe('✅');
    });

    it('Customer: 契約者のみ集計でも重複投入（約2倍）は ❌ を維持', () => {
      expect(judgeCount(6974, 3487, 3487)).toBe('❌');
    });

    it('Staff: 移行由来のみに絞った actual=11 はベースライン一致で ✅（#267 の回帰防止）', () => {
      // 修正前: bootstrap admin を含む actual>=12 > 11*1.05 で必発 ❌ だった
      expect(judgeCount(11, null, 11)).toBe('✅');
    });
  });

  describe('終了顧客の別掲（#314）', () => {
    // 修正前: 契約者カウントが is_terminated を区別せず actual≈3637(=3487+150) となり、
    // del_flg=0 ベースのレガシー参照値 3487 と粒度不一致のまま 105% 上限ギリギリで
    // たまたま ✅ だった（終了顧客が 5% を超えると誤 ❌）。
    // 修正後: 契約者行は is_terminated:false で 3487、終了顧客は別行で del_flg=2 と突き合わせる。
    it('終了顧客行: レガシー del_flg=2 件数と一致すれば ✅', () => {
      expect(judgeCount(150, 150, null)).toBe('✅');
    });

    it('終了顧客行: 取込漏れ（0件）は ❌', () => {
      expect(judgeCount(0, 150, null)).toBe('❌');
    });

    it('終了顧客行: レガシー接続なしでは ⚠️（確定ベースライン未取得のため）', () => {
      expect(judgeCount(150, null, null)).toBe('⚠️');
    });
  });
});
