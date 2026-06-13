import {
  isValidYuchoSymbol,
  branchCodeFromSymbol,
  depositTypeFromSymbol,
  accountNumberFromYuchoNumber,
  formatSymbolNumber,
} from '../../src/yucho/yuchoAccount';

describe('yuchoAccount 記号番号変換 (#170)', () => {
  describe('branchCodeFromSymbol (方式A: 記号=1+店番3桁+種目1桁)', () => {
    it('記号の中央3桁を店番として返す', () => {
      expect(branchCodeFromSymbol('11280')).toBe('128');
      expect(branchCodeFromSymbol('10080')).toBe('008');
    });
    it('5桁でない/先頭1でない記号は null（呼び出し側で支店名推定にフォールバック）', () => {
      expect(branchCodeFromSymbol('1128')).toBeNull();
      expect(branchCodeFromSymbol('21280')).toBeNull();
      expect(branchCodeFromSymbol(null)).toBeNull();
      expect(branchCodeFromSymbol('')).toBeNull();
    });
  });

  describe('isValidYuchoSymbol', () => {
    it('5桁・先頭1のみ妥当', () => {
      expect(isValidYuchoSymbol('11280')).toBe(true);
      expect(isValidYuchoSymbol('21280')).toBe(false);
      expect(isValidYuchoSymbol('1128')).toBe(false);
      expect(isValidYuchoSymbol(null)).toBe(false);
    });
  });

  describe('depositTypeFromSymbol', () => {
    it('記号末尾1桁を返す', () => {
      expect(depositTypeFromSymbol('11280')).toBe('0');
      expect(depositTypeFromSymbol('11281')).toBe('1');
    });
    it('妥当でない記号は null', () => {
      expect(depositTypeFromSymbol('abc')).toBeNull();
    });
  });

  describe('accountNumberFromYuchoNumber', () => {
    it('数字のみ抽出。空は null', () => {
      expect(accountNumberFromYuchoNumber('1234567')).toBe('1234567');
      expect(accountNumberFromYuchoNumber('12-345')).toBe('12345');
      expect(accountNumberFromYuchoNumber('')).toBeNull();
      expect(accountNumberFromYuchoNumber(null)).toBeNull();
    });

    it('8桁・末尾チェックデジット1は末尾を落として振替用7桁に正規化（#392）', () => {
      // 印字8桁 '12345671' → 振替用 '1234567'（先頭桁欠落させない）
      expect(accountNumberFromYuchoNumber('12345671')).toBe('1234567');
      // ハイフン等を含む8桁印字も正規化される
      expect(accountNumberFromYuchoNumber('1234567-1')).toBe('1234567');
    });

    it('8桁で末尾≠1 / 9桁以上は振替用として解釈できず null（CSV から静かに壊れない・#392）', () => {
      expect(accountNumberFromYuchoNumber('12345678')).toBeNull();
      expect(accountNumberFromYuchoNumber('123456789')).toBeNull();
    });
  });

  describe('formatSymbolNumber', () => {
    it('記号-番号 形式。どちらか欠ければ null', () => {
      expect(formatSymbolNumber('11280', '1234567')).toBe('11280-1234567');
      expect(formatSymbolNumber('11280', null)).toBeNull();
      expect(formatSymbolNumber(null, '1234567')).toBeNull();
    });
  });
});
