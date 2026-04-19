/**
 * 全銀協 預金口座振替フォーマット CSV ビルダー
 *
 * 1レコード120バイト固定長を CRLF で連結したテキストを生成する。
 * 半角カナへの正規化と、固定幅へのパディング/切詰めを行う。
 *
 * レコード構成:
 *   1: ヘッダー    — 委託者情報・引落日・委託者口座
 *   2: データ      — 顧客口座・引落金額（顧客毎）
 *   8: トレーラー  — 合計件数・合計金額
 *   9: エンド      — レコード終端
 */

import type { YuchoBillingItem } from '../validations/yuchoValidation';

const RECORD_LENGTH = 120;
const LINE_SEP = '\r\n';

/**
 * 預金種目コード変換（Prisma enum → Zengin code）
 *   ordinary (普通)  → 1
 *   current  (当座)  → 2
 *   savings  (貯蓄)  → 4
 *   未設定          → 1 (普通扱い)
 */
const accountTypeCode = (type: string | null | undefined): string => {
  switch (type) {
    case 'current':
      return '2';
    case 'savings':
      return '4';
    case 'ordinary':
    default:
      return '1';
  }
};

/**
 * 全角カナ・ひらがなを半角カナに変換する簡易コンバーター。
 * 全銀フォーマットは半角カナを要求するため。
 */
const KANA_MAP: Record<string, string> = {
  ガ: 'ｶﾞ',
  ギ: 'ｷﾞ',
  グ: 'ｸﾞ',
  ゲ: 'ｹﾞ',
  ゴ: 'ｺﾞ',
  ザ: 'ｻﾞ',
  ジ: 'ｼﾞ',
  ズ: 'ｽﾞ',
  ゼ: 'ｾﾞ',
  ゾ: 'ｿﾞ',
  ダ: 'ﾀﾞ',
  ヂ: 'ﾁﾞ',
  ヅ: 'ﾂﾞ',
  デ: 'ﾃﾞ',
  ド: 'ﾄﾞ',
  バ: 'ﾊﾞ',
  ビ: 'ﾋﾞ',
  ブ: 'ﾌﾞ',
  ベ: 'ﾍﾞ',
  ボ: 'ﾎﾞ',
  パ: 'ﾊﾟ',
  ピ: 'ﾋﾟ',
  プ: 'ﾌﾟ',
  ペ: 'ﾍﾟ',
  ポ: 'ﾎﾟ',
  ヴ: 'ｳﾞ',
  ア: 'ｱ',
  イ: 'ｲ',
  ウ: 'ｳ',
  エ: 'ｴ',
  オ: 'ｵ',
  カ: 'ｶ',
  キ: 'ｷ',
  ク: 'ｸ',
  ケ: 'ｹ',
  コ: 'ｺ',
  サ: 'ｻ',
  シ: 'ｼ',
  ス: 'ｽ',
  セ: 'ｾ',
  ソ: 'ｿ',
  タ: 'ﾀ',
  チ: 'ﾁ',
  ツ: 'ﾂ',
  テ: 'ﾃ',
  ト: 'ﾄ',
  ナ: 'ﾅ',
  ニ: 'ﾆ',
  ヌ: 'ﾇ',
  ネ: 'ﾈ',
  ノ: 'ﾉ',
  ハ: 'ﾊ',
  ヒ: 'ﾋ',
  フ: 'ﾌ',
  ヘ: 'ﾍ',
  ホ: 'ﾎ',
  マ: 'ﾏ',
  ミ: 'ﾐ',
  ム: 'ﾑ',
  メ: 'ﾒ',
  モ: 'ﾓ',
  ヤ: 'ﾔ',
  ユ: 'ﾕ',
  ヨ: 'ﾖ',
  ラ: 'ﾗ',
  リ: 'ﾘ',
  ル: 'ﾙ',
  レ: 'ﾚ',
  ロ: 'ﾛ',
  ワ: 'ﾜ',
  ヲ: 'ｦ',
  ン: 'ﾝ',
  ァ: 'ｧ',
  ィ: 'ｨ',
  ゥ: 'ｩ',
  ェ: 'ｪ',
  ォ: 'ｫ',
  ッ: 'ｯ',
  ャ: 'ｬ',
  ュ: 'ｭ',
  ョ: 'ｮ',
  '。': '｡',
  '、': '､',
  '「': '｢',
  '」': '｣',
  '・': '･',
  ー: 'ｰ',
  '　': ' ',
};

