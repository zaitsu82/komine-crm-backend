/**
 * ゆうちょ連携: 請求データ集約サービス
 *
 * ContractPlot.ManagementFee と CollectiveBurial を集約し、
 * ゆうちょ自動払込み用の請求対象データを返す。
 */

import { PaymentStatus } from '@prisma/client';
import prisma from '../db/prisma';
import type { YuchoBillingItem, YuchoBillingResponse } from '../validations/yuchoValidation';

interface FetchParams {
  year: number;
  month?: number | undefined;
  category: 'management' | 'collective' | 'all';
  status: 'unbilled' | 'billed' | 'paid' | 'all';
}

/**
 * 月文字列(例: "4", "04", "4月")を数値に変換。失敗時は null。
 */
const parseBillingMonth = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const m = value.match(/(\d{1,2})/);
  if (!m) return null;
  const num = parseInt(m[1] ?? '0', 10);
  return num >= 1 && num <= 12 ? num : null;
};

/**
 * 文字列の管理料金額を整数(円)に変換。"10,000" や "10000円" などの表記も許容。
 */
const parseManagementFeeAmount = (value: string | null | undefined): number => {
  if (!value) return 0;
  const cleaned = value.replace(/[^\d.-]/g, '');
  if (!cleaned) return 0;
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num);
};

/**
 * 契約者(役割: contractor)を最優先、無ければ申込者(applicant)を返す。
 */
const pickPayer = (
  roles: Array<{
    role: string;
    customer: {
      id: string;
      name: string;
      name_kana: string;
      billingInfo: {
        bank_name: string | null;
        branch_name: string | null;
        account_type: string | null;
        account_number: string | null;
        account_holder: string | null;
      } | null;
    } | null;
  }>
) => {
  const contractor = roles.find((r) => r.role === 'contractor' && r.customer);
  if (contractor) return contractor.customer;
  const applicant = roles.find((r) => r.role === 'applicant' && r.customer);
  return applicant?.customer ?? null;
};

/**
 * 管理料の請求対象を取得
 */
const fetchManagementBillingItems = async (params: FetchParams): Promise<YuchoBillingItem[]> => {
  const { year, month, status } = params;

  // 管理料は契約区画ベース。billing_month が指定月と一致するものを抽出。
  // status フィルタは ContractPlot.payment_status をベースに判定。
  const paymentStatusFilter: PaymentStatus | { in: PaymentStatus[] } | undefined =
    status === 'unbilled'
      ? { in: [PaymentStatus.unpaid, PaymentStatus.partial_paid, PaymentStatus.overdue] }
      : status === 'paid'
        ? PaymentStatus.paid
        : status === 'billed'
          ? { in: [PaymentStatus.unpaid, PaymentStatus.partial_paid] }
          : undefined;

  const contractPlotWhere = {
    deleted_at: null,
    contract_status: { in: ['active' as const, 'reserved' as const] },
    ...(paymentStatusFilter ? { payment_status: paymentStatusFilter } : {}),
  };

  const fees = await prisma.managementFee.findMany({
    where: {
      deleted_at: null,
      contractPlot: contractPlotWhere,
    },
    include: {
      contractPlot: {
        include: {
          physicalPlot: true,
          saleContractRoles: {
            where: { deleted_at: null },
            include: {
              customer: {
                include: { billingInfo: true },
              },
            },
          },
        },
      },
    },
  });

  const items: YuchoBillingItem[] = [];
  for (const fee of fees) {
    const billingMonth = parseBillingMonth(fee.billing_month);
    // 月指定がある場合は一致するもののみ
    if (month != null && billingMonth !== month) continue;
    // 月指定なし(年単位)の場合は billing_month が設定されているもののみ
    if (month == null && billingMonth == null) continue;

    const amount = parseManagementFeeAmount(fee.management_fee);
    if (amount <= 0) continue;

    const payer = pickPayer(fee.contractPlot.saleContractRoles);

    // 請求予定日 = 指定年 + billing_month の月末
    const scheduledDate =
      billingMonth != null
        ? (new Date(Date.UTC(year, billingMonth, 0)).toISOString().split('T')[0] ?? null)
        : null;

    items.push({
      category: 'management',
      sourceId: fee.id,
      contractPlotId: fee.contract_plot_id,
      plotNumber: fee.contractPlot.physicalPlot.plot_number,
      areaName: fee.contractPlot.physicalPlot.area_name,
      contractDate: fee.contractPlot.contract_date.toISOString().split('T')[0] ?? '',
      customerId: payer?.id ?? null,
      customerName: payer?.name ?? null,
      customerNameKana: payer?.name_kana ?? null,
      billingAmount: amount,
      billingStatus: fee.contractPlot.payment_status,
      scheduledDate,
      billingMonth,
      billingInfo: payer?.billingInfo
        ? {
            bankName: payer.billingInfo.bank_name,
            branchName: payer.billingInfo.branch_name,
            accountType: payer.billingInfo.account_type,
            accountNumber: payer.billingInfo.account_number,
            accountHolder: payer.billingInfo.account_holder,
          }
        : null,
    });
  }

  return items;
};

