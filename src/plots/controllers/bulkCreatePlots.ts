/**
 * 物理区画一括登録エンドポイント
 * POST /api/v1/plots/bulk
 *
 * 複数の物理区画（PhysicalPlot）を一括で登録します。
 * トランザクションによるall-or-nothing処理。
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '../../db/prisma';
import { ValidationError } from '../../middleware/errorHandler';

/**
 * 一括登録用の単一アイテムバリデーションスキーマ
 */
const bulkCreateItemSchema = z.object({
  plotNumber: z
    .string({ error: '区画番号は必須です' })
    .min(1, '区画番号は必須です')
    .max(50, '区画番号は50文字以内で入力してください'),
  areaName: z
    .string({ error: '区域名は必須です' })
    .min(1, '区域名は必須です')
    .max(100, '区域名は100文字以内で入力してください'),
  areaSqm: z.number().positive('面積は正の数値で入力してください').optional().default(3.6),
  notes: z.string().max(1000, '備考は1000文字以内で入力してください').optional(),
});

/**
 * 一括登録リクエストボディのバリデーションスキーマ
 */
const bulkCreateRequestSchema = z.object({
  items: z
    .array(bulkCreateItemSchema)
    .min(1, '登録データが空です。1件以上のデータを指定してください')
    .max(500, '一括登録は最大500件までです'),
});

export type BulkCreateItem = z.infer<typeof bulkCreateItemSchema>;

/**
 * 物理区画一括登録
 * POST /api/v1/plots/bulk
 */
export const bulkCreatePlots = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 1. リクエストボディの基本バリデーション
    const parseResult = bulkCreateRequestSchema.safeParse(req.body);

    if (!parseResult.success) {
      const details = parseResult.error.issues.map((issue) => ({
        row:
          issue.path[0] === 'items' && typeof issue.path[1] === 'number'
            ? issue.path[1]
            : undefined,
        field:
          issue.path.length > 2 ? String(issue.path[issue.path.length - 1]) : issue.path.join('.'),
        message: issue.message,
      }));

      throw new ValidationError('一括登録でエラーが発生しました', details);
    }

    const { items } = parseResult.data;

    // 2. バッチ内の重複チェック
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
          row: rows[1], // 2番目の出現位置をエラー行として報告
          field: 'plotNumber',
          message: `区画番号「${plotNumber}」がバッチ内で重複しています（行 ${rows.join(', ')}）`,
        };
      });

      throw new ValidationError('一括登録でエラーが発生しました', details);
    }

    // 3. データベース上の既存区画番号との重複チェック
    const existingPlots = await prisma.physicalPlot.findMany({
      where: {
        plot_number: { in: plotNumbers },
        deleted_at: null,
      },
      select: { plot_number: true },
    });

    if (existingPlots.length > 0) {
      const existingNumbers = existingPlots.map((p) => p.plot_number);
      const details = existingNumbers.map((plotNumber) => {
        const row = items.findIndex((item) => item.plotNumber === plotNumber);
        return {
          row,
          field: 'plotNumber',
          message: `区画番号「${plotNumber}」は既にデータベースに存在します`,
        };
      });

      throw new ValidationError('一括登録でエラーが発生しました', details);
    }

    // 4. トランザクションで一括作成
    const createdPlots = await prisma.$transaction(async (tx) => {
      const results = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i]!;
        const plot = await tx.physicalPlot.create({
          data: {
            plot_number: item.plotNumber,
            area_name: item.areaName,
            area_sqm: new Prisma.Decimal(item.areaSqm),
            status: 'available',
            notes: item.notes || null,
          },
        });

        results.push({
          row: i,
          id: plot.id,
          plotNumber: plot.plot_number,
          areaName: plot.area_name,
        });
      }

      return results;
    });

    // 5. 成功レスポンス
    res.status(201).json({
      success: true,
      data: {
        totalRequested: items.length,
        created: createdPlots.length,
        results: createdPlots,
      },
    });
  } catch (error) {
    next(error);
  }
};
