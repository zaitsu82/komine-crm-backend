/**
 * 物理区画の在庫状況取得エンドポイント
 * GET /api/v1/plots/:id/inventory
 *
 * 物理区画の面積管理状況（総面積、割当済面積、利用可能面積）を取得します。
 */

import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 物理区画の在庫状況取得
 * GET /plots/:id/inventory
 */
export const getPlotInventory = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

    // PhysicalPlotの存在確認
    const physicalPlot = await prisma.physicalPlot.findUnique({
      where: { id, deleted_at: null },
      include: {
        contractPlots: {
          where: { deleted_at: null },
          select: {
            id: true,
            contract_area_sqm: true,
            saleContractRoles: {
              where: { deleted_at: null, role: 'contractor' },
              select: {
                customer: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!physicalPlot) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '指定された物理区画が見つかりません',
        },
      });
    }

    // 在庫計算
    const totalArea = physicalPlot.area_sqm.toNumber();
    const allocatedArea = physicalPlot.contractPlots.reduce(
      (sum, contract) => sum + contract.contract_area_sqm.toNumber(),
      0
    );
    const availableArea = totalArea - allocatedArea;
    const utilizationRate = totalArea > 0 ? (allocatedArea / totalArea) * 100 : 0;

    // ステータス判定
    let inventoryStatus: 'available' | 'partial' | 'sold_out';
    if (allocatedArea === 0) {
      inventoryStatus = 'available';
    } else if (availableArea > 0) {
      inventoryStatus = 'partial';
    } else {
      inventoryStatus = 'sold_out';
    }

    res.status(200).json({
      success: true,
      data: {
        physicalPlot: {
          id: physicalPlot.id,
          plotNumber: physicalPlot.plot_number,
          areaName: physicalPlot.area_name,
          status: physicalPlot.status,
        },
        inventory: {
          totalArea,
          allocatedArea,
          availableArea,
          utilizationRate: Math.round(utilizationRate * 100) / 100,
          status: inventoryStatus,
        },
        contracts: physicalPlot.contractPlots.map((contract) => {
          // 主契約者を取得（role='contractor'）
          const primaryRole = contract.saleContractRoles?.[0];
          const primaryCustomer = primaryRole?.customer;

          return {
            id: contract.id,
            contractAreaSqm: contract.contract_area_sqm.toNumber(),
            customerName: primaryCustomer?.name || null,
          };
        }),
      },
    });
  } catch (error) {
    console.error('Error getting plot inventory:', error);

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '在庫状況の取得に失敗しました',
      },
    });
  }
};
