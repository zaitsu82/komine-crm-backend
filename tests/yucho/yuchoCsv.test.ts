import {
  buildHeaderRecord,
  buildDataRecord,
  buildTrailerRecord,
  buildEndRecord,
  buildZenginCsv,
  __internal,
} from '../../src/yucho/yuchoCsv';
import type { YuchoBillingItem } from '../../src/validations/yuchoValidation';

const RECORD_LENGTH = 120;

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

  describe('extractBankCode / extractBranchCode', () => {
    it('returns 9900 for ゆうちょ銀行', () => {
      expect(__internal.extractBankCode('ゆうちょ銀行')).toBe('9900');
    });
    it('returns 0000 for unknown banks', () => {
      expect(__internal.extractBankCode('みずほ銀行')).toBe('0000');
    });
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

describe('Zengin record builders', () => {
  it('buildHeaderRecord is exactly 120 bytes and starts with "1"', () => {
    const record = buildHeaderRecord({
      clientCode: '1234567',
      clientName: 'コミネレイエン',
      transferDate: '2026-04-27',
      bankCode: '9900',
      branchCode: '018',
      accountType: 'ordinary',
      accountNumber: '1234567',
    });
    expect(record).toHaveLength(RECORD_LENGTH);
    expect(record[0]).toBe('1');
    // 種別コード = 91, コード区分 = 0
    expect(record.slice(1, 4)).toBe('910');
    // 委託者コードはゼロ埋め10桁
    expect(record.slice(4, 14)).toBe('0001234567');
    // 引落日 (MMDD)
    expect(record.slice(54, 58)).toBe('0427');
  });

  it('buildDataRecord is exactly 120 bytes and starts with "2"', () => {
    const record = buildDataRecord(baseItem());
    expect(record).toHaveLength(RECORD_LENGTH);
    expect(record[0]).toBe('2');
    // 銀行コード(4) + 銀行名(15) + 支店コード(3)
    expect(record.slice(1, 5)).toBe('9900');
    expect(record.slice(20, 23)).toBe('018');
  });

  it('buildTrailerRecord starts with "8" and contains zero-padded count/amount', () => {
    const record = buildTrailerRecord(3, 36000);
    expect(record).toHaveLength(RECORD_LENGTH);
    expect(record[0]).toBe('8');
    expect(record.slice(1, 7)).toBe('000003');
    expect(record.slice(7, 19)).toBe('000000036000');
  });

  it('buildEndRecord starts with "9" and is 120 bytes', () => {
    const record = buildEndRecord();
    expect(record).toHaveLength(RECORD_LENGTH);
    expect(record[0]).toBe('9');
  });
});

describe('buildZenginCsv', () => {
  const header = {
    clientCode: '1234567',
    clientName: 'コミネレイエン',
    transferDate: '2026-04-27',
    bankCode: '9900',
    branchCode: '018',
  };

  it('terminates each record with CRLF', () => {
    const items = [baseItem()];
    const csv = buildZenginCsv({ header, items });
    expect(csv.endsWith('\r\n')).toBe(true);
    const segments = csv.split('\r\n');
    // 4 records (header, data, trailer, end) + trailing empty from final CRLF
    expect(segments).toHaveLength(5);
    expect(segments[segments.length - 1]).toBe('');
  });

  it('produces 5 lines for 2 items (header + 2 data + trailer + end)', () => {
    const items = [baseItem(), baseItem({ sourceId: 'fee-2', billingAmount: 8000 })];
    const csv = buildZenginCsv({ header, items });
    const lines = csv.split('\r\n').filter((l) => l.length > 0);
    expect(lines.length).toBe(5);
    expect(lines[0]?.[0]).toBe('1');
    expect(lines[1]?.[0]).toBe('2');
    expect(lines[2]?.[0]).toBe('2');
    expect(lines[3]?.[0]).toBe('8');
    expect(lines[4]?.[0]).toBe('9');
  });

  it('skips items with no billingInfo', () => {
    const items = [baseItem(), baseItem({ sourceId: 'fee-2', billingInfo: null })];
    const csv = buildZenginCsv({ header, items });
    const dataLines = csv.split('\r\n').filter((l) => l.startsWith('2'));
    expect(dataLines.length).toBe(1);
  });

  it('skips items with zero amount', () => {
    const items = [baseItem(), baseItem({ sourceId: 'fee-2', billingAmount: 0 })];
    const csv = buildZenginCsv({ header, items });
    const dataLines = csv.split('\r\n').filter((l) => l.startsWith('2'));
    expect(dataLines.length).toBe(1);
  });

  it('trailer total amount equals sum of billable items', () => {
    const items = [
      baseItem({ billingAmount: 12000 }),
      baseItem({ sourceId: 'fee-2', billingAmount: 8000 }),
      baseItem({ sourceId: 'fee-3', billingAmount: 5000 }),
    ];
    const csv = buildZenginCsv({ header, items });
    const trailer = csv.split('\r\n').find((l) => l.startsWith('8'));
    expect(trailer?.slice(1, 7)).toBe('000003');
    expect(trailer?.slice(7, 19)).toBe('000000025000');
  });

  it('outputs only header + trailer + end when no items provided', () => {
    const csv = buildZenginCsv({ header, items: [] });
    const lines = csv.split('\r\n').filter((l) => l.length > 0);
    expect(lines.length).toBe(3); // header + trailer + end
    expect(lines[1]?.slice(1, 7)).toBe('000000'); // count = 0
  });
});
