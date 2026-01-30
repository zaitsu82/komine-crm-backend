import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { getPeriodSummaries } from '../services/inventoryService';
import { PlotPeriod } from '../../validations/inventoryValidation';

const prisma = new PrismaClient();

/**
 * GET /plots/inventory/periods
 * 期別サマリーを取得
 */
export async function getInventoryPeriods(req: Request, res: Response): Promise<void> {
  try {
    const period = req.query['period'] as PlotPeriod | undefined;

    const periods = await getPeriodSummaries(prisma, period);

    res.status(200).json({
      success: true,
      data: {
        periods,
      },
    });
  } catch (error) {
    console.error('Error fetching inventory periods:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '期別サマリーの取得中にエラーが発生しました',
      },
    });
  }
}
