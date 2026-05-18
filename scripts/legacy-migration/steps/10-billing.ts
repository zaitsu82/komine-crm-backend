import type { BillingCategory, BillingRecordStatus } from '@prisma/client';
import type { RowDataPacket } from 'mysql2/promise';

import { legacyQuery } from '../legacyDb';
import { rebuildIdMap } from '../lib/id-map-loader';
import { assertIdMapsReady } from '../lib/invariants';
import { cleanStr, parseLegacyDate } from '../transforms';
import type { MigrationStep } from '../types';

interface SeikyuRow extends RowDataPacket {
  seikyu_cd: number;
  danka_cd: number;
  grave_cd: number;
  use_start_year: number | null;
  contract_date: number | null;
  terminate_flg: number | null;
  use_end: number | null;
  terminate_date: number | null;
  target_month: number | null;
  seikyu_years: number | null;
  seikyu_kingaku: number | null;
  seikyu_date: number | null;
  nyukin_goukei: number | null;
  last_nyukin_date: number | null;
  tekiyou_kubun: number | null;
  seikyu_kubun: number | null;
  memo: string | null;
}

/**
 * seikyu_kubun → BillingCategory（業務確認済 2026-05-12）
 *   20280001 → usage_fee (9,392件・62.3億)
 *   20280002 → management_fee (2,616件・5.7億)
 *   20280000 → other (1件・0円)
 */
function mapBillingCategory(kubun: number | null): BillingCategory {
  if (kubun === 20280001) return 'usage_fee';
  if (kubun === 20280002) return 'management_fee';
  return 'other';
}

/**
 * terminate_flg + 入金状況 → BillingRecordStatus（業務確認済 2026-05-12）
 *   terminate_flg=0 or NULL → active 系 (請求状況に応じて pending/billed/partial_paid/paid/overdue)
 *   terminate_flg=1 → terminated
 *
 * 厳密な overdue 判定は別バッチで行う前提。ここでは入金額ベースで決める。
 */
function mapBillingStatus(
  terminateFlg: number | null,
  amount: number,
  paidAmount: number
): BillingRecordStatus {
  if (terminateFlg === 1) return 'terminated';
  if (paidAmount <= 0) return amount > 0 ? 'billed' : 'pending';
  if (paidAmount >= amount) return 'paid';
  return 'partial_paid';
}

/**
 * t_seikyu → Billing
 *
 * 除外条件:
 *   - del_flg=1
 *   - 請求年が 1939 以前（霊園は 1991 年開園、8 件の異常値: 1870 ×2 + 1931 + 1935 ×2 + 1936 ×2 + 1939）
 *
 * 設計上の注意:
 *   - status は入金集計後の値を入れる
 *   - terminated boolean は terminate_flg=1 のみ
 */
export const stepBilling: MigrationStep = {
  name: 'billing',
  dependsOn: ['customer', 'contractPlot'],
  async run({ prisma, logger, idMaps, dryRun }) {
    if (!dryRun) {
      await rebuildIdMap(prisma, idMaps, 'customer', logger);
      await rebuildIdMap(prisma, idMaps, 'contractPlot', logger);
    }
    assertIdMapsReady('billing', idMaps, ['customer', 'contractPlot']);

    const rows = await legacyQuery<SeikyuRow>(
      `SELECT * FROM t_seikyu WHERE del_flg = 0 OR del_flg IS NULL`
    );

    let inserted = 0;
    let skipped = 0;
    let prePivotExcluded = 0;
    let skipNoCustomer = 0;
    let skipNoContractPlot = 0;
    let skipNoBoth = 0;
    let skipExisting = 0;

    for (const row of rows) {
      // 1939 以前の異常値除外
      const seikyuYear = row.seikyu_date ? Math.floor(row.seikyu_date / 10000) : null;
      if (seikyuYear !== null && seikyuYear < 1940) {
        prePivotExcluded++;
        skipped++;
        continue;
      }

      const customerId = idMaps.customer.get(row.danka_cd);
      const contractPlotId = idMaps.contractPlot.get(row.grave_cd);
      if (!customerId || !contractPlotId) {
        logger.debug(
          { seikyu_cd: row.seikyu_cd, danka_cd: row.danka_cd, grave_cd: row.grave_cd },
          'Billing skipped: customer/contract plot not mapped (status=NULL contract?)'
        );
        skipped++;
        if (!customerId && !contractPlotId) skipNoBoth++;
        else if (!customerId) skipNoCustomer++;
        else skipNoContractPlot++;
        continue;
      }

      const amount = row.seikyu_kingaku ?? 0;
      const paidAmount = row.nyukin_goukei ?? 0;

      if (dryRun) {
        idMaps.billing.set(row.seikyu_cd, `dry-billing-${row.seikyu_cd}`);
        inserted++;
        continue;
      }

      // 冪等性
      const existing = await prisma.billing.findUnique({
        where: { legacy_seikyu_cd: row.seikyu_cd },
      });
      if (existing) {
        idMaps.billing.set(row.seikyu_cd, existing.id);
        skipped++;
        skipExisting++;
        continue;
      }

      const billing = await prisma.billing.create({
        data: {
          contract_plot_id: contractPlotId,
          customer_id: customerId,
          category: mapBillingCategory(row.seikyu_kubun),
          use_start_year: row.use_start_year ?? null,
          use_end_year: row.use_end ?? null,
          target_month: row.target_month ?? null,
          billing_years: row.seikyu_years ?? null,
          amount,
          contract_date: parseLegacyDate(row.contract_date),
          billing_date: parseLegacyDate(row.seikyu_date),
          paid_amount: paidAmount,
          last_payment_date: parseLegacyDate(row.last_nyukin_date),
          terminated: row.terminate_flg === 1,
          terminated_date: parseLegacyDate(row.terminate_date),
          status: mapBillingStatus(row.terminate_flg, amount, paidAmount),
          application_type: row.tekiyou_kubun ?? null,
          billing_type: row.seikyu_kubun ?? null,
          notes: cleanStr(row.memo),
          legacy_seikyu_cd: row.seikyu_cd,
        },
      });
      idMaps.billing.set(row.seikyu_cd, billing.id);
      inserted++;
    }

    return {
      inserted,
      skipped,
      notes: {
        source_rows: rows.length,
        pre_1940_excluded: prePivotExcluded,
        skip_no_customer: skipNoCustomer,
        skip_no_contract_plot: skipNoContractPlot,
        skip_no_both: skipNoBoth,
        skip_existing: skipExisting,
      },
    };
  },
};
