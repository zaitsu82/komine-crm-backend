import { Request, Response } from 'express';
import { getOverallSummary } from '../services/inventoryService';
import prisma from '../../db/prisma';
import { getRequestLogger } from '../../utils/logger';

/**
 * GET /plots/inventory/summary
 * 区画在庫の全体サマリーを取得
 */
export async function getInventorySummary(_req: Request, res: Response): Promise<void> {
  try {
    const summary = await getOverallSummary(prisma);

    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    getRequestLogger().error({ err: error }, 'Error fetching inventory summary');
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '在庫サマリーの取得中にエラーが発生しました',
      },
    });
  }
}
