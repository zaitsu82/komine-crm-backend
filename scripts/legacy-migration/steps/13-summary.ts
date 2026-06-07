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
 *
 * 注意: customers は終了顧客（del_flg=2 由来、is_terminated=true、#129）と
 * 別人申込者（legacy_applicant_danka_cd、#221）を含むためベースライン 3,487 を上回る。
 * terminated_customers（新旧）で del_flg=2 分を別掲して突き合わせる。
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
      terminatedCustomerCount,
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
      // 終了顧客（del_flg=2 由来、#129）の取り込み件数検証用
      prisma.customer.count({ where: { deleted_at: null, is_terminated: true } }),
      prisma.billing.aggregate({
        where: { category: 'usage_fee', deleted_at: null },
        _sum: { amount: true },
      }),
      prisma.billing.aggregate({
        where: { category: 'management_fee', deleted_at: null },
        _sum: { amount: true },
      }),
    ]);

    // payment_status の分布（#162 backfill の検証用）
    const paymentStatusGroups = await prisma.contractPlot.groupBy({
      by: ['payment_status'],
      where: { deleted_at: null },
      _count: { _all: true },
    });
    const paymentStatusDist = paymentStatusGroups.reduce<Record<string, number>>((acc, g) => {
      acc[g.payment_status] = g._count._all;
      return acc;
    }, {});

    // レガシー側のベースライン
    interface LegacyCountsRow {
      physical: number;
      customer: number;
      customer_terminated: number;
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
         (SELECT COUNT(*) FROM t_danka WHERE del_flg=2) AS customer_terminated,
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
        terminated_customers: terminatedCustomerCount,
        staff: staffCount,
        usage_fee_total: Number(usageFeeTotal._sum.amount ?? 0),
        management_fee_total: Number(managementFeeTotal._sum.amount ?? 0),
        payment_status_distribution: paymentStatusDist,
      },
      legacy: {
        physical_plots: Number(legacy?.physical ?? 0),
        customers: Number(legacy?.customer ?? 0),
        terminated_customers: Number(legacy?.customer_terminated ?? 0),
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