const HIRAGANA_OFFSET = 'ア'.charCodeAt(0) - 'あ'.charCodeAt(0);

const toHalfWidthKana = (input: string): string => {
  if (!input) return '';
  let result = '';
  for (const ch of input) {
    if (ch >= 'ぁ' && ch <= 'ん') {
      // ひらがなをカタカナへ → 半角カナ
      const kata = String.fromCharCode(ch.charCodeAt(0) + HIRAGANA_OFFSET);
      result += KANA_MAP[kata] ?? kata;
    } else if (KANA_MAP[ch]) {
      result += KANA_MAP[ch];
    } else if (ch >= '\uFF61' && ch <= '\uFF9F') {
      // 既に半角カナ
      result += ch;
    } else if (ch >= '\uFF10' && ch <= '\uFF19') {
      // 全角数字 → 半角
      result += String.fromCharCode(ch.charCodeAt(0) - 0xfee0);
    } else if (ch >= '\uFF21' && ch <= '\uFF5A') {
      // 全角英字 → 半角
      result += String.fromCharCode(ch.charCodeAt(0) - 0xfee0);
    } else if (ch.charCodeAt(0) < 0x80) {
      // ASCII
      result += ch;
    } else {
      // 変換できない文字はスペース
      result += ' ';
    }
  }
  return result;
};

/**
 * 文字列を指定長に右側スペース埋めする。長すぎる場合は切詰め。
 */
const padRight = (value: string, width: number): string => {
  if (value.length >= width) return value.slice(0, width);
  return value + ' '.repeat(width - value.length);
};

/**
 * 数値文字列を指定長にゼロ埋めする。長すぎる場合は切詰め(下位桁優先)。
 */
const padLeftZero = (value: string | number, width: number): string => {
  const s = String(value).replace(/[^\d]/g, '');
  if (s.length >= width) return s.slice(-width);
  return '0'.repeat(width - s.length) + s;
};

interface HeaderParams {
  clientCode: string; // 委託者コード(10桁)
  clientName: string; // 委託者名(40バイト, 半角カナ)
  transferDate: string; // YYYY-MM-DD
  bankCode: string; // 取引銀行番号(4桁)
  bankName?: string; // 取引銀行名(15バイト, デフォルト ﾕｳﾁﾖｷﾞﾝｺｳ)
  branchCode: string; // 取引支店番号(3桁)
  branchName?: string; // 取引支店名(15バイト)
  accountType?: string; // 預金種目 (ordinary/current/savings)
  accountNumber?: string; // 委託者口座番号(7桁)
}

/**
 * ヘッダレコード（区分=1）120バイトを生成
 */
export const buildHeaderRecord = (params: HeaderParams): string => {
  const transferMMDD = params.transferDate.replace(/-/g, '').slice(4, 8);
  const parts = [
    '1', // レコード区分
    '91', // 種別コード（預金口座振替）
    '0', // コード区分（JISコード）
    padLeftZero(params.clientCode, 10),
    padRight(toHalfWidthKana(params.clientName), 40),
    transferMMDD, // 引落日 MMDD (4桁)
    padLeftZero(params.bankCode, 4),
    padRight(toHalfWidthKana(params.bankName ?? 'ﾕｳﾁﾖｷﾞﾝｺｳ'), 15),
    padLeftZero(params.branchCode, 3),
    padRight(toHalfWidthKana(params.branchName ?? ''), 15),
    accountTypeCode(params.accountType ?? 'ordinary'),
    padLeftZero(params.accountNumber ?? '', 7),
  ];
  const body = parts.join('');
  return padRight(body, RECORD_LENGTH);
};

/**
 * データレコード（区分=2）120バイトを生成
 */
