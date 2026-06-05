import {
  buildDataRow,
  buildYuchoCsv,
  isExportableBillingItem,
  __internal,
} from '../../src/yucho/yuchoCsv';
import type { YuchoBillingItem } from '../../src/validations/yuchoValidation';

const baseItem = (overrides: Partial<YuchoBillingItem> = {}): YuchoBillingItem => ({
  category: 'management',
  sourceId: 'fee-1',
  contractPlotId: '11111111-2222-3333-4444-555555555555',
  plotNumber: 'A-1',
  areaName: '第1期',
  contractDate: '2026-01-01',
  customerId: 'cust-1',
  customerName: '山田太郎',
  customerNameKana: 'ヤマダタロウ',
  billingAmount: 12000,
  billingStatus: 'unpaid',
  scheduledDate: '2026-04-30',
  billingMonth: 4,
  billingInfo: {
    bankName: 'ゆうちょ銀行',
    branchName: '〇一八',
    accountType: 'ordinary',
    accountNumber: '1234567',
    accountHolder: 'ヤマダタロウ',
  },
  ...overrides,
});

describe('yuchoCsv internals', () => {
  describe('toHalfWidthKana', () => {
    it('converts full-width katakana to half-width', () => {
      expect(__internal.toHalfWidthKana('ヤマダタロウ')).toBe('ﾔﾏﾀﾞﾀﾛｳ');
    });
    it('converts hiragana to half-width katakana', () => {
      expect(__internal.toHalfWidthKana('やまだ')).toBe('ﾔﾏﾀﾞ');
    });
    it('converts full-width digits/letters to half-width', () => {
      expect(__internal.toHalfWidthKana('ＡＢＣ１２３')).toBe('ABC123');
    });
    it('keeps ASCII unchanged', () => {
      expect(__internal.toHalfWidthKana('ABC 123')).toBe('ABC 123');
    });
    it('returns empty string for empty input', () => {
      expect(__internal.toHalfWidthKana('')).toBe('');
    });
  });

  describe('padRight / padLeftZero', () => {
    it('right-pads to width with spaces', () => {
      expect(__internal.padRight('AB', 5)).toBe('AB   ');
    });
    it('truncates if too long', () => {
      expect(__internal.padRight('ABCDEFG', 4)).toBe('ABCD');
    });
    it('zero-pads number to width', () => {
      expect(__internal.padLeftZero(123, 6)).toBe('000123');
    });
    it('strips non-digits before padding', () => {
      expect(__internal.padLeftZero('12,345', 6)).toBe('012345');
    });
    it('truncates to lower digits when too long', () => {
      expect(__internal.padLeftZero(1234567890, 6)).toBe('567890');
    });
  });

  describe('accountTypeCode', () => {
    it.each([
      ['ordinary', '1'],
      ['current', '2'],
      ['savings', '4'],
      [null, '1'],
      ['unknown', '1'],
    ])('maps %s → %s', (input, expected) => {
      expect(__internal.accountTypeCode(input as string | null)).toBe(expected);
    });
  });

  describe('extractBranchCode', () => {
    it('extracts ASCII branch code', () => {
      expect(__internal.extractBranchCode('018店')).toBe('018');
    });
    it('extracts kanji branch code', () => {
      expect(__internal.extractBranchCode('〇一八')).toBe('018');
    });
    it('returns 000 when no digits found', () => {
      expect(__internal.extractBranchCode('本店')).toBe('000');
    });
  });
});

