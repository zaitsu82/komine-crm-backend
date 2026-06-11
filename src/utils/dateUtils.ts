/**
 * 日付ユーティリティ関数
 */

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
