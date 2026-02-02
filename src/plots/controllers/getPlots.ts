/**
 * 契約区画一覧取得コントローラー
 * GET /api/v1/plots
 *
 * サーバーサイド検索・ページネーション対応
 */

import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../../db/prisma';

interface PlotSearchQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'available' | 'partially_sold' | 'sold_out';
  cemeteryType?: string;
}

/**
 * 契約区画一覧取得（ContractPlot中心）
 * サーバーサイド検索・ページネーション対応
 */
export const getPlots = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      cemeteryType,
    } = req.query as unknown as PlotSearchQuery;

    // ページネーション計算
    const skip = (page - 1) * limit;
    const take = limit;

    // 検索条件の構築
    const whereCondition: Prisma.ContractPlotWhereInput = {
      deleted_at: null,
    };

    // フリーテキスト検索（区画番号、顧客名、顧客名カナ、電話番号、住所）
    if (search) {
      whereCondition.OR = [
        {
          physicalPlot: {
            plot_number: { contains: search, mode: 'insensitive' },
          },
        },
        {
          saleContractRoles: {
            some: {
              deleted_at: null,
              customer: {
                OR: [
                  { name: { contains: search, mode: 'insensitive' } },
                  { name_kana: { contains: search, mode: 'insensitive' } },
                  { phone_number: { contains: search } },
                  { address: { contains: search, mode: 'insensitive' } },
                ],
              },
            },
          },
        },
      ];
    }

    // ステータスフィルター
    if (status) {
      whereCondition.physicalPlot = {
        ...((whereCondition.physicalPlot as object) || {}),
        status,
      };
    }

    // 墓地タイプフィルター
    if (cemeteryType) {
      whereCondition.physicalPlot = {
        ...((whereCondition.physicalPlot as object) || {}),
        area_name: { contains: cemeteryType, mode: 'insensitive' },
      };
    }

    // 総件数とデータを並列で取得
    const [total, contractPlots] = await Promise.all([
      prisma.contractPlot.count({ where: whereCondition }),
      prisma.contractPlot.findMany({
        where: whereCondition,
        skip,
        take,
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
      }),
    ]);

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
        price: contractPlot.price, // Int型なのでそのまま
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
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};
