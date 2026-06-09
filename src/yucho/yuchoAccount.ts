/**
 * ゆうちょ記号番号 ⇔ 店番・口座番号 の変換を集約する（#170）
 *
 * ゆうちょ口座を他金融機関フォーマット（店番＋口座番号）で扱うときの方式A:
 *   記号(5桁) = "1" + 店番(3桁) + 預金種目(1桁)
 *     - 先頭 "1" は通常貯金を表す固定値
 *     - 中央3桁が店番（振込用の3桁店番）
 *     - 末尾1桁は預金種目（通常 0）
 *   番号       = 口座番号（末尾のチェックデジットを除いた値で運用される）
 *
 * これまで CSV 出力では店番を支店名から推定していた（yuchoCsv.extractBranchCode）。
 * Customer.yucho_symbol / yucho_number を保持し、ここで一元変換することで、
 * 表示(フロント)と CSV で同一ロジックを使えるようにする。
 */

/** 記号が方式A（5桁・先頭1）として妥当か。 */
export function isValidYuchoSymbol(symbol: string | null | undefined): boolean {
  if (symbol == null) return false;
  const digits = symbol.replace(/[^\d]/g, '');
  return digits.length === 5 && digits.startsWith('1');
}

/**
 * 記号(5桁)から店番(3桁)を取り出す。方式A: 記号の中央3桁。
 * 妥当でない場合は null を返す（呼び出し側で支店名推定にフォールバック）。
 */
export function branchCodeFromSymbol(symbol: string | null | undefined): string | null {
  if (symbol == null) return null;
  const digits = symbol.replace(/[^\d]/g, '');
  if (digits.length !== 5 || !digits.startsWith('1')) return null;
  return digits.slice(1, 4);
}

/**
 * 記号(5桁)から預金種目コード（末尾1桁）を取り出す。妥当でなければ null。
 */
export function depositTypeFromSymbol(symbol: string | null | undefined): string | null {
  if (symbol == null) return null;
  const digits = symbol.replace(/[^\d]/g, '');
  if (digits.length !== 5 || !digits.startsWith('1')) return null;
  return digits.slice(4, 5);
}

/**
 * 番号から口座番号（数字のみ）を取り出す。空なら null。
 */
export function accountNumberFromYuchoNumber(num: string | null | undefined): string | null {
  if (num == null) return null;
  const digits = num.replace(/[^\d]/g, '');
  return digits.length > 0 ? digits : null;
}

/** 表示用に「記号-番号」形式へ整形する。どちらか欠ければ null。 */
export function formatSymbolNumber(
  symbol: string | null | undefined,
  num: string | null | undefined
): string | null {
  const s = symbol?.replace(/[^\d]/g, '') ?? '';
  const n = num?.replace(/[^\d]/g, '') ?? '';
  if (!s || !n) return null;
  return `${s}-${n}`;
}