describe('buildDataRow', () => {
  it('starts with empty column (comma-led row)', () => {
    const row = buildDataRow(baseItem());
    expect(row.startsWith(',')).toBe(true);
  });

  it('produces exactly 12 comma-separated columns', () => {
    const row = buildDataRow(baseItem());
    // 口座名義列にカンマは含まれない想定 (半角カナ+空白) なので単純に split で良い
    expect(row.split(',')).toHaveLength(12);
  });

  it('uses fixed bank values (9900 / ﾕｳﾁﾖ padded to 15 / ゆうちょ銀行)', () => {
    const cells = buildDataRow(baseItem()).split(',');
    expect(cells[1]).toBe('9900');
    expect(cells[2]).toBe('ﾕｳﾁﾖ           '); // 15桁
    expect(cells[2]).toHaveLength(15);
    expect(cells[3]).toBe('ゆうちょ銀行');
  });

  it('emits 3-digit branch code derived from branch name', () => {
    const cells = buildDataRow(baseItem()).split(',');
    expect(cells[4]).toBe('018'); // 〇一八 → 018
  });

  it('uses fixed deposit type code 1 (ordinary) by default', () => {
    const cells = buildDataRow(baseItem()).split(',');
    expect(cells[7]).toBe('1');
  });

  it('zero-pads account number to 7 digits', () => {
    const item = baseItem({
      billingInfo: { ...baseItem().billingInfo!, accountNumber: '12345' },
    });
    const cells = buildDataRow(item).split(',');
    expect(cells[8]).toBe('0012345');
  });

  it('wraps account holder in double quotes and pads to 30 half-width chars', () => {
    const cells = buildDataRow(baseItem()).split(',');
    const holder = cells[9]!;
    expect(holder.startsWith('"')).toBe(true);
    expect(holder.endsWith('"')).toBe(true);
    const inner = holder.slice(1, -1);
    expect(inner).toHaveLength(30);
    expect(inner.startsWith('ﾔﾏﾀﾞﾀﾛｳ')).toBe(true);
    expect(inner.trimEnd()).toBe('ﾔﾏﾀﾞﾀﾛｳ');
  });

  it('falls back to customerNameKana when accountHolder is missing', () => {
    const item = baseItem({
      billingInfo: { ...baseItem().billingInfo!, accountHolder: null },
      customerNameKana: 'サトウハナコ',
    });
    const cells = buildDataRow(item).split(',');
    const inner = cells[9]!.slice(1, -1);
    expect(inner).toHaveLength(30);
    expect(inner.trimEnd()).toBe('ｻﾄｳﾊﾅｺ');
  });

  it('outputs billing amount as bare integer (no zero-padding) in column 11', () => {
    const cells = buildDataRow(baseItem({ billingAmount: 12000 })).split(',');
    expect(cells[10]).toBe('12000');
  });

  it('uses fixed flag value 1 in column 12', () => {
    const cells = buildDataRow(baseItem()).split(',');
    expect(cells[11]).toBe('1');
  });

  it('does NOT leak internal contractPlotId anywhere in the row', () => {
    const item = baseItem({ contractPlotId: 'cuid-secret-DEADBEEF' });
    const row = buildDataRow(item);
    expect(row.includes('cuid-secret-DEADBEEF')).toBe(false);
    expect(row.includes('DEADBEEF')).toBe(false);
  });

  it('keeps columns 1, 6, 7 empty (matches reference file shape)', () => {
    const cells = buildDataRow(baseItem()).split(',');
    expect(cells[0]).toBe('');
    expect(cells[5]).toBe('');
    expect(cells[6]).toBe('');
  });

  it('produces a row matching the reference file shape', () => {
    const item = baseItem({
      customerNameKana: 'セイ メイ',
      billingInfo: {
        bankName: 'ゆうちょ銀行',
        branchName: '〇七四', // → 074
        accountType: 'ordinary',
        accountNumber: '1234567',
        accountHolder: 'セイ メイ',
      },
      billingAmount: 8000,
    });
    const cells = buildDataRow(item).split(',');
    expect(cells[0]).toBe(''); //                 1: empty
    expect(cells[1]).toBe('9900'); //              2: bank code
    expect(cells[2]).toBe('ﾕｳﾁﾖ           '); //   3: bank kana (15)
    expect(cells[3]).toBe('ゆうちょ銀行'); //        4: bank kanji
    expect(cells[4]).toBe('074'); //               5: branch (〇七四 → 074)
    expect(cells[5]).toBe(''); //                  6: empty
    expect(cells[6]).toBe(''); //                  7: empty
    expect(cells[7]).toBe('1'); //                 8: deposit type
    expect(cells[8]).toBe('1234567'); //           9: account number
    expect(cells[9]!.slice(1, -1).trimEnd()).toBe('ｾｲ ﾒｲ'); // 10: holder
    expect(cells[10]).toBe('8000'); //            11: amount
    expect(cells[11]).toBe('1'); //               12: flag
  });
});

