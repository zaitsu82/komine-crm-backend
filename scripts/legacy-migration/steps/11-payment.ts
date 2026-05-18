import type { RowDataPacket } from 'mysql2/promise';

import { legacyQuery } from '../legacyDb';
import { rebuildIdMap } from '../lib/id-map-loader';
import { assertIdMapsReady, assertNoOrphanRows } from '../lib/invariants';
import { cleanStr, parseLegacyDate } from '../transforms';
import type { MigrationStep } from '../types';

interface NyukinRow extends RowDataPacket {
  nyukin_cd: number;
  seikyu_cd: number | null;
  danka_cd: number | null;
  grave_cd: number | null;
  nyukin_yotei_date: number | null;
  nyukin_yotei_fee: number | null;
  nyukin_date: number | null;
  nyukin_fee: number | null;
  fee_type: number | null;
  note: string | null;
  charge: number | null;
  tekiyou_kubun: number | null;
  seikyu_kubun: number | null;
}

/**
 * t_nyukin → Payment
 *
 * - 孤児入金 16 件（対応する t_seikyu なし）は billing_id=NULL で
 *   customer_id / contract_plot_id 直リンクで保存（推奨方針A）
 * - charge (担当者 TANCD) は staff_in_charge 文字列に保持
 *   （Staff FK にはしない。レガシー側は数値、新側は文字列で運用前提）
 */
export const stepPayment: MigrationStep = {
  name: 'payment',
  dependsOn: ['billing'],
  async run({ prisma, logger, idMaps, dryRun }) {
    if (!dryRun) {
      await rebuildIdMap(prisma, idMaps, 'customer', logger);
      await rebuildIdMap(prisma, idMaps, 'contractPlot', logger);
      await rebuildIdMap(prisma, idMaps, 'billing', logger);
    }
    assertIdMapsReady('payment', idMaps, ['billing', 'contractPlot', 'customer']);

    const rows = await legacyQuery<NyukinRow>(
      `SELECT * FROM t_nyukin WHERE del_flg = 0 OR del_flg IS NULL`
    );

    let inserted = 0;
    let skipped = 0;
    let orphanCount = 0;

    for (const row of rows) {
      const billingId = row.seikyu_cd != null ? (idMaps.billing.get(row.seikyu_cd) ?? null) : null;
      const customerId = row.danka_cd != null ? (idMaps.customer.get(row.danka_cd) ?? null) : null;
      const contractPlotId =
        row.grave_cd != null ? (idMaps.contractPlot.get(row.grave_cd) ?? null) : null;

      if (!billingId && !customerId && !contractPlotId) {
        logger.debug({ nyukin_cd: row.nyukin_cd }, 'Payment skipped: no linkable record');
        skipped++;
        continue;
      }
      if (!billingId) orphanCount++;

      if (dryRun) {
        inserted++;
        continue;
      }

      // 冪等性
      const existing = await prisma.payment.findUnique({
        where: { legacy_nyukin_cd: row.nyukin_cd },
      });
      if (existing) {
        skipped++;
        continue;
      }

      await prisma.payment.create({
        data: {
          billing_id: billingId,
          customer_id: customerId,
          contract_plot_id: contractPlotId,
          scheduled_date: parseLegacyDate(row.nyukin_yotei_date),
          scheduled_amount: row.nyukin_yotei_fee ?? null,
          payment_date: parseLegacyDate(row.nyukin_date),
          payment_amount: row.nyukin_fee ?? 0,
          fee_type: row.fee_type != null ? `legacy-fee-${row.fee_type}` : null,
          application_type: row.tekiyou_kubun ?? null,
          billing_type: row.seikyu_kubun ?? null,
          staff_in_charge: row.charge != null ? `legacy-tancd-${row.charge}` : null,
          notes: cleanStr(row.note),
          legacy_nyukin_cd: row.nyukin_cd,
        },
      });
      inserted++;
    }

    if (!dryRun) {
      await assertNoOrphanRows(
        prisma,
        'payment',
        {
          legacy_nyukin_cd: { not: null },
          billing_id: null,
          contract_plot_id: null,
          customer_id: null,
          deleted_at: null,
        },
        'payment',
        'legacy_nyukin_cd set but billing_id, contract_plot_id, customer_id all IS NULL (真の deeper orphan)'
      );
    }

    return {
      inserted,
      skipped,
      notes: {
        source_rows: rows.length,
        orphan_payments: orphanCount,
      },
    };
  },
};
