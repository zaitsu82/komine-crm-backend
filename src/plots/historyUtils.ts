import { Request } from 'express';
import { Prisma } from '@prisma/client';

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
 * 履歴レコード作成用のパラメータ
 */
export interface CreateHistoryParams {
  entityType: string;
  entityId: string;
  plotId: string | null;
  actionType: 'CREATE' | 'UPDATE' | 'DELETE';
  changedFields: ChangedFields | null;
  changedBy: string;
  changeReason: string | null;
  ipAddress: string;
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

/**
 * 履歴レコード作成用のデータを生成する
 *
 * @param params - 履歴作成パラメータ
 * @returns Prismaのcreate用データオブジェクト
 */
export function createHistoryRecord(params: CreateHistoryParams) {
  return {
    entity_type: params.entityType,
    entity_id: params.entityId,
    plot_id: params.plotId,
    action_type: params.actionType,
    changed_fields: (params.changedFields ?? undefined) as Prisma.InputJsonValue | undefined,
    changed_by: params.changedBy,
    change_reason: params.changeReason ?? undefined,
    ip_address: params.ipAddress,
  };
}

/**
 * 変更があったかどうかを判定する
 *
 * @param changedFields - 変更フィールドのマップ
 * @returns 変更があった場合true、なかった場合false
 */
export function hasChanges(changedFields: ChangedFields): boolean {
  return Object.keys(changedFields).length > 0;
}
