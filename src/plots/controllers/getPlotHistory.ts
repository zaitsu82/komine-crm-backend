/**
 * 区画履歴取得エンドポイント
 * GET /api/v1/plots/:id/history
 *
 * 指定された契約区画に関連する変更履歴を取得します。
 */

import { Request, Response, NextFunction } from 'express';
import prisma from '../../db/prisma';
import { NotFoundError } from '../../middleware/errorHandler';
import { formatHistoryWithLabels } from '../services/historyLabels';

interface HistoryQueryParams {
  page?: string;
  limit?: string;
  entityType?: string;
}

/**
 * 区画履歴取得
 * GET /api/v1/plots/:id/history
 */
export const getPlotHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params as Record<string, string>;
    const { page = '1', limit = '20', entityType } = req.query as HistoryQueryParams;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = Math.min(parseInt(limit, 10) || 20, 100); // 最大100件
    const skip = (pageNum - 1) * limitNum;

    // 契約区画の存在確認
    const contractPlot = await prisma.contractPlot.findUnique({
      where: { id, deleted_at: null },
      select: { id: true, physical_plot_id: true },
    });

    if (!contractPlot) {
      throw new NotFoundError('指定された契約区画が見つかりません');
    }

    // 履歴の検索条件
    const whereCondition: any = {
      OR: [{ contract_plot_id: id }, { physical_plot_id: contractPlot.physical_plot_id }],
    };

    // エンティティタイプでフィルタ
    if (entityType) {
      whereCondition.entity_type = entityType;
    }

    // 履歴の取得
    const [histories, total] = await Promise.all([
      prisma.history.findMany({
        where: whereCondition,
        orderBy: { created_at: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.history.count({ where: whereCondition }),
    ]);

    // レスポンスの整形（日本語ラベル付与）
    const formattedHistories = histories.map(formatHistoryWithLabels);

    res.status(200).json({
      success: true,
      data: {
        histories: formattedHistories,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
