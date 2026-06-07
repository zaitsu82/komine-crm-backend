/**
 * 合祀請求予定日のバックフィルスクリプト（#164）
 *
 * 請求起点を「埋葬上限到達日」から「契約日」へ変更したことに伴い、
 * 旧ロジック下で billing_scheduled_date が null のままの合祀情報を
 * 契約日起点（contract_date + validity_period_years）で埋める。
 *
 * - billing_scheduled_date が **null の行のみ**対象（手動の例外設定や
 *   旧ロジックで設定済みの値は上書きしない）
 * - 契約日が未設定の区画はスキップ（契約日設定時に updatePlot が再計算する）
 *
 * 使い方:
 *   npx ts-node scripts/backfill-collective-burial-schedule.ts           # dry-run（対象の表示のみ）
 *   npx ts-node scripts/backfill-collective-burial-schedule.ts --apply   # 実際に更新
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

import { resolveBillingScheduledDate } from '../src/collective-burials/utils';

const APPLY = process.argv.includes('--apply');

export async function backfillCollectiveBurialSchedule(
  prisma: PrismaClient,
  apply: boolean = APPLY
): Promise<{
  scanned: number;
  updated: number;
  skippedNoContractDate: number;
}> {
  const targets = await prisma.collectiveBurial.findMany({
    where: {
      deleted_at: null,
      billing_scheduled_date: null,
      contractPlot: { deleted_at: null },
    },
    include: {
      contractPlot: { select: { contract_date: true } },
    },
  });

  let updated = 0;
  let skippedNoContractDate = 0;

  for (const cb of targets) {
    const scheduled = resolveBillingScheduledDate(
      cb.contractPlot.contract_date,
      cb.validity_period_years
    );
    if (!scheduled) {
      skippedNoContractDate++;
      console.log(`  skip (契約日未設定): collective_burial=${cb.id}`);
      continue;
    }

    console.log(
      `  ${apply ? 'update' : 'would update'}: collective_burial=${cb.id} ` +
        `billing_scheduled_date=${scheduled.toISOString().split('T')[0]} ` +
        `(契約日 + ${cb.validity_period_years}年)`
    );
    if (apply) {
      await prisma.collectiveBurial.update({
        where: { id: cb.id },
        data: { billing_scheduled_date: scheduled },
      });
    }
    updated++;
  }

  return { scanned: targets.length, updated, skippedNoContractDate };
}

async function main(): Promise<void> {
  const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL'] });
  const prisma = new PrismaClient({ adapter });

  console.log(`合祀請求予定日バックフィル（#164、${APPLY ? 'APPLY' : 'dry-run'}）`);
  try {
    const result = await backfillCollectiveBurialSchedule(prisma);
    console.log(
      `完了: 対象 ${result.scanned} 件 / ${APPLY ? '更新' : '更新予定'} ${result.updated} 件 / ` +
        `契約日未設定スキップ ${result.skippedNoContractDate} 件`
    );
    if (!APPLY && result.updated > 0) {
      console.log('実際に更新するには --apply を付けて再実行してください。');
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
