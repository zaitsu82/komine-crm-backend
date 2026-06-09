/// <reference types="node" />
/**
 * 管理料の年度請求(Billing)自動生成バッチ（#196）
 *
 * 管理料設定(ManagementFee)から対象年度の管理料 Billing を冪等に生成する。
 * 詳細ロジックは src/billings/managementFeeBillingService.ts を参照。
 *
 * 使い方:
 *   npm run billing:generate-management -- --year=2026             # dry-run（件数のみ）
 *   npm run billing:generate-management -- --year=2026 --apply     # 実際に生成
 *   npm run billing:generate-management -- --year=2026 --apply --include-prepaid
 *     （複数年一括前納の契約も含める。既定は二重請求回避でスキップ）
 *
 * 冪等: 同一区画・management_fee・同一 use_start_year の請求が既にあれば再実行でも作らない。
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { generateManagementFeeBillings } from '../src/billings/managementFeeBillingService';

const APPLY = process.argv.includes('--apply');
const INCLUDE_PREPAID = process.argv.includes('--include-prepaid');

function parseYearArg(): number {
  const arg = process.argv.find((a) => a.startsWith('--year='));
  const year = arg ? parseInt(arg.slice('--year='.length), 10) : NaN;
  if (!Number.isFinite(year) || year < 1990 || year > 2100) {
    throw new Error('--year=YYYY を 1990〜2100 で指定してください（例: --year=2026）');
  }
  return year;
}

async function main(): Promise<void> {
  const targetYear = parseYearArg();
  const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL'] });
  const prisma = new PrismaClient({ adapter });

  console.log(
    `[billing:generate-management] year=${targetYear} apply=${APPLY} includePrepaid=${INCLUDE_PREPAID}`
  );

  try {
    const result = await generateManagementFeeBillings(prisma, {
      targetYear,
      apply: APPLY,
      includePrepaid: INCLUDE_PREPAID,
    });

    console.log(
      JSON.stringify(
        {
          ...result,
          createdPlotIds: `${result.createdPlotIds.length} 件（省略）`,
        },
        null,
        2
      )
    );

    if (!APPLY) {
      console.log('\n（dry-run。--apply で実際に Billing を生成します）');
    }
    if (result.skippedPrepaid > 0 && !INCLUDE_PREPAID) {
      console.log(
        `\n⚠️ 複数年一括前納の契約 ${result.skippedPrepaid} 件をスキップしました（二重請求回避）。` +
          ' 前納の次回請求年を確認のうえ、必要なら --include-prepaid で対象化してください。'
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('ERROR', e);
  process.exitCode = 1;
});
