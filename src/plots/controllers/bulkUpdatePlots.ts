/**
 * 区画一括編集エンドポイント
 * PUT /api/v1/plots/bulk
 *
 * 既存の ContractPlot を plotNumber でマッチングして一括更新します。
 * 未指定フィールド = 変更しない、null 明示 = クリア（updatePlotCore 仕様）。
 * トランザクションによる all-or-nothing 処理。
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

    // 2. バッチ内の plotNumber 重複チェック
    const plotNumbers = items.map((item) => item.plotNumber);
    const duplicatesInBatch = plotNumbers.filter(
      (num, index) => plotNumbers.indexOf(num) !== index
    );

    if (duplicatesInBatch.length > 0) {
      const uniqueDuplicates = [...new Set(duplicatesInBatch)];
      const details = uniqueDuplicates.map((plotNumber) => {
        const rows = items
          .map((item, index) => (item.plotNumber === plotNumber ? index : -1))
          .filter((index) => index !== -1);
        return {
          row: rows[1],
          field: 'plotNumber',
          message: `区画番号「${plotNumber}」がバッチ内で重複しています（行 ${rows.join(', ')}）`,
        };
      });

      throw new ValidationError('一括編集でエラーが発生しました', details);
    }

    // 3. DB 上で plotNumber → 最新 ContractPlot.id をマッピング
    //   1つの PhysicalPlot に複数契約がある場合は最新（created_at DESC）を選択
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
    const plotNumbersWithoutContract: string[] = [];
    for (const pp of existingPlots) {
      const contract = pp.contractPlots[0];
      if (contract) {
        plotNumberToContractId.set(pp.plot_number, contract.id);
      } else {
        plotNumbersWithoutContract.push(pp.plot_number);
      }
    }

    const missingPlotNumbers = plotNumbers.filter(
      (num) => !plotNumberToContractId.has(num) && !plotNumbersWithoutContract.includes(num)
    );

    if (missingPlotNumbers.length > 0 || plotNumbersWithoutContract.length > 0) {
      const details: Array<{ row?: number; field: string; message: string }> = [];
      for (const num of missingPlotNumbers) {
        const row = items.findIndex((item) => item.plotNumber === num);
        details.push({
          row,
          field: 'plotNumber',
          message: `区画番号「${num}」はデータベースに存在しません`,
        });
      }
      for (const num of plotNumbersWithoutContract) {
        const row = items.findIndex((item) => item.plotNumber === num);
        details.push({
          row,
          field: 'plotNumber',
          message: `区画番号「${num}」に有効な契約区画が存在しません`,
        });
      }
      throw new ValidationError('一括編集でエラーが発生しました', details);
    }

    // 4. トランザクションで一括更新
    const updatedPlots = await prisma.$transaction(
      async (tx) => {
        const results: Array<{ row: number; id: string; plotNumber: string }> = [];

        for (let i = 0; i < items.length; i++) {
          const item = items[i]!;
          const contractPlotId = plotNumberToContractId.get(item.plotNumber)!;

          // plotNumber を分離して updatePlotSchema 準拠の input にする
          const { plotNumber, ...updateInput } = item;
          void plotNumber;

          try {
            await updatePlotCore(tx, contractPlotId, updateInput as UpdatePlotRequest, req);

            results.push({
              row: i,
              id: contractPlotId,
              plotNumber: item.plotNumber,
            });
          } catch (error) {
            if (error instanceof ValidationError) {
              const details = error.details?.length
                ? error.details.map((d) => ({ ...d, row: i }))
                : [{ row: i, message: error.message }];
              throw new ValidationError(`行 ${i} でエラー: ${error.message}`, details);
            }
            throw error;
          }
        }

        return results;
      },
      {
        maxWait: 10000,
        timeout: 60000,
      }
    );

    res.status(200).json({
      success: true,
      data: {
        totalRequested: items.length,
        updated: updatedPlots.length,
        results: updatedPlots,
      },
    });
  } catch (error) {
    next(error);
  }
};
