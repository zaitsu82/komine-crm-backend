/**
 * ゆうちょ連携: 請求データ集約サービス
 *
 * ContractPlot.ManagementFee と CollectiveBurial を集約し、
 * ゆうちょ自動払込み用の請求対象データを返す。
 */

import { PaymentStatus } from '@prisma/client';
import prisma from '../db/prisma';
import { getRequestLogger } from '../utils/logger';
import type { YuchoBillingItem, YuchoBillingResponse } from '../validations/yuchoValidation';
import { isExportableBillingItem } from './yuchoCsv';

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
 * 文字列の管理料金額を整数(円)に変換。"10,000" や "10000円" などの表記を許容。
 *
 * 金額は円単位の正整数であるべきため、数字以外（ハイフン等）は除去する（#212）。
 * 旧実装はハイフン・小数を温存していたため、'-1000'→-1000（負額）が
 * ゆうちょ振替の引落金額に出力されうる問題があった。
 * - 全角数字は半角へ正規化して扱う（#279: 全角金額が 0 円扱いになり振替対象から
 *   無言で除外されるのを防ぐ）
 * - 小数表記は整数部のみ採用する（#275: 小数点だけを除去すると '3.6'→'36' に
 *   桁結合して 10 倍の引落金額になるため）
 * 数字以外を含む値は異常データ検知のため warn ログを出す（黙って出力しない）。
 */
const parseManagementFeeAmount = (value: string | null | undefined, sourceId?: string): number => {
  if (!value) return 0;
  // 全角数字 → 半角（#279）
  const halfWidth = value.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  // 桁区切りカンマと円表記のみ正常系として無警告で除去
  const normalized = halfWidth.replace(/[,，円\s]/g, '');
  // 小数表記は整数部のみ（#275）
  const integerPart = normalized.split('.')[0] ?? '';
  const cleaned = integerPart.replace(/[^\d]/g, '');
  if (cleaned !== normalized) {
    getRequestLogger().warn(
      { managementFeeId: sourceId, rawValue: value },
      '管理料金額に数字以外の文字が含まれています（整数部の数字のみ抽出して処理）'
    );
  }
  if (!cleaned) return 0;
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? 0 : num;
};

type PayerCustomer = {
  id: string;
  name: string;
  name_kana: string;
  bank_name: string | null;
  branch_name: string | null;
  account_type: string | null;
  account_number: string | null;
  account_holder: string | null;
};

/**
 * 契約者(役割: contractor)を最優先、無ければ申込者(applicant)を返す。
 */
const pickPayer = (
  roles: Array<{ role: string; customer: PayerCustomer | null }>
): PayerCustomer | null => {
  const contractor = roles.find((r) => r.role === 'contractor' && r.customer);
  if (contractor) return contractor.customer;
  const applicant = roles.find((r) => r.role === 'applicant' && r.customer);
  return applicant?.customer ?? null;
};

/**
 * Customer の振込先カラムから YuchoBillingItem.billingInfo を組み立てる。
 * 主要フィールド（bank_name / branch_name / account_number）が全て空の場合は null を返す。
 * （Zengin CSV のデータ行生成判定に使われる）
 */
const buildBillingInfo = (payer: PayerCustomer | null): YuchoBillingItem['billingInfo'] => {
  if (!payer) return null;
  if (!payer.bank_name && !payer.branch_name && !payer.account_number) return null;
  return {
    bankName: payer.bank_name,
    branchName: payer.branch_name,
    accountType: payer.account_type,
    accountNumber: payer.account_number,
    accountHolder: payer.account_holder,
  };
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
    contract_status: 'active' as const,
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
              customer: true,
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

    const amount = parseManagementFeeAmount(fee.management_fee, fee.id);
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
      displayNumber: fee.contractPlot.physicalPlot.display_number,
      areaName: fee.contractPlot.physicalPlot.area_name,
      contractDate: fee.contractPlot.contract_date?.toISOString().split('T')[0] ?? '',
      customerId: payer?.id ?? null,
      customerName: payer?.name ?? null,
      customerNameKana: payer?.name_kana ?? null,
      billingAmount: amount,
      billingStatus: fee.contractPlot.payment_status,
      scheduledDate,
      billingMonth,
      billingInfo: buildBillingInfo(payer),
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
              customer: true,
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
        displayNumber: b.contractPlot.physicalPlot.display_number,
        areaName: b.contractPlot.physicalPlot.area_name,
        contractDate: b.contractPlot.contract_date?.toISOString().split('T')[0] ?? '',
        customerId: payer?.id ?? null,
        customerName: payer?.name ?? null,
        customerNameKana: payer?.name_kana ?? null,
        billingAmount: b.billing_amount ?? 0,
        billingStatus: b.billing_status,
        scheduledDate,
        billingMonth,
        billingInfo: buildBillingInfo(payer),
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

  // CSV（振替ファイル）へ実際に出力される項目と、口座未登録で除外される項目を分離。
  // exportableCount は buildZenginCsv のデータ行数と一致する（同一 predicate を共用）。
  const exportableItems = items.filter(isExportableBillingItem);
  const excludedNoAccountCount = items.filter(
    (i) => i.billingAmount > 0 && !isExportableBillingItem(i)
  ).length;

  const summary = {
    totalCount: items.length,
    totalAmount: items.reduce((sum, i) => sum + i.billingAmount, 0),
    exportableCount: exportableItems.length,
    exportableAmount: exportableItems.reduce((sum, i) => sum + i.billingAmount, 0),
    excludedNoAccountCount,
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
