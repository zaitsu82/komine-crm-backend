/**
 * ゆうちょ自動払込み CSV ビルダー
 *
 * 利用者提供の実ファイル(2026-05-27 確認) に基づくフォーマット:
 *   - カンマ区切り CSV・12列・Shift-JIS（エンコードは Controller 側で実施）
 *   - ヘッダ/トレーラ/エンドレコードは無し（全行データ）
 *   - 行頭は空列でカンマ始まり
 *
 * 列定義:
 *   1: 空
 *   2: 金融機関コード (9900 固定 = ゆうちょ)
 *   3: 金融機関名 半角カナ (15桁・空白パディング, "ﾕｳﾁﾖ" + 11空白)
 *   4: 金融機関名 漢字 ("ゆうちょ銀行" 固定)
 *   5: 店番 (3桁)
 *   6: 空 (支店名カナ想定・現状は空)
 *   7: 空 (支店名漢字想定・現状は空)
 *   8: 預金種目 (1=普通)
 *   9: 口座番号 (7桁)
 *  10: 口座名義 半角カナ (30桁空白パディング・ダブルクオート囲み)
 *  11: 引落金額
 *  12: フラグ (1 固定)
 */

import type { YuchoBillingItem } from '../validations/yuchoValidation';
import { branchCodeFromSymbol, accountNumberFromYuchoNumber } from './yuchoAccount';

const LINE_SEP = '\r\n';
const BANK_CODE = '9900';
const BANK_NAME_KANA = 'ﾕｳﾁﾖ';
const BANK_NAME_KANA_WIDTH = 15;
const BANK_NAME_KANJI = 'ゆうちょ銀行';
const ACCOUNT_HOLDER_WIDTH = 30;
const FLAG = '1';

/**
 * 預金種目コード変換（Prisma enum → ゆうちょ code）
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
 * ゆうちょCSVの口座名義は半角カナを要求するため。
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
      const kata = String.fromCharCode(ch.charCodeAt(0) + HIRAGANA_OFFSET);
      result += KANA_MAP[kata] ?? kata;
    } else if (KANA_MAP[ch]) {
      result += KANA_MAP[ch];
    } else if (ch >= '｡' && ch <= 'ﾟ') {
      result += ch;
    } else if (ch >= '０' && ch <= '９') {
      result += String.fromCharCode(ch.charCodeAt(0) - 0xfee0);
    } else if (ch >= 'Ａ' && ch <= 'ｚ') {
      result += String.fromCharCode(ch.charCodeAt(0) - 0xfee0);
    } else if (ch.charCodeAt(0) < 0x80) {
      result += ch;
    } else {
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

/**
 * 支店名から店番(3桁)を抽出。漢数字を含む店舗名（〇一八店等）から数字を抽出する。
 * 不明な場合は 000 を返す。記号番号方式の本来採番は別 issue (#170) で対応。
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
  const ascii = branchName.match(/\d{3}/);
  if (ascii) return ascii[0];
  let digits = '';
  for (const ch of branchName) {
    if (KANJI_DIGIT[ch] != null) {
      digits += KANJI_DIGIT[ch];
      if (digits.length === 3) break;
    }
  }
  return digits.length === 3 ? digits : '000';
};

/**
 * データ行(1顧客=1行) を生成する。
 */
export const buildDataRow = (item: YuchoBillingItem): string => {
  const info = item.billingInfo;
  // 口座名義は唯一の二重引用符囲みフィールド。toHalfWidthKana は ASCII を素通し
  // するため、名義に半角 " が残ると囲みが途中で閉じて列ズレを起こす。
  // RFC4180 に従い内部の " を "" に二重化してから囲む（#273）。
  // 固定幅整形は「論理値を幅に収めてからエスケープ」の順で行うこと（#300）。
  // エスケープ後に切詰めると "" のペアが30桁境界で割れて単独の " が残り、
  // 囲みの引用符が不均衡になって #273 が防いだ列ズレが再発する。
  const accountHolder = padRight(
    toHalfWidthKana(info?.accountHolder ?? item.customerNameKana ?? ''),
    ACCOUNT_HOLDER_WIDTH
  ).replace(/"/g, '""');

  // 店番・口座番号はゆうちょ記号番号があればそれを正準ソースにする（#170）。
  // 記号(方式A)から店番3桁を取り、無ければ従来どおり支店名から推定する。
  const branchCode =
    branchCodeFromSymbol(info?.yuchoSymbol) ?? extractBranchCode(info?.branchName ?? '');
  const accountNumber =
    accountNumberFromYuchoNumber(info?.yuchoNumber) ?? info?.accountNumber ?? '';

  const cells = [
    '', // 1: 空
    BANK_CODE, // 2: 金融機関コード
    padRight(BANK_NAME_KANA, BANK_NAME_KANA_WIDTH), // 3: 金融機関名 半角カナ
    BANK_NAME_KANJI, // 4: 金融機関名 漢字
    padLeftZero(branchCode, 3), // 5: 店番
    '', // 6: 空
    '', // 7: 空
    accountTypeCode(info?.accountType), // 8: 預金種目
    padLeftZero(accountNumber, 7), // 9: 口座番号
    `"${accountHolder}"`, // 10: 口座名義
    String(item.billingAmount), // 11: 引落金額
    FLAG, // 12: フラグ
  ];
  return cells.join(',');
};

interface BuildCsvParams {
  items: YuchoBillingItem[];
}

/**
 * 口座番号として使える値か（数字を1桁以上含み、全0でないこと）。
 * buildDataRow は口座番号空を `0000000`、店番空を `000` で埋めるため、
 * ここで弾かないと「構造上正しいが口座が存在しない」不正振替行が出力される（#266）。
 */
const hasUsableAccountNumber = (item: YuchoBillingItem): boolean => {
  // ゆうちょ番号があればそれを、無ければ従来の口座番号を口座番号として扱う（#170）
  const source =
    accountNumberFromYuchoNumber(item.billingInfo?.yuchoNumber) ??
    item.billingInfo?.accountNumber ??
    '';
  const digits = source.replace(/[^\d]/g, '');
  return digits.length > 0 && Number(digits) > 0;
};

/**
 * CSV（振替ファイル）のデータ行として出力可能な請求項目かどうか。
 * 口座情報（billingInfo）があり、口座番号が実在しうる値で、かつ請求金額が正であること。
 * 件数表示の整合性のため、この判定を CSV 生成（buildYuchoCsv）と
 * 集計（yuchoService の summary）で共用する。これが実出力件数の唯一の基準となる。
 * 口座番号欠損はここで弾くことで excludedNoAccountCount（請求漏れ検知 #172）に
 * 自動計上される（#266）。
 */
export const isExportableBillingItem = (item: YuchoBillingItem): boolean =>
  Boolean(item.billingInfo) && hasUsableAccountNumber(item) && item.billingAmount > 0;

/**
 * ゆうちょ自動払込みCSV (12列カンマ区切り) を生成する。
 * 戻り値は文字列。Shift-JIS エンコードは Controller 側で実施。
 */
export const buildYuchoCsv = ({ items }: BuildCsvParams): string => {
  const billable = items.filter(isExportableBillingItem);
  if (billable.length === 0) return '';
  return billable.map(buildDataRow).join(LINE_SEP) + LINE_SEP;
};

// テスト用にエクスポート
export const __internal = {
  toHalfWidthKana,
  padRight,
  padLeftZero,
  accountTypeCode,
  extractBranchCode,
};
