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
        physicalPlot: {
          select: {
            plot_number: true,
            area_name: true,
            area_sqm: true,
            status: true,
          },
        },
        saleContractRoles: {
          where: { deleted_at: null },
          include: {
            customer: {
              select: {
                id: true,
                name: true,
                name_kana: true,
                phone_number: true,
                address: true,
              },
            },
          },
        },
        managementFee: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    const plotList = contractPlots.map((contractPlot) => {
      // 次回請求日の計算（last_billing_monthから1ヶ月後を計算）
      let nextBillingDate: Date | null = null;
      if (contractPlot.managementFee?.last_billing_month) {
        const match = contractPlot.managementFee.last_billing_month.match(/(\d{4})年(\d{1,2})月/);
        if (match && match[1] && match[2]) {
          const year = parseInt(match[1]);
          const month = parseInt(match[2]);
          const nextDate = new Date(year, month, 1); // 次の月の1日
          nextBillingDate = nextDate;
        }
      }

      // 主契約者（role='contractor'）を取得（後方互換性のため）
      const primaryRole = contractPlot.saleContractRoles?.find(
        (role) => role.role === 'contractor'
      );
      const primaryCustomer = primaryRole?.customer;

      return {
        // 契約区画情報
        id: contractPlot.id,
        contractAreaSqm: contractPlot.contract_area_sqm.toNumber(),
        locationDescription: contractPlot.location_description,

        // 物理区画情報（表示用）
        plotNumber: contractPlot.physicalPlot.plot_number,
        areaName: contractPlot.physicalPlot.area_name,
        physicalPlotAreaSqm: contractPlot.physicalPlot.area_sqm.toNumber(),
        physicalPlotStatus: contractPlot.physicalPlot.status,

        // 販売契約情報（ContractPlotに統合済み）
        contractDate: contractPlot.contract_date,
        price: contractPlot.price.toNumber(),
        paymentStatus: contractPlot.payment_status,

        // 顧客情報（主契約者のみ - 後方互換性）
        customerName: primaryCustomer?.name || null,
        customerNameKana: primaryCustomer?.name_kana || null,
        customerPhoneNumber: primaryCustomer?.phone_number || null,
        customerAddress: primaryCustomer?.address || null,
        customerRole: primaryRole?.role || null,

        // 全ての役割情報（リスト表示用の最小限情報）
        roles:
          contractPlot.saleContractRoles?.map((role) => ({
            role: role.role,
            customer: {
              id: role.customer.id,
              name: role.customer.name,
            },
          })) || [],

        // 料金情報
        nextBillingDate,
        managementFee: contractPlot.managementFee?.management_fee || null,

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
