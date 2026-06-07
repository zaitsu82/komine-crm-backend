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
 * - 終了顧客（t_danka.del_flg=2）に紐づく旧入金（約35件）は取り込まない
 *   （業務確認 2026-06-07 Q19。空き器契約への誤リンク防止も兼ねる）
 * - charge (担当者 TANCD) は staff_in_charge 文字列に保持
 *   （Staff FK にはしない。レガシー側は数値、新側は文字列で運用前提）
 */
export const stepPayment: MigrationStep = {
  name: 'payment',
  dependsOn: ['billing'],
  async run({ prisma, logger, idMaps, dryRun }) {
    // dry-run でも resume 用に再構築（読み取り専用・冪等、full dry-run では no-op）。
    // billing は同一 run の step10 が dry-run で placeholder を入れるため、billing→payment の
    // 順で --only 実行すれば assertIdMapsReady を通せる。
    await rebuildIdMap(prisma, idMaps, 'customer', logger);
    await rebuildIdMap(prisma, idMaps, 'contractPlot', logger);
    await rebuildIdMap(prisma, idMaps, 'billing', logger);
    assertIdMapsReady('payment', idMaps, ['billing', 'contractPlot', 'customer']);

    // 業務確認（2026-06-07 Q19）: もう使っていない区画あての昔の入金記録は「取り込まない」。
    // 終了顧客は step04 で Customer として取り込まれるが（is_terminated=true）、その旧入金が
    // grave_cd 経由で空き器契約（vacant ContractPlot）へ誤リンクされるのを danka 単位で防ぐ。
    const terminatedDanka = await legacyQuery<RowDataPacket & { danka_cd: number }>(
      `SELECT danka_cd FROM t_danka WHERE del_flg = 2`
    );
    const terminatedDankaSet = new Set(terminatedDanka.map((r) => r.danka_cd));

    const rows = await legacyQuery<NyukinRow>(
      `SELECT * FROM t_nyukin WHERE del_flg = 0 OR del_flg IS NULL`
    );

    let inserted = 0;
    let skipped = 0;
    let orphanCount = 0;
    let skipTerminatedDanka = 0;

    for (const row of rows) {
      if (row.danka_cd != null && terminatedDankaSet.has(row.danka_cd)) {
        logger.debug(
          { nyukin_cd: row.nyukin_cd, danka_cd: row.danka_cd },
          'Payment skipped: terminated customer (del_flg=2, 業務確認Q19: 取り込まない)'
        );
        skipped++;
        skipTerminatedDanka++;
        continue;
      }

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
        skip_terminated_danka: skipTerminatedDanka,
      },
    };
  },
};
