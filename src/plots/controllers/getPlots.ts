/**
 * 契約区画一覧取得コントローラー
 * GET /api/v1/plots
 */

import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 契約区画一覧取得（ContractPlot中心）
 */
export const getPlots = async (_req: Request, res: Response) => {
  try {
    const contractPlots = await prisma.contractPlot.findMany({
      where: {
        deleted_at: null, // 論理削除されていない契約のみ
      },
      include: {
        PhysicalPlot: {
          select: {
            plot_number: true,
            area_name: true,
            area_sqm: true,
            status: true,
          },
        },
        SaleContract: {
          include: {
            Customer: {
              select: {
                name: true,
                name_kana: true,
                phone_number: true,
                address: true,
              },
            },
          },
        },
        ManagementFee: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    const plotList = contractPlots.map((contractPlot) => {
      // 次回請求日の計算（last_billing_monthから1ヶ月後を計算）
      let nextBillingDate: Date | null = null;
      if (contractPlot.ManagementFee?.last_billing_month) {
        const match = contractPlot.ManagementFee.last_billing_month.match(/(\d{4})年(\d{1,2})月/);
        if (match && match[1] && match[2]) {
          const year = parseInt(match[1]);
          const month = parseInt(match[2]);
          const nextDate = new Date(year, month, 1); // 次の月の1日
          nextBillingDate = nextDate;
        }
      }

      return {
        // 契約区画情報
        id: contractPlot.id,
        contractAreaSqm: contractPlot.contract_area_sqm.toNumber(),
        saleStatus: contractPlot.sale_status,
        locationDescription: contractPlot.location_description,

        // 物理区画情報（表示用）
        plotNumber: contractPlot.PhysicalPlot.plot_number,
        areaName: contractPlot.PhysicalPlot.area_name,
        physicalPlotAreaSqm: contractPlot.PhysicalPlot.area_sqm.toNumber(),
        physicalPlotStatus: contractPlot.PhysicalPlot.status,

        // 顧客情報（販売契約経由）
        customerName: contractPlot.SaleContract?.Customer.name || null,
        customerNameKana: contractPlot.SaleContract?.Customer.name_kana || null,
        customerPhoneNumber: contractPlot.SaleContract?.Customer.phone_number || null,
        customerAddress: contractPlot.SaleContract?.Customer.address || null,
        customerRole: contractPlot.SaleContract?.customer_role || null,

        // 契約情報
        contractDate: contractPlot.SaleContract?.contract_date || null,
        price: contractPlot.SaleContract?.price.toNumber() || null,
        paymentStatus: contractPlot.SaleContract?.payment_status || null,

        // 料金情報
        nextBillingDate,
        managementFee: contractPlot.ManagementFee?.management_fee || null,

        // メタ情報
        createdAt: contractPlot.created_at,
        updatedAt: contractPlot.updated_at,
      };
    });

    res.status(200).json({
      success: true,
      data: plotList,
    });
  } catch (error) {
    console.error('Error fetching contract plots:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '契約区画情報の取得に失敗しました',
      },
    });
  }
};