/**
 * 合祀料金の請求対象を取得
 */
const fetchCollectiveBillingItems = async (params: FetchParams): Promise<YuchoBillingItem[]> => {
  const { year, month, status } = params;

  const billingStatusFilter =
    status === 'unbilled'
      ? 'pending'
      : status === 'billed'
        ? 'billed'
        : status === 'paid'
          ? 'paid'
          : undefined;

  const startDate =
    month != null ? new Date(Date.UTC(year, month - 1, 1)) : new Date(Date.UTC(year, 0, 1));
  const endDate =
    month != null ? new Date(Date.UTC(year, month, 1)) : new Date(Date.UTC(year + 1, 0, 1));

  const burials = await prisma.collectiveBurial.findMany({
    where: {
      deleted_at: null,
      billing_scheduled_date: { gte: startDate, lt: endDate },
      ...(billingStatusFilter ? { billing_status: billingStatusFilter } : {}),
      contractPlot: { deleted_at: null },
    },
    include: {
      contractPlot: {
        include: {
          physicalPlot: true,
          saleContractRoles: {
            where: { deleted_at: null },
            include: {
              customer: {
                include: { billingInfo: true },
              },
            },
          },
        },
      },
    },
  });

  return burials
    .filter((b) => (b.billing_amount ?? 0) > 0)
    .map((b) => {
      const payer = pickPayer(b.contractPlot.saleContractRoles);
      const scheduledDate = b.billing_scheduled_date?.toISOString().split('T')[0] ?? null;
      const billingMonth = b.billing_scheduled_date
        ? b.billing_scheduled_date.getUTCMonth() + 1
        : null;

      return {
        category: 'collective' as const,
        sourceId: b.id,
        contractPlotId: b.contract_plot_id,
        plotNumber: b.contractPlot.physicalPlot.plot_number,
        areaName: b.contractPlot.physicalPlot.area_name,
        contractDate: b.contractPlot.contract_date.toISOString().split('T')[0] ?? '',
        customerId: payer?.id ?? null,
        customerName: payer?.name ?? null,
        customerNameKana: payer?.name_kana ?? null,
        billingAmount: b.billing_amount ?? 0,
        billingStatus: b.billing_status,
        scheduledDate,
        billingMonth,
        billingInfo: payer?.billingInfo
          ? {
              bankName: payer.billingInfo.bank_name,
              branchName: payer.billingInfo.branch_name,
              accountType: payer.billingInfo.account_type,
              accountNumber: payer.billingInfo.account_number,
              accountHolder: payer.billingInfo.account_holder,
            }
          : null,
      };
    });
};

/**
 * 請求対象を取得して整形・サマリ計算する。
 */
export const fetchYuchoBillingData = async (params: FetchParams): Promise<YuchoBillingResponse> => {
  const promises: Array<Promise<YuchoBillingItem[]>> = [];
  if (params.category === 'management' || params.category === 'all') {
    promises.push(fetchManagementBillingItems(params));
  }
  if (params.category === 'collective' || params.category === 'all') {
    promises.push(fetchCollectiveBillingItems(params));
  }

  const results = await Promise.all(promises);
  const items = results.flat();

  // 区画番号順でソート
  items.sort((a, b) => a.plotNumber.localeCompare(b.plotNumber));

  const summary = {
    totalCount: items.length,
    totalAmount: items.reduce((sum, i) => sum + i.billingAmount, 0),
    byCategory: {
      management: {
        count: items.filter((i) => i.category === 'management').length,
        amount: items
          .filter((i) => i.category === 'management')
          .reduce((sum, i) => sum + i.billingAmount, 0),
      },
      collective: {
        count: items.filter((i) => i.category === 'collective').length,
        amount: items
          .filter((i) => i.category === 'collective')
          .reduce((sum, i) => sum + i.billingAmount, 0),
      },
    },
  };

  return {
    period: { year: params.year, month: params.month ?? null },
    items,
    summary,
  };
};
