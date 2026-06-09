/**
 * 管理料の年度請求(Billing)自動生成サービス（#196）
 *
 * 管理料は「毎年・年度末(3月)に1年分を請求する定期課金」が基本モデル（実データで確認:
 * management_fees.billing_month は 3 が最多、入金も 2026 まで毎年ほぼ一定で繰り返し発生）。
 * 設定テーブル(ManagementFee)はあるが請求(Billing)が未起票だと「未入金・管理料あり・請求タブ空」
 * になるため、対象年度の管理料 Billing を設定から冪等に生成する。
 *
 * 対象: contract_status=active かつ管理料設定(amount 解釈可)を持つ契約区画。
 * 冪等: 同一区画・同一カテゴリ(management_fee)・同一 use_start_year の請求が既にあればスキップ。
 * 前納ガード: ManagementFee.billing_years > 1（5年/10年一括前納）は二重請求回避のため既定でスキップし
 *   ログに出す（前納の次回請求年判定は業務確認が必要なため、既定では自動起票しない）。
 *   includePrepaid=true で対象に含められる。
 *
 * 使用料(usage_fee)は契約時一括のため本バッチの対象外。
 */
import { PrismaClient, ContractStatus, BillingCategory } from '@prisma/client';
import { recalculateContractPlotPaymentStatus } from '../plots/services/paymentStatusService';

/** billing_month 未設定時の既定（年度末 3 月。実データで最多）。 */
export const DEFAULT_BILLING_MONTH = 3;

export interface GenerateManagementBillingOptions {
  /** 対象年度（西暦・use_start_year に入る） */
  targetYear: number;
  /** true で実際に Billing を作成。false は dry-run（件数のみ算出） */
  apply: boolean;
  /** 複数年一括前納(billing_years>1)も対象に含める（既定 false=二重請求回避でスキップ） */
  includePrepaid?: boolean;
}

export interface GenerateManagementBillingResult {
  targetYear: number;
  scanned: number;
  created: number;
  skippedExisting: number;
  skippedPrepaid: number;
  skippedNoAmount: number;
  skippedNoCustomer: number;
  createdPlotIds: string[];
}

/** 文字列の管理料(VarChar)から金額intを取り出す。数字以外を除去。0/解釈不能は null。 */
export function parseFeeAmount(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** billing_month(VarChar)から 1..12 の月を取り出す。範囲外/未設定は既定 3 月。 */
export function parseBillingMonth(raw: string | null | undefined): number {
  if (raw == null) return DEFAULT_BILLING_MONTH;
  const n = parseInt(raw.replace(/[^\d]/g, ''), 10);
  return n >= 1 && n <= 12 ? n : DEFAULT_BILLING_MONTH;
}

/** billing_years(VarChar)から請求年数を取り出す。未設定/0/解釈不能は 1（年次）。 */
export function parseBillingYears(raw: string | null | undefined): number {
  if (raw == null) return 1;
  const n = parseInt(raw.replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export async function generateManagementFeeBillings(
  prisma: PrismaClient,
  opts: GenerateManagementBillingOptions
): Promise<GenerateManagementBillingResult> {
  const { targetYear, apply, includePrepaid = false } = opts;
  const result: GenerateManagementBillingResult = {
    targetYear,
    scanned: 0,
    created: 0,
    skippedExisting: 0,
    skippedPrepaid: 0,
    skippedNoAmount: 0,
    skippedNoCustomer: 0,
    createdPlotIds: [],
  };

  const contracts = await prisma.contractPlot.findMany({
    where: {
      deleted_at: null,
      contract_status: ContractStatus.active,
      managementFee: { is: { deleted_at: null } },
    },
    select: {
      id: true,
      managementFee: {
        select: { management_fee: true, billing_month: true, billing_years: true },
      },
      saleContractRoles: {
        where: { deleted_at: null, role: { in: ['contractor', 'applicant'] } },
        select: { role: true, customer_id: true },
      },
      // 対象年度の管理料請求が既にあるか（冪等判定）
      billings: {
        where: {
          deleted_at: null,
          category: BillingCategory.management_fee,
          use_start_year: targetYear,
        },
        select: { id: true },
      },
    },
  });

  for (const c of contracts) {
    result.scanned++;
    const mf = c.managementFee;
    if (!mf) continue;

    const amount = parseFeeAmount(mf.management_fee);
    if (amount == null) {
      result.skippedNoAmount++;
      continue;
    }

    // 冪等: 対象年度の管理料請求が既にあればスキップ
    if (c.billings.length > 0) {
      result.skippedExisting++;
      continue;
    }

    // 前納ガード: 複数年一括は既定で対象外（二重請求回避）
    if (parseBillingYears(mf.billing_years) > 1 && !includePrepaid) {
      result.skippedPrepaid++;
      continue;
    }

    // 請求先顧客は契約者優先・なければ申込者
    const roles = c.saleContractRoles;
    const target =
      roles.find((r) => r.role === 'contractor') ?? roles.find((r) => r.role === 'applicant');
    if (!target) {
      result.skippedNoCustomer++;
      continue;
    }

    const month = parseBillingMonth(mf.billing_month);
    const billingDate = new Date(Date.UTC(targetYear, month - 1, 1));

    if (apply) {
      await prisma.$transaction(async (tx) => {
        await tx.billing.create({
          data: {
            contract_plot_id: c.id,
            customer_id: target.customer_id,
            category: BillingCategory.management_fee,
            amount,
            use_start_year: targetYear,
            use_end_year: targetYear,
            billing_years: 1,
            target_month: month,
            billing_date: billingDate,
            status: 'billed',
          },
        });
        // 請求が増えたので派生 payment_status を再計算（#162）
        await recalculateContractPlotPaymentStatus(tx, c.id);
      });
    }

    result.created++;
    result.createdPlotIds.push(c.id);
  }

  return result;
}
