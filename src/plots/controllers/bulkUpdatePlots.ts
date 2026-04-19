/**
 * 区画一括編集エンドポイント
 * PUT /api/v1/plots/bulk
 *
 * 既存の ContractPlot を plotNumber でマッチングして一括更新します。
 * 未指定フィールド = 変更しない、null 明示 = クリア（updatePlotCore 仕様）。
 *
 * Phase 1 対応 (issue #76):
 * - 全件 1 トランザクション → 1 件ごとの独立トランザクション
 * - 存在しない plotNumber / 契約なしは「リクエスト全体エラー」から
 *   「該当行のみ failed」に変更
 * - 部分成功レスポンス { totalRequested, succeeded, failed[], results[] }
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { UpdatePlotRequest } from '@komine/types';
import prisma from '../../db/prisma';
import { ValidationError } from '../../middleware/errorHandler';
import { updatePlotSchema } from '../../validations/plotValidation';
import { updatePlotCore } from './updatePlot';

/**
 * 一括編集用の単一アイテムバリデーションスキーマ
 * plotNumber（マッチングキー）+ updatePlotSchema
 */
const bulkUpdateItemSchema = updatePlotSchema.extend({
  plotNumber: z
    .string({ error: 'plotNumber はマッチングキーとして必須です' })
    .min(1, 'plotNumber は必須です')
    .max(50, 'plotNumber は50文字以内で入力してください'),
});

const bulkUpdateRequestSchema = z.object({
  items: z
    .array(bulkUpdateItemSchema)
    .min(1, '編集データが空です。1件以上のデータを指定してください')
    .max(500, '一括編集は最大500件までです'),
});

export type BulkUpdateItem = z.infer<typeof bulkUpdateItemSchema>;

type BulkFailure = {
  row: number;
  plotNumber?: string | null;
  error: {
    message: string;
    details?: Array<{ field?: string; message: string }>;
  };
};

type BulkSuccess = {
  row: number;
  id: string;
  plotNumber: string;
};

/**
 * 1件分の更新処理（独立トランザクション）
 */
async function updateSingleItem(
  item: BulkUpdateItem,
  contractPlotId: string,
  req: Request
): Promise<void> {
  const { plotNumber, ...updateInput } = item;
  void plotNumber;

  await prisma.$transaction(
    async (tx) => {
      await updatePlotCore(tx, contractPlotId, updateInput as UpdatePlotRequest, req);
    },
    { maxWait: 10000, timeout: 30000 }
  );
}

/**
 * 区画一括編集
 * PUT /api/v1/plots/bulk
 */
export const bulkUpdatePlots = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 1. リクエストボディのバリデーション
    const parseResult = bulkUpdateRequestSchema.safeParse(req.body);

    if (!parseResult.success) {
      const details = parseResult.error.issues.map((issue) => ({
        row:
          issue.path[0] === 'items' && typeof issue.path[1] === 'number'
            ? issue.path[1]
            : undefined,
        field: issue.path.length > 2 ? issue.path.slice(2).join('.') : issue.path.join('.'),
        message: issue.message,
      }));

      throw new ValidationError('一括編集でエラーが発生しました', details);
    }

    const { items } = parseResult.data;

    const failures: BulkFailure[] = [];
    const skipRows = new Set<number>();

    // 2. バッチ内の plotNumber 重複 — 後続出現は failed に
    const seenPlotNumbers = new Map<string, number>();
    for (let i = 0; i < items.length; i++) {
      const pn = items[i]!.plotNumber;
      if (seenPlotNumbers.has(pn)) {
        failures.push({
          row: i,
          plotNumber: pn,
          error: {
            message: `区画番号「${pn}」がバッチ内で重複しています（行 ${seenPlotNumbers.get(pn)} と同じ）`,
            details: [{ field: 'plotNumber', message: `行 ${seenPlotNumbers.get(pn)} と重複` }],
          },
        });
        skipRows.add(i);
      } else {
        seenPlotNumbers.set(pn, i);
      }
    }

    // 3. DB 上で plotNumber → 最新 ContractPlot.id をマッピング
    const plotNumbers = Array.from(seenPlotNumbers.keys());
    const existingPlots = await prisma.physicalPlot.findMany({
      where: {
        plot_number: { in: plotNumbers },
        deleted_at: null,
      },
      include: {
        contractPlots: {
          where: { deleted_at: null },
          orderBy: { created_at: 'desc' },
          select: { id: true },
          take: 1,
        },
      },
    });

    const plotNumberToContractId = new Map<string, string>();
    const plotNumbersWithoutContract = new Set<string>();
    for (const pp of existingPlots) {
      const contract = pp.contractPlots[0];
      if (contract) {
        plotNumberToContractId.set(pp.plot_number, contract.id);
      } else {
        plotNumbersWithoutContract.add(pp.plot_number);
      }
    }

    // 該当する ContractPlot が引けない行を failed に
    for (let i = 0; i < items.length; i++) {
      if (skipRows.has(i)) continue;
      const pn = items[i]!.plotNumber;
      if (plotNumberToContractId.has(pn)) continue;

      if (plotNumbersWithoutContract.has(pn)) {
        failures.push({
          row: i,
          plotNumber: pn,
          error: {
            message: `区画番号「${pn}」に有効な契約区画が存在しません`,
            details: [{ field: 'plotNumber', message: '契約区画なし' }],
          },
        });
      } else {
        failures.push({
          row: i,
          plotNumber: pn,
          error: {
            message: `区画番号「${pn}」はデータベースに存在しません`,
            details: [{ field: 'plotNumber', message: '区画が見つかりません' }],
          },
        });
      }
      skipRows.add(i);
    }

    // 4. 1件ずつ独立 tx で処理
    const successes: BulkSuccess[] = [];

    for (let i = 0; i < items.length; i++) {
      if (skipRows.has(i)) continue;

      const item = items[i]!;
      const contractPlotId = plotNumberToContractId.get(item.plotNumber)!;

      try {
        await updateSingleItem(item, contractPlotId, req);
        successes.push({ row: i, id: contractPlotId, plotNumber: item.plotNumber });
      } catch (error) {
        if (error instanceof ValidationError) {
          failures.push({
            row: i,
            plotNumber: item.plotNumber,
            error: {
              message: error.message,
              details: error.details as Array<{ field?: string; message: string }> | undefined,
            },
          });
        } else if (error instanceof Error) {
          failures.push({
            row: i,
            plotNumber: item.plotNumber,
            error: { message: error.message },
          });
        } else {
          failures.push({
            row: i,
            plotNumber: item.plotNumber,
            error: { message: '不明なエラーが発生しました' },
          });
        }
      }
    }

    res.status(200).json({
      success: true,
      data: {
        totalRequested: items.length,
        succeeded: successes.length,
        failed: failures,
        results: successes,
      },
    });
  } catch (error) {
    next(error);
  }
};
