/// <reference types="node" />
import 'dotenv/config';

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

async function main(): Promise<void> {
  const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL'] });
  const prisma = new PrismaClient({ adapter });

  try {
    const total = await prisma.payment.count();
    const withLegacy = await prisma.payment.count({
      where: { legacy_nyukin_cd: { not: null } },
    });
    const withBilling = await prisma.payment.count({
      where: { billing_id: { not: null } },
    });
    const withCustomer = await prisma.payment.count({
      where: { customer_id: { not: null } },
    });
    const withContractPlot = await prisma.payment.count({
      where: { contract_plot_id: { not: null } },
    });
    const noBillingNoContractPlot = await prisma.payment.count({
      where: { billing_id: null, contract_plot_id: null },
    });

    // eslint-disable-next-line no-console
    console.log('=== Payment 概況 ===');
    // eslint-disable-next-line no-console
    console.table({
      total,
      withLegacyNyukinCd: withLegacy,
      withBillingId: withBilling,
      withCustomerId: withCustomer,
      withContractPlotId: withContractPlot,
      'billing=null AND contract_plot=null': noBillingNoContractPlot,
    });

    // 作成日時の範囲
    const oldest = await prisma.payment.findFirst({
      orderBy: { created_at: 'asc' },
      select: { created_at: true, legacy_nyukin_cd: true },
    });
    const newest = await prisma.payment.findFirst({
      orderBy: { created_at: 'desc' },
      select: { created_at: true, legacy_nyukin_cd: true },
    });
    // eslint-disable-next-line no-console
    console.log('\n=== 作成日時範囲 ===');
    // eslint-disable-next-line no-console
    console.table({ oldest, newest });

    // 日時バケットで分布
    const sample = await prisma.payment.findMany({
      select: { created_at: true },
      orderBy: { created_at: 'asc' },
    });
    const buckets = new Map<string, number>();
    for (const r of sample) {
      const d = r.created_at;
      if (!d) continue;
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')}`;
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    // eslint-disable-next-line no-console
    console.log('\n=== 作成日時 hour バケット (UTC) ===');
    for (const [k, v] of [...buckets.entries()].sort()) {
      // eslint-disable-next-line no-console
      console.log(`${k}h  ${v}`);
    }

    // legacy_nyukin_cd の値の範囲
    const minMax = (await prisma.$queryRawUnsafe(
      'SELECT MIN(legacy_nyukin_cd) as min, MAX(legacy_nyukin_cd) as max FROM "Payment" WHERE legacy_nyukin_cd IS NOT NULL'
    )) as Array<{ min: number | bigint | null; max: number | bigint | null }>;
    // eslint-disable-next-line no-console
    console.log('\n=== legacy_nyukin_cd の範囲 ===');
    // eslint-disable-next-line no-console
    console.table(minMax[0]);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
