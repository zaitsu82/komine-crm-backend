/// <reference types="node" />
/**
 * 移行 step 前後で確認する invariant（不変条件）ヘルパー。
 *
 * 詳細は query_result/RECOVERY_PHASE1_HARDENING.md Task 2 を参照。
 *
 * 設計方針:
 *   - 違反は throw する。orchestrator が catch して明確なメッセージで停止する
 *   - DB を汚す前（pre-check）と汚した後（post-check）の両方で使う
 *   - 失敗時の例外メッセージに「どの step / 何が問題か」を必ず含める
 */

import type { PrismaClient } from '@prisma/client';

import type { IdMaps } from '../idMap';

export class InvariantViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvariantViolationError';
  }
}

/**
 * 必要な idMaps が空でないことを確認する。
 *
 * 1つでも空のものがあれば throw する。1 件目で止めず、全部のうち空のものを
 * まとめて報告した方がデバッグしやすい。
 */
export function assertIdMapsReady(
  stepName: string,
  idMaps: IdMaps,
  required: ReadonlyArray<keyof IdMaps>
): void {
  const empties: string[] = [];
  for (const key of required) {
    if (idMaps[key].size === 0) empties.push(key);
  }
  if (empties.length > 0) {
    throw new InvariantViolationError(
      `step ${stepName}: idMaps.${empties.join(', idMaps.')} ${
        empties.length === 1 ? 'is' : 'are'
      } empty, abort to prevent NULL FK insertion`
    );
  }
}

/**
 * 指定テーブルで「あってはならない条件」にマッチする行が 0 件であることを検証する。
 *
 * @param modelName Prisma の delegate 名（例: 'payment'）
 * @param where     Prisma 形式の where 条件（例: { contract_plot_id: null }）
 * @param stepName  違反時のエラーメッセージ用ラベル
 */
export async function assertNoOrphanRows(
  prisma: PrismaClient,
  modelName: string,
  where: Record<string, unknown>,
  stepName: string,
  description?: string
): Promise<void> {
  const delegate = (
    prisma as unknown as Record<
      string,
      {
        count: (args: { where: Record<string, unknown> }) => Promise<number>;
      }
    >
  )[modelName];
  if (!delegate || typeof delegate.count !== 'function') {
    throw new Error(`Unknown Prisma model: ${modelName}`);
  }
  const count = await delegate.count({ where });
  if (count > 0) {
    throw new InvariantViolationError(
      `step ${stepName}: ${count} orphan row(s) detected in ${modelName}${
        description ? ` (${description})` : ''
      }: where=${JSON.stringify(where)}`
    );
  }
}
