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
 * 和暦変換（令和）
 */
export function toJapaneseDate(date: Date | null | undefined): string | null {
  if (!date) return null;

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  // 令和元年は2019年5月1日から
  if (year >= 2019) {
    const reiwaYear = year - 2018;
    const yearStr = reiwaYear === 1 ? '元' : String(reiwaYear);
    return `令和${yearStr}年${month}月${day}日`;
  }

  // 平成は1989年1月8日から2019年4月30日まで
  if (year >= 1989) {
    const heiseiYear = year - 1988;
    const yearStr = heiseiYear === 1 ? '元' : String(heiseiYear);
    return `平成${yearStr}年${month}月${day}日`;
  }

  // 昭和は1926年12月25日から1989年1月7日まで
  if (year >= 1926) {
    const showaYear = year - 1925;
    const yearStr = showaYear === 1 ? '元' : String(showaYear);
    return `昭和${yearStr}年${month}月${day}日`;
  }

  // それ以前は西暦で返す
  return `${year}年${month}月${day}日`;
}

/**
 * 和暦（年月のみ）
 */
export function toJapaneseYearMonth(date: Date | null | undefined): string | null {
  if (!date) return null;

  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  if (year >= 2019) {
    const reiwaYear = year - 2018;
    return `令和${reiwaYear}年${month}月`;
  }

  if (year >= 1989) {
    const heiseiYear = year - 1988;
    return `平成${heiseiYear}年${month}月`;
  }

  return `${year}年${month}月`;
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
