import { Request, Response } from 'express';
import { getSectionInventory } from '../services/inventoryService';
import {
  PlotPeriod,
  PlotStatus,
  SectionSortKey,
  SortOrder,
} from '../../validations/inventoryValidation';
import prisma from '../../db/prisma';

/**
 * GET /plots/inventory/sections
 * セクション別集計を取得
 */
export async function getInventorySections(req: Request, res: Response): Promise<void> {
  try {
    const period = req.query['period'] as PlotPeriod | undefined;
    const status = req.query['status'] as PlotStatus | undefined;
    const search = req.query['search'] as string | undefined;
    const sortBy = (req.query['sortBy'] as SectionSortKey) || 'period';
    const sortOrder = (req.query['sortOrder'] as SortOrder) || 'asc';
    const page = parseInt(req.query['page'] as string) || 1;
    const limit = parseInt(req.query['limit'] as string) || 20;

    const { items, total } = await getSectionInventory(prisma, {
      period,
      status,
      search,
      sortBy,
      sortOrder,
      page,
      limit,
    });

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      data: {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching inventory sections:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'セクション別集計の取得中にエラーが発生しました',
      },
    });
  }
}
