import { legacyQuery } from '../legacyDb';
import type { MigrationStep } from '../types';

/**
 * 移行後の検証クエリ
 *
 * ベースライン（Query_result_A〜F から確定済み）:
 *   - PhysicalPlot: 6,250
 *   - Customer: 3,487
 *   - FamilyContact: 2,744
 *   - BuriedPerson: 6,484
 *   - 使用料総額: 1,824,851,210 円
 *   - 管理料総額: 555,190,595 円
 *
 * 新DB側の集計と突き合わせて差分を表示する。
 */
export const stepSummary: MigrationStep = {
  name: 'summary',
  async run({ prisma, logger, dryRun }) {
    const [
      physicalPlotCount,
      contractPlotCount,
      customerCount,
      familyContactCount,
      buriedPersonCount,
      constructionInfoCount,
      billingCount,
      paymentCount,
      staffCount,
      orphanPaymentCount,
      usageFeeTotal,
      managementFeeTotal,
    ] = await Promise.all([
      prisma.physicalPlot.count({ where: { deleted_at: null } }),
      prisma.contractPlot.count({ where: { deleted_at: null } }),
      prisma.customer.count({ where: { deleted_at: null } }),
      prisma.familyContact.count({ where: { deleted_at: null } }),
      prisma.buriedPerson.count({ where: { deleted_at: null } }),
      prisma.constructionInfo.count({ where: { deleted_at: null } }),
      prisma.billing.count({ where: { deleted_at: null } }),
      prisma.payment.count({ where: { deleted_at: null } }),
      prisma.staff.count({ where: { deleted_at: null } }),
      prisma.payment.count({ where: { deleted_at: null, billing_id: null } }),
      prisma.billing.aggregate({
        where: { category: 'usage_fee', deleted_at: null },
        _sum: { amount: true },
      }),
      prisma.billing.aggregate({
        where: { category: 'management_fee', deleted_at: null },
        _sum: { amount: true },
      }),
    ]);

    // レガシー側のベースライン
    interface LegacyCountsRow {
      physical: number;
      customer: number;
      family: number;
      buried: number;
      billing: number;
      payment: number;
    }
    const legacyCounts = await legacyQuery<
      LegacyCountsRow & { constructor: { name: 'RowDataPacket' } }
    >(
      `SELECT
         (SELECT COUNT(*) FROM m_bochi WHERE del_flg=0 OR del_flg IS NULL) AS physical,
         (SELECT COUNT(*) FROM t_danka WHERE del_flg=0 OR del_flg IS NULL) AS customer,
         (SELECT COUNT(*) FROM t_family WHERE del_flg=0 OR del_flg IS NULL) AS family,
         (SELECT COUNT(*) FROM t_maisou WHERE del_flg=0 OR del_flg IS NULL) AS buried,
         (SELECT COUNT(*) FROM t_seikyu WHERE del_flg=0 OR del_flg IS NULL) AS billing,
         (SELECT COUNT(*) FROM t_nyukin WHERE del_flg=0 OR del_flg IS NULL) AS payment`
    );

    const legacy = legacyCounts[0];

    const summary = {
      dryRun,
      new: {
        physical_plots: physicalPlotCount,
        contract_plots: contractPlotCount,
        customers: customerCount,
        family_contacts: familyContactCount,
        buried_persons: buriedPersonCount,
        construction_infos: constructionInfoCount,
        billings: billingCount,
        payments: paymentCount,
        orphan_payments: orphanPaymentCount,
        staff: staffCount,
        usage_fee_total: Number(usageFeeTotal._sum.amount ?? 0),
        management_fee_total: Number(managementFeeTotal._sum.amount ?? 0),
      },
      legacy: {
        physical_plots: Number(legacy?.physical ?? 0),
        customers: Number(legacy?.customer ?? 0),
        family_contacts: Number(legacy?.family ?? 0),
        buried_persons: Number(legacy?.buried ?? 0),
        billings: Number(legacy?.billing ?? 0),
        payments: Number(legacy?.payment ?? 0),
      },
      baseline: {
        // Query_result_A〜F から確定済み
        physical_plots: 6250,
        customers: 3487,
        family_contacts: 2744,
        buried_persons: 6484,
        usage_fee_total: 1824851210,
        management_fee_total: 555190595,
      },
    };

    logger.info(summary, 'Migration summary');
    return { inserted: 0, skipped: 0, notes: summary as unknown as Record<string, number> };
  },
};
