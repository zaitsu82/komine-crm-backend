/**
 * 物理区画の在庫状況取得エンドポイント
 * GET /api/v1/plots/:id/inventory
 *
 * 物理区画の面積管理状況（総面積、割当済面積、利用可能面積）を取得します。
 */

import { Request, Response } from 'express';
import prisma from '../../db/prisma';
import { getRequestLogger } from '../../utils/logger';

/**
 * 物理区画の在庫状況取得
 * GET /plots/:id/inventory
 */
export const getPlotInventory = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params as Record<string, string>;

    // PhysicalPlotの存在確認
    const physicalPlot = await prisma.physicalPlot.findUnique({
      where: { id, deleted_at: null },
      include: {
        contractPlots: {
          where: { deleted_at: null },
          select: {
            id: true,
            contract_area_sqm: true,
            contract_status: true,
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
    // 割当済面積は active（契約中）のみで算定する（#209）。
    // vacant の器契約（空き区画の表現方式）・terminated（解約済み）を含めると、
    // 空き区画が sold_out と誤判定され、calculateAvailableArea /
    // validateContractArea（utils.ts）の active 限定基準とも矛盾する。
    const totalArea = physicalPlot.area_sqm.toNumber();
    const allocatedArea = physicalPlot.contractPlots
      .filter((contract) => contract.contract_status === 'active')
      .reduce((sum, contract) => sum + contract.contract_area_sqm.toNumber(), 0);
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
        // 表示用の契約一覧は在庫計算と用途が異なるため全契約（vacant/terminated含む）を返し、
        // 区別できるよう contractStatus を付与する
        contracts: physicalPlot.contractPlots.map((contract) => {
          // 主契約者を取得（role='contractor'）
          const primaryRole = contract.saleContractRoles?.[0];
          const primaryCustomer = primaryRole?.customer;

          return {
            id: contract.id,
            contractAreaSqm: contract.contract_area_sqm.toNumber(),
            contractStatus: contract.contract_status,
            customerName: primaryCustomer?.name || null,
          };
        }),
      },
    });
  } catch (error) {
    getRequestLogger().error({ err: error }, 'Error getting plot inventory');

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '在庫状況の取得に失敗しました',
      },
    });
  }
};
