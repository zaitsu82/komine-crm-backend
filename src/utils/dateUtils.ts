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

// 元号の開始日（ローカル暦日比較用）
const REIWA_START = new Date(2019, 4, 1); // 2019-05-01
const HEISEI_START = new Date(1989, 0, 8); // 1989-01-08
const SHOWA_START = new Date(1926, 11, 25); // 1926-12-25

/**
 * 日付から元号と元号年を判定する（#215）。
 * 年単位でなく境界日で判定する（frontend formatDateWithEra と同一基準）。
 * 元号適用外（昭和より前）は null を返す。
 */
function resolveJapaneseEra(date: Date): { era: string; eraYear: number } | null {
  if (date >= REIWA_START) return { era: '令和', eraYear: date.getFullYear() - 2018 };
  if (date >= HEISEI_START) return { era: '平成', eraYear: date.getFullYear() - 1988 };
  if (date >= SHOWA_START) return { era: '昭和', eraYear: date.getFullYear() - 1925 };
  return null;
}

/**
 * 和暦変換（境界日判定: 令和=2019-05-01〜 / 平成=1989-01-08〜 / 昭和=1926-12-25〜）
 */
export function toJapaneseDate(date: Date | null | undefined): string | null {
  if (!date) return null;

  const month = date.getMonth() + 1;
  const day = date.getDate();
  const era = resolveJapaneseEra(date);

  if (era) {
    const yearStr = era.eraYear === 1 ? '元' : String(era.eraYear);
    return `${era.era}${yearStr}年${month}月${day}日`;
  }

  // 元号適用外は西暦で返す
  return `${date.getFullYear()}年${month}月${day}日`;
}

/**
 * 和暦（年月のみ）
 */
export function toJapaneseYearMonth(date: Date | null | undefined): string | null {
  if (!date) return null;

  const month = date.getMonth() + 1;
  const era = resolveJapaneseEra(date);

  if (era) {
    return `${era.era}${era.eraYear}年${month}月`;
  }

  return `${date.getFullYear()}年${month}月`;
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
