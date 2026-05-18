/// <reference types="node" />
/**
 * dev DB のレガシー由来データを確認する一時スクリプト
 */

import 'dotenv/config';

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

async function main(): Promise<void> {
  const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL'] });
  const prisma = new PrismaClient({ adapter });

  try {
    const [
      totalCustomers,
      legacyCustomers,
      totalStaff,
      legacyStaff,
      totalPhysicalPlots,
      legacyPlotNumberPattern,
      totalContractPlots,
      legacyContractPlots,
      totalRelationshipMaster,
      legacyRelationshipMaster,
      totalBuriedPerson,
      totalFamilyContact,
      totalBilling,
      totalPayment,
    ] = await Promise.all([
      prisma.customer.count(),
      prisma.customer.count({ where: { legacy_danka_cd: { not: null } } }),
      prisma.staff.count(),
      prisma.staff.count({ where: { supabase_uid: { startsWith: 'legacy-tancd-' } } }),
      prisma.physicalPlot.count(),
      prisma.physicalPlot.count({ where: { plot_number: { startsWith: 'legacy-' } } }),
      prisma.contractPlot.count(),
      prisma.contractPlot.count({ where: { legacy_grave_cd: { not: null } } }),
      prisma.relationshipMaster.count(),
      prisma.relationshipMaster.count({ where: { code: { startsWith: '2009-' } } }),
      prisma.buriedPerson.count(),
      prisma.familyContact.count(),
      prisma.billing.count(),
      prisma.payment.count(),
    ]);

    // eslint-disable-next-line no-console
    console.log('=== 全件 vs レガシー由来件数 ===');
    // eslint-disable-next-line no-console
    console.table({
      Customer: { total: totalCustomers, legacy: legacyCustomers },
      Staff: { total: totalStaff, legacy: legacyStaff },
      PhysicalPlot: { total: totalPhysicalPlots, legacy: legacyPlotNumberPattern },
      ContractPlot: { total: totalContractPlots, legacy: legacyContractPlots },
      RelationshipMaster: { total: totalRelationshipMaster, legacy: legacyRelationshipMaster },
      BuriedPerson: { total: totalBuriedPerson, legacy: '(legacy_* なし、全件で判別)' },
      FamilyContact: { total: totalFamilyContact, legacy: '(legacy_* なし、全件で判別)' },
      Billing: { total: totalBilling, legacy: '(legacy_seikyu_cd で判別可)' },
      Payment: { total: totalPayment, legacy: '(legacy_nyukin_cd で判別可)' },
    });

    if (legacyPlotNumberPattern > 0) {
      const leftover = await prisma.physicalPlot.findMany({
        where: { plot_number: { startsWith: 'legacy-' } },
        select: { id: true, plot_number: true, area_name: true, created_at: true },
      });
      // eslint-disable-next-line no-console
      console.log('\n=== legacy-* で始まる残り PhysicalPlot ===');
      // eslint-disable-next-line no-console
      console.table(leftover);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
