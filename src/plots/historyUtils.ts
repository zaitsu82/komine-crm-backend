import { Request } from 'express';

/**
 * 変更されたフィールドの詳細情報
 */
export interface ChangeDetail {
  before: unknown;
  after: unknown;
}

/**
 * 変更フィールドのマップ
 * 例: { "plot_number": { "before": "A-55", "after": "A-56" } }
 */
export interface ChangedFields {
  [fieldName: string]: ChangeDetail;
}

/**
 * 除外するシステムフィールド
 */
const EXCLUDED_FIELDS = ['updated_at', 'created_at', 'deleted_at'];

/**
 * 2つのオブジェクトを比較して、変更されたフィールドを検出する
 *
 * @param before - 変更前のデータ
 * @param after - 変更後のデータ
 * @returns 変更されたフィールドのマップ（変更がない場合は空オブジェクト）
 */
export function detectChangedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): ChangedFields {
  const changed: ChangedFields = {};

  // 全てのフィールドを取得（beforeとafterの両方）
  const allFields = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const field of allFields) {
    // システムフィールドは除外
    if (EXCLUDED_FIELDS.includes(field)) {
      continue;
    }

    const beforeValue = before[field];
    const afterValue = after[field];

    // 値が異なる場合は変更あり
    if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
      changed[field] = {
        before: beforeValue,
        after: afterValue,
      };
    }
  }

  return changed;
}

/**
 * リクエストオブジェクトからIPアドレスを取得する
 *
 * @param req - Expressのリクエストオブジェクト
 * @returns IPアドレス（取得できない場合は 'unknown'）
 */
export function getIpAddress(req: Request): string {
  return (
    req.ip ||
    req.socket.remoteAddress ||
    (req.connection as { remoteAddress?: string } | undefined)?.remoteAddress ||
    'unknown'
  );
}
