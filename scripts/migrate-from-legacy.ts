/// <reference types="node" />
/**
 * レガシーDB → 新システム 一括移行スクリプト
 *
 * 使い方:
 *   npm run migrate:legacy                      # 全ステップ実行
 *   npm run migrate:legacy -- --dry-run         # Prisma 書き込みなしで件数だけ確認
 *   npm run migrate:legacy -- --only=billing    # 単一ステップのみ実行
 *   npm run migrate:legacy -- --only=billing,payment,summary
 *   npm run migrate:legacy -- --truncate        # 投入前に新DB側を全 TRUNCATE（破壊的）
 *
 * 環境変数:
 *   LEGACY_MYSQL_HOST / PORT / USER / PASSWORD / DATABASE — レガシー側
 *   DATABASE_URL                                          — 新システム側（Prisma）
 *
 * 設計方針 (query_result/MIGRATION_STATUS.md 参照):
 *   - 現状DB優先、新システム側を変更する
 *   - status=NULL の m_bochi 106 件は移行時除外
 *   - 1939 以前の請求 4 件は除外
 *   - m_tana は移行対象外
 *   - 文字コードは utf8mb4 で読み込み（MySQL 側で自動変換）
 *
 * 冪等性:
 *   各ステップで legacy_*_cd または ユニークキー で既存チェック → 既存ならスキップ
 *   --truncate を渡せば事前に全テーブル空にして再投入可能
 */

import 'dotenv/config';

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

import { closeLegacyPool } from './legacy-migration/legacyDb';
import { logger } from './legacy-migration/logger';
import { createIdMaps } from './legacy-migration/idMap';
import { InvariantViolationError } from './legacy-migration/lib/invariants';
import { stepMasters } from './legacy-migration/steps/01-masters';
import { stepStaff } from './legacy-migration/steps/02-staff';
import { stepPhysicalPlot } from './legacy-migration/steps/03-physical-plot';
import { stepCustomer } from './legacy-migration/steps/04-customer';
import { stepContractPlot } from './legacy-migration/steps/05-contract-plot';
import { stepSaleContractRole } from './legacy-migration/steps/06-sale-contract-role';
import { stepFamilyContact } from './legacy-migration/steps/07-family-contact';
import { stepBuriedPerson } from './legacy-migration/steps/08-buried-person';
import { stepConstructionInfo } from './legacy-migration/steps/09-construction-info';
import { stepBilling } from './legacy-migration/steps/10-billing';
import { stepPayment } from './legacy-migration/steps/11-payment';
import { stepPaymentStatus } from './legacy-migration/steps/12-payment-status';
import { stepSummary } from './legacy-migration/steps/13-summary';
import type {
  MigrationContext,
  MigrationStep,
  MigrationStepResult,
} from './legacy-migration/types';

const ALL_STEPS: MigrationStep[] = [
  stepMasters,
  stepStaff,
  stepPhysicalPlot,
  stepCustomer,
  stepContractPlot,
  stepSaleContractRole,
  stepFamilyContact,
  stepBuriedPerson,
  stepConstructionInfo,
  stepBilling,
  stepPayment,
  stepPaymentStatus,
  stepSummary,
];

