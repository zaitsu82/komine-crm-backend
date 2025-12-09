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
        contractPlots: {
          where: { deleted_at: null },
          include: {
            saleContractRoles: {
              where: { deleted_at: null, role: 'contractor' },
              include: {
                customer: true,
              },
            },
            usageFee: true,
            managementFee: true,
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
    const contracts = physicalPlot.contractPlots.map((contract) => {
      // 主契約者を取得（role='contractor'）
      const primaryRole = contract.saleContractRoles?.[0];
      const primaryCustomer = primaryRole?.customer;

      return {
        id: contract.id,
        contractAreaSqm: contract.contract_area_sqm.toNumber(),
        locationDescription: contract.location_description,
        customer: primaryCustomer
          ? {
              id: primaryCustomer.id,
              name: primaryCustomer.name,
              nameKana: primaryCustomer.name_kana,
              phoneNumber: primaryCustomer.phone_number,
            }
          : null,
        // 販売契約情報（ContractPlotに統合済み）
        contractDate: contract.contract_date,
        price: contract.price.toNumber(),
        paymentStatus: contract.payment_status,
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
