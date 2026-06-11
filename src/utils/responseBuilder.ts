/**
 * レスポンスビルダーユーティリティ
 * Prismaモデルから一貫したAPIレスポンスを構築するためのヘルパー関数
 */

import { Prisma } from '@prisma/client';

/**
 * Prisma DecimalやBigIntを数値に変換
 */
export function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  if (Prisma.Decimal.isDecimal(value)) return (value as Prisma.Decimal).toNumber();
  if (
    typeof value === 'object' &&
    'toNumber' in value &&
    typeof (value as { toNumber: () => number }).toNumber === 'function'
  ) {
    return (value as { toNumber: () => number }).toNumber();
  }
  const num = Number(value);
  return isNaN(num) ? 0 : num;
}
