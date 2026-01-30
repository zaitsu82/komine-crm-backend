import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { getOverallSummary } from '../services/inventoryService';

const prisma = new PrismaClient();

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
    console.error('Error fetching inventory summary:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '在庫サマリーの取得中にエラーが発生しました',
      },
    });
  }
}