interface CliOptions {
  dryRun: boolean;
  only: string[] | null;
  truncate: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = { dryRun: false, only: null, truncate: false };
  for (const arg of argv.slice(2)) {
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--truncate') opts.truncate = true;
    else if (arg.startsWith('--only=')) {
      opts.only = arg
        .replace('--only=', '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      logger.warn({ arg }, 'Unknown argument, ignoring');
    }
  }
  return opts;
}

function printHelp(): void {
  // eslint-disable-next-line no-console
  console.log(`Usage: npm run migrate:legacy -- [options]

Options:
  --dry-run             Prisma に書き込まず件数のみ確認
  --only=name[,name]    指定ステップのみ実行 (例: billing,payment,summary)
  --truncate            投入前に新DB側を全 TRUNCATE（破壊的、確認なし）
  --help, -h            このヘルプを表示

Steps (in execution order):
${ALL_STEPS.map((s, i) => `  ${i + 1}. ${s.name}`).join('\n')}
`);
}

/**
 * --truncate 指定時に新DB側を全テーブル空にする
 * FK 依存関係に注意した順序で削除する
 */
async function truncateNewDb(prisma: PrismaClient): Promise<void> {
  logger.warn('Truncating new DB (destructive)...');
  // 依存の深いものから順に削除
  await prisma.$transaction([
    prisma.payment.deleteMany(),
    prisma.billing.deleteMany(),
    prisma.constructionInfo.deleteMany(),
    prisma.buriedPerson.deleteMany(),
    prisma.familyContact.deleteMany(),
    prisma.saleContractRole.deleteMany(),
    prisma.gravestoneInfo.deleteMany(),
    prisma.usageFee.deleteMany(),
    prisma.managementFee.deleteMany(),
    prisma.contractPlot.deleteMany(),
    prisma.physicalPlot.deleteMany(),
    prisma.workInfo.deleteMany(),
    // 申込者として移行作成された Customer（legacy_applicant_danka_cd）も削除対象に含める（#221）
    prisma.customer.deleteMany({
      where: {
        OR: [{ legacy_danka_cd: { not: null } }, { legacy_applicant_danka_cd: { not: null } }],
      },
    }),
    prisma.relationshipMaster.deleteMany({ where: { code: { startsWith: '2009-' } } }),
    // Staff は admin が手動で作るので残す（supabase_uid 'legacy-tancd-*' のみ削除）
    prisma.staff.deleteMany({ where: { supabase_uid: { startsWith: 'legacy-tancd-' } } }),
  ]);
  logger.warn('Truncate complete');
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv);
  const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL'] });
  const prisma = new PrismaClient({ adapter });
  const idMaps = createIdMaps();

  const stepsToRun =
    opts.only === null ? ALL_STEPS : ALL_STEPS.filter((s) => opts.only!.includes(s.name));

  if (stepsToRun.length === 0) {
    logger.error({ requested: opts.only }, 'No matching steps found');
    process.exit(1);
  }

  logger.info(
    {
      dryRun: opts.dryRun,
      truncate: opts.truncate,
      steps: stepsToRun.map((s) => s.name),
    },
    'Starting legacy migration'
  );

  try {
    if (opts.truncate && !opts.dryRun) {
      await truncateNewDb(prisma);
    }

    const ctx: MigrationContext = {
      prisma,
      logger,
      idMaps,
      dryRun: opts.dryRun,
    };

    const results: Array<{ name: string; result: MigrationStepResult; ms: number }> = [];

    for (const step of stepsToRun) {
      const stepLogger = logger.child({ step: step.name });
      stepLogger.info('Starting step');
      const t0 = Date.now();
      try {
        const result = await step.run({ ...ctx, logger: stepLogger });
        const ms = Date.now() - t0;
        stepLogger.info({ ...result, ms }, 'Step complete');
        results.push({ name: step.name, result, ms });
      } catch (err) {
        const ms = Date.now() - t0;
        stepLogger.error({ err, ms }, 'Step failed');
        throw err;
      }
    }

    logger.info(
      {
        results: results.map((r) => ({
          step: r.name,
          inserted: r.result.inserted,
          skipped: r.result.skipped,
          notes: r.result.notes ?? {},
          ms: r.ms,
        })),
        total_ms: results.reduce((acc, r) => acc + r.ms, 0),
      },
      'All steps complete'
    );
  } finally {
    await prisma.$disconnect();
    await closeLegacyPool();
  }
}

main().catch((err) => {
  if (err instanceof InvariantViolationError) {
    logger.fatal({ msg: err.message }, 'Migration aborted: invariant violation');
  } else {
    logger.fatal({ err }, 'Migration failed');
  }
  process.exit(1);
});