export const buildDataRecord = (item: YuchoBillingItem): string => {
  const info = item.billingInfo;
  const parts = [
    '2', // レコード区分
    padLeftZero(extractBankCode(info?.bankName ?? ''), 4),
    padRight(toHalfWidthKana(info?.bankName ?? ''), 15),
    padLeftZero(extractBranchCode(info?.branchName ?? ''), 3),
    padRight(toHalfWidthKana(info?.branchName ?? ''), 15),
    '    ', // ダミー(4)
    accountTypeCode(info?.accountType),
    padLeftZero(info?.accountNumber ?? '', 7),
    padRight(toHalfWidthKana(info?.accountHolder ?? item.customerNameKana ?? ''), 30),
    padLeftZero(item.billingAmount, 10),
    '0', // 新規コード(0:その他)
    padRight(item.contractPlotId.replace(/-/g, '').slice(0, 20), 20), // 顧客番号
    '0', // 振替結果コード(0:未処理)
  ];
  const body = parts.join('');
  return padRight(body, RECORD_LENGTH);
};

/**
 * トレーラレコード（区分=8）120バイトを生成
 */
export const buildTrailerRecord = (totalCount: number, totalAmount: number): string => {
  const parts = [
    '8',
    padLeftZero(totalCount, 6),
    padLeftZero(totalAmount, 12),
    padLeftZero(0, 6), // 振替済件数（未処理時は0）
    padLeftZero(0, 12), // 振替済金額
    padLeftZero(0, 6), // 振替不能件数
    padLeftZero(0, 12), // 振替不能金額
  ];
  const body = parts.join('');
  return padRight(body, RECORD_LENGTH);
};

/**
 * エンドレコード（区分=9）120バイトを生成
 */
export const buildEndRecord = (): string => {
  return padRight('9', RECORD_LENGTH);
};

/**
 * 銀行名から銀行コードを推定。ゆうちょ銀行は 9900。
 * 不明な場合は 0000 を返す（呼び出し側で上書き必要）。
 */
const extractBankCode = (bankName: string): string => {
  if (bankName.includes('ゆうちょ') || bankName.includes('ﾕｳﾁﾖ') || bankName.includes('郵便')) {
    return '9900';
  }
  return '0000';
};

/**
 * 支店名から支店コード(3桁)を推定。漢数字を含む店舗名（〇一八店等）から数字を抽出。
 * 不明な場合は 000 を返す。
 */
const KANJI_DIGIT: Record<string, string> = {
  〇: '0',
  零: '0',
  一: '1',
  壱: '1',
  二: '2',
  弐: '2',
  三: '3',
  参: '3',
  四: '4',
  五: '5',
  六: '6',
  七: '7',
  八: '8',
  九: '9',
};

const extractBranchCode = (branchName: string): string => {
  // ASCII数字優先
  const ascii = branchName.match(/\d{3}/);
  if (ascii) return ascii[0];
  // 漢数字3桁
  let digits = '';
  for (const ch of branchName) {
    if (KANJI_DIGIT[ch] != null) {
      digits += KANJI_DIGIT[ch];
      if (digits.length === 3) break;
    }
  }
  return digits.length === 3 ? digits : '000';
};

interface BuildCsvParams {
  header: HeaderParams;
  items: YuchoBillingItem[];
}

/**
 * 全銀協フォーマットの完全な CSV (固定長レコード) を生成する。
 * 出力例:
 *   1{ヘッダー...}\r\n
 *   2{データ1...}\r\n
 *   2{データ2...}\r\n
 *   8{トレーラー...}\r\n
 *   9{エンド...}\r\n
 */
export const buildZenginCsv = ({ header, items }: BuildCsvParams): string => {
  const billable = items.filter((i) => i.billingInfo && i.billingAmount > 0);
  const totalAmount = billable.reduce((sum, i) => sum + i.billingAmount, 0);

  const lines = [
    buildHeaderRecord(header),
    ...billable.map(buildDataRecord),
    buildTrailerRecord(billable.length, totalAmount),
    buildEndRecord(),
  ];
  return lines.join(LINE_SEP) + LINE_SEP;
};

// テスト用にエクスポート
export const __internal = {
  toHalfWidthKana,
  padRight,
  padLeftZero,
  accountTypeCode,
  extractBankCode,
  extractBranchCode,
};
