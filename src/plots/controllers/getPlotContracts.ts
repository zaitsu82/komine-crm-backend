/**
 * 物理区画の契約一覧取得エンドポイント
 * GET /api/v1/plots/:id/contracts
 *
 * 指定した物理区画に紐づく全契約を取得します（分割販売時に複数契約が存在）。
 */

import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 物理区画の契約一覧取得
 * GET /plots/:id/contracts
 */
export const getPlotContracts = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

    // PhysicalPlotの存在確認
    const physicalPlot = await prisma.physicalPlot.findUnique({
      where: { id, deleted_at: null },
      include: {
        ContractPlots: {
          where: { deleted_at: null },
          include: {
            SaleContract: {
              include: {
                SaleContractRoles: {
                  where: { deleted_at: null, is_primary: true },
                  include: {
                    Customer: true,
                  },
                },
              },
            },
            UsageFee: true,
            ManagementFee: true,
          },
          orderBy: {
            created_at: 'desc',
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

    // 契約一覧を整形
    const contracts = physicalPlot.ContractPlots.map((contract) => {
      // 主契約者を取得（is_primary=true）
      const primaryRole = contract.SaleContract?.SaleContractRoles?.[0];
      const primaryCustomer = primaryRole?.Customer;

      return {
        id: contract.id,
        contractAreaSqm: contract.contract_area_sqm.toNumber(),
        saleStatus: contract.sale_status,
        locationDescription: contract.location_description,
        customer: primaryCustomer
          ? {
              id: primaryCustomer.id,
              name: primaryCustomer.name,
              nameKana: primaryCustomer.name_kana,
              phoneNumber: primaryCustomer.phone_number,
            }
          : null,
        saleContract: contract.SaleContract
          ? {
              id: contract.SaleContract.id,
              contractDate: contract.SaleContract.contract_date,
              price: contract.SaleContract.price.toNumber(),
              paymentStatus: contract.SaleContract.payment_status,
            }
          : null,
        createdAt: contract.created_at,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        physicalPlot: {
          id: physicalPlot.id,
          plotNumber: physicalPlot.plot_number,
          areaName: physicalPlot.area_name,
          areaSqm: physicalPlot.area_sqm.toNumber(),
          status: physicalPlot.status,
        },
        contracts,
        summary: {
          totalContracts: contracts.length,
          totalAllocatedArea: contracts.reduce((sum, c) => sum + c.contractAreaSqm, 0),
        },
      },
    });
  } catch (error) {
    console.error('Error getting plot contracts:', error);

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '契約一覧の取得に失敗しました',
      },
    });
  }
};