describe('buildYuchoCsv', () => {
  it('terminates each row with CRLF', () => {
    const csv = buildYuchoCsv({ items: [baseItem()] });
    expect(csv.endsWith('\r\n')).toBe(true);
    const segments = csv.split('\r\n');
    // 1 data row + trailing empty from final CRLF
    expect(segments).toHaveLength(2);
    expect(segments[1]).toBe('');
  });

  it('emits one data row per exportable item — no header/trailer/end rows', () => {
    const items = [baseItem(), baseItem({ sourceId: 'fee-2', billingAmount: 8000 })];
    const csv = buildYuchoCsv({ items });
    const lines = csv.split('\r\n').filter((l) => l.length > 0);
    expect(lines.length).toBe(2);
    // Both lines must start with empty column (comma-led)
    for (const line of lines) {
      expect(line.startsWith(',')).toBe(true);
    }
  });

  it('skips items with no billingInfo', () => {
    const items = [baseItem(), baseItem({ sourceId: 'fee-2', billingInfo: null })];
    const csv = buildYuchoCsv({ items });
    const rows = csv.split('\r\n').filter((l) => l.length > 0);
    expect(rows.length).toBe(1);
  });

  it('skips items with zero amount', () => {
    const items = [baseItem(), baseItem({ sourceId: 'fee-2', billingAmount: 0 })];
    const csv = buildYuchoCsv({ items });
    const rows = csv.split('\r\n').filter((l) => l.length > 0);
    expect(rows.length).toBe(1);
  });

  it('returns empty string when no exportable items', () => {
    expect(buildYuchoCsv({ items: [] })).toBe('');
    expect(buildYuchoCsv({ items: [baseItem({ billingInfo: null })] })).toBe('');
  });
});

describe('isExportableBillingItem', () => {
  it('is true when billingInfo present and amount > 0', () => {
    expect(isExportableBillingItem(baseItem())).toBe(true);
  });
  it('is false when billingInfo is null', () => {
    expect(isExportableBillingItem(baseItem({ billingInfo: null }))).toBe(false);
  });
  it('is false when amount is 0', () => {
    expect(isExportableBillingItem(baseItem({ billingAmount: 0 }))).toBe(false);
  });

  describe('口座番号欠損の除外（#266）', () => {
    it('銀行名だけあり口座番号が null なら出力対象外（全0の不正振替行を防ぐ）', () => {
      const item = baseItem({
        billingInfo: { ...baseItem().billingInfo!, accountNumber: null, branchName: null },
      });
      expect(isExportableBillingItem(item)).toBe(false);
    });

    it('口座番号が空文字なら出力対象外', () => {
      const item = baseItem({
        billingInfo: { ...baseItem().billingInfo!, accountNumber: '' },
      });
      expect(isExportableBillingItem(item)).toBe(false);
    });

    it('口座番号が全0（実在しない値）なら出力対象外', () => {
      const item = baseItem({
        billingInfo: { ...baseItem().billingInfo!, accountNumber: '0000000' },
      });
      expect(isExportableBillingItem(item)).toBe(false);
    });

    it('口座番号が数字を含まない（記号のみ）なら出力対象外', () => {
      const item = baseItem({
        billingInfo: { ...baseItem().billingInfo!, accountNumber: '---' },
      });
      expect(isExportableBillingItem(item)).toBe(false);
    });

    it('ハイフン区切りの正常な口座番号は出力対象', () => {
      const item = baseItem({
        billingInfo: { ...baseItem().billingInfo!, accountNumber: '123-4567' },
      });
      expect(isExportableBillingItem(item)).toBe(true);
    });
  });
});

describe('口座名義の二重引用符エスケープ（#273）', () => {
  /** RFC4180 準拠の最小 CSV 行パーサ（囲みフィールド内の "" と , を解釈） */
  const splitRfc4180 = (line: string): string[] => {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        out.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out;
  };

  it('名義に半角 " が含まれても囲みフィールドが破損しない（RFC4180 "" 二重化）', () => {
    const item = baseItem({
      billingInfo: { ...baseItem().billingInfo!, accountHolder: 'ヤマ"ダ"タロウ' },
    });
    const row = buildDataRow(item);
    // 列10 は "..." 囲みのまま、内部の " は "" に二重化される
    expect(row).toContain('"ﾔﾏ""ﾀﾞ""ﾀﾛｳ');
    // RFC4180 パーサで読んだとき列数が 12 のままで、名義が正しく復元されること
    const fields = splitRfc4180(row);
    expect(fields.length).toBe(12);
    expect(fields[9]).toContain('ﾔﾏ"ﾀﾞ"ﾀﾛｳ');
    // 後続フィールド（引落金額・フラグ）が列ズレしていないこと
    expect(fields[10]).toBe('12000');
  });

  it('名義に " が無い場合は従来どおり', () => {
    const cells = buildDataRow(baseItem()).split(',');
    expect(cells[9]?.startsWith('"')).toBe(true);
    expect(cells[9]?.includes('""')).toBe(false);
  });
});
