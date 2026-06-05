/**
 * 日付ユーティリティ関数
 */

/**
 * DateをISO日付文字列（YYYY-MM-DD）に変換
 */
export function formatDate(date: Date | null | undefined): string | null {
  if (!date) return null;
  return date.toISOString().split('T')[0] ?? null;
}

/**
 * DateをISOタイムスタンプ文字列に変換
 */
export function formatDateTime(date: Date | null | undefined): string | null {
  if (!date) return null;
  return date.toISOString();
}

/**
 * 文字列をDateオブジェクトに変換
 */
export function parseDate(str: string | null | undefined): Date | null {
  if (!str) return null;
  const date = new Date(str);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * 現在時刻（または指定時刻）を JST の暦日として解釈し、
 * その暦日の UTC 00:00 を表す Date を返す（#214）。
 *
 * Prisma の @db.Date 列は UTC 基準で日付部分を切り出すため、
 * 時刻付き Date（ローカル時刻）をそのまま書き込むと、
 * JST 00:00〜08:59 の処理で保存日付が前日にずれる。
 * @db.Date 列への保存値・比較基準日はこのヘルパで正規化すること。
 */
export function todayJstAsUtcDate(base: Date = new Date()): Date {
  // en-CA ロケールは YYYY-MM-DD 形式を返す
  const jstDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(base);
  return new Date(`${jstDateStr}T00:00:00Z`);
}

/**
 * UTC 00:00 正規化済みの Date に対して年だけを加算する（#214）。
 * setFullYear（ローカル時刻ベース）と異なり UTC 00:00 を維持する。
 */
export function addYearsUtc(date: Date, years: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear() + years, date.getUTCMonth(), date.getUTCDate()));
}

// 元号の開始日（UTC 暦日比較用 #277）。
// @db.Date 列は UTC 00:00 の Date として読まれるため、ローカルTZ 構築の境界定数
// （new Date(2019, 4, 1)）＋ローカル getter だと非JST環境で境界日に前日扱いとなり
// 令和/平成を誤判定する。境界・年月日の取得を UTC に統一する。
const REIWA_START_UTC = Date.UTC(2019, 4, 1); // 2019-05-01
const HEISEI_START_UTC = Date.UTC(1989, 0, 8); // 1989-01-08
const SHOWA_START_UTC = Date.UTC(1926, 11, 25); // 1926-12-25

/**
 * 日付から元号と元号年を判定する（#215/#277）。
 * 年単位でなく境界日（UTC 暦日）で判定する。
 * ※frontend formatDateWithEra は令和/平成のみで昭和分岐を持たないため、
 *   backend で和暦を画面/書類へ出す際は表記の統一に注意（#277 で確認済み）。
 * 元号適用外（昭和より前）は null を返す。
 */
function resolveJapaneseEra(date: Date): { era: string; eraYear: number } | null {
  const t = date.getTime();
  if (t >= REIWA_START_UTC) return { era: '令和', eraYear: date.getUTCFullYear() - 2018 };
  if (t >= HEISEI_START_UTC) return { era: '平成', eraYear: date.getUTCFullYear() - 1988 };
  if (t >= SHOWA_START_UTC) return { era: '昭和', eraYear: date.getUTCFullYear() - 1925 };
  return null;
}

/**
 * 和暦変換（境界日判定: 令和=2019-05-01〜 / 平成=1989-01-08〜 / 昭和=1926-12-25〜）
 * 入力は @db.Date 由来の UTC 00:00 Date を想定し、UTC 暦日で整形する（#277）。
 */
export function toJapaneseDate(date: Date | null | undefined): string | null {
  if (!date) return null;

  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const era = resolveJapaneseEra(date);

  if (era) {
    const yearStr = era.eraYear === 1 ? '元' : String(era.eraYear);
    return `${era.era}${yearStr}年${month}月${day}日`;
  }

  // 元号適用外は西暦で返す
  return `${date.getUTCFullYear()}年${month}月${day}日`;
}

/**
 * 和暦（年月のみ）
 * 入力は @db.Date 由来の UTC 00:00 Date を想定し、UTC 暦日で整形する（#277）。
 */
export function toJapaneseYearMonth(date: Date | null | undefined): string | null {
  if (!date) return null;

  const month = date.getUTCMonth() + 1;
  const era = resolveJapaneseEra(date);

  if (era) {
    return `${era.era}${era.eraYear}年${month}月`;
  }

  return `${date.getUTCFullYear()}年${month}月`;
}

/**
 * 年月文字列をパース（例: "2024年3月" → { year: 2024, month: 3 }）
 */
export function parseJapaneseYearMonth(
  str: string | null | undefined
): { year: number; month: number } | null {
  if (!str) return null;

  const match = str.match(/(\d{4})年(\d{1,2})月/);
  if (match && match[1] && match[2]) {
    return {
      year: parseInt(match[1], 10),
      month: parseInt(match[2], 10),
    };
  }

  return null;
}
