/// <reference types="node" />
/**
 * レガシーDB移行検証ツール (issue #116)
 *
 * レガシー(MySQL) → 新システム(PostgreSQL/Prisma) のデータ移行が正しく行われたかを
 * 自動検証し、Markdown レポートを出力する。手動チェックでは 6,250 区画 / 12,000+ 請求
 * をカバーしきれないため、件数照合・金額照合・スポットチェックを自動化する。
 *
 * 検証内容:
 *   1. 件数照合   レガシー(del_flg=0) vs 新システム vs ベースライン
 *   2. 金額照合   使用料総額 / 管理料総額 / Billing 合計 / Payment 合計
 *   3. スポットチェック  legacy_* キーで突合し主要フィールド(金額)の一致を確認(PII非出力)
 *   4. レポート出力  query_result/migration_verification_YYYYMMDD.md
 *
 * 設計方針:
 *   - レガシー側は mysql2 (scripts/legacy-migration/legacyDb)、新側は Prisma を並行使用
 *   - PII を含むため、レポートは集計値・差異件数・レガシーコードのみ出力(生データはダンプしない)
 *   - CI 化はせず、移行スクリプト後に手動実行する
 *   - レガシー DB に接続できない場合は新側のみで検証を続行(--skip-legacy または接続失敗時)
 *
 * 実行:
 *   npx ts-node --transpile-only scripts/verify-migration.ts
 *   npx ts-node --transpile-only scripts/verify-migration.ts --sample-size=50 --out=/tmp/report.md
 *   npx ts-node --transpile-only scripts/verify-migration.ts --skip-legacy
 *   npm run verify:migration
 *
 * 必要な環境変数:
 *   DATABASE_URL                                          … 新システム(PostgreSQL)
 *   LEGACY_MYSQL_HOST / USER / DATABASE [/ PORT / PASSWORD] … レガシー(MySQL, --skip-legacy 時は不要)
 */

import 'dotenv/config';

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import type { RowDataPacket } from 'mysql2/promise';

import { closeLegacyPool, legacyCount, legacyQuery } from './legacy-migration/legacyDb';

// ---------------------------------------------------------------------------
// ベースライン（Query_result_A〜F / dry-run で確定済み）
//   confirmed: query_result/MIGRATION_STATUS.md「検証ベースライン」および
//   scripts/legacy-migration/steps/13-summary.ts と一致させること。
// ---------------------------------------------------------------------------
const BASELINE = {
  // レガシー側(del_flg=0)の確定件数
  legacyCounts: {
    physical_plots: 6250,
    customers: 3487,
    family_contacts: 2744,
    buried_persons: 6484,
  },
  // 移行後の期待件数(dry-run 実績。記録された skip を反映した値)
  insertedCounts: {
    relationship_master: 35,
    staff: 11,
    physical_plots: 6250,
    customers: 3487,
    contract_plots: 6144,
    sale_contract_roles: 6545,
    family_contacts: 2641,
    buried_persons: 6362,
    construction_infos: 233,
    billings: 11492,
    payments: 12876,
  },
  // 金額(円)
  amounts: {
    usage_fee_total: 1824851210, // 18.2 億
    management_fee_total: 555190595, // 5.5 億
  },
} as const;

// 使用料/管理料の seikyu_kubun コード（10-billing.ts の mapBillingCategory と一致）
const KUBUN_USAGE_FEE = 20280001;
const KUBUN_MANAGEMENT_FEE = 20280002;

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
interface Options {
  sampleSize: number;
  outPath: string;
  skipLegacy: boolean;
}

function parseArgs(argv: string[]): Options {
  let sampleSize = 30;
  let outPath = '';
  let skipLegacy = false;

  for (const arg of argv) {
    if (arg.startsWith('--sample-size=')) {
      const n = Number(arg.slice('--sample-size='.length));
      if (Number.isFinite(n) && n > 0) sampleSize = Math.floor(n);
    } else if (arg.startsWith('--out=')) {
      outPath = arg.slice('--out='.length);
    } else if (arg === '--skip-legacy') {
      skipLegacy = true;
    }
  }

  if (!outPath) {
    const now = new Date();
    const yyyymmdd =
      String(now.getFullYear()) +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0');
    outPath = resolve(process.cwd(), 'query_result', `migration_verification_${yyyymmdd}.md`);
  }
  return { sampleSize, outPath, skipLegacy };
}

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------
type Judgment = '✅' | '⚠️' | '❌';

/** 新件数とレガシー/ベースライン件数から判定する */
export function judgeCount(
  actual: number,
  legacy: number | null,
  expectedInserted: number | null,
  opts?: { allowGrowth?: boolean }
): Judgment {
  const reference = legacy ?? expectedInserted;
  if (reference == null) return '⚠️';
  if (reference > 0 && actual === 0) return '❌'; // 完全未投入
  if (reference > 0 && actual < reference * 0.5) return '❌'; // 大幅不足(投入失敗の疑い)
  // ベースラインがあれば ±2% を許容、なければレガシー比 90% 以上で OK
  const target = expectedInserted ?? reference;
  // 上振れ検出（#223）: 冪等性バグ等による重複投入（件数倍増）を見逃さない。
  // skip により target < legacy となるステップがあるため、上限基準は
  // target 単体でなく Math.max(target, reference) を取る（正常上限は通し、~2x は弾く）。
  // allowGrowth（#265/#267）: アプリ運用で移行後に正当に増えるテーブル
  // （マスタの手動追加等）は上振れを ❌ にせず下限チェックのみ行う。
  const upper = Math.max(target, reference);
  if (reference > 0 && actual > upper * 1.05) {
    if (!opts?.allowGrowth) return '❌';
    return '✅'; // 下限チェックは通過済み。正当な増加とみなす
  }
  const tolerance = Math.max(5, Math.round(target * 0.02));
  if (Math.abs(actual - target) <= tolerance) return '✅';
  if (actual >= reference * 0.9) return '✅';
  return '⚠️';
}

function judgeAmount(actual: number, baseline: number): Judgment {
  if (baseline === 0) return actual === 0 ? '✅' : '⚠️';
  const diffRatio = Math.abs(actual - baseline) / baseline;
  if (diffRatio === 0) return '✅';
  if (diffRatio <= 0.01) return '⚠️'; // 1% 以内の軽微差異
  return '❌';
}

const yen = (n: number): string => `${n.toLocaleString('ja-JP')} 円`;
const num = (n: number | null): string => (n == null ? 'N/A' : n.toLocaleString('ja-JP'));

async function legacySum(table: string, column: string, where: string): Promise<number> {
  const rows = await legacyQuery<RowDataPacket & { s: number | string | null }>(
    `SELECT COALESCE(SUM(\`${column}\`), 0) AS s FROM \`${table}\` WHERE ${where}`
  );
  return Number(rows[0]?.s ?? 0);
}

const ACTIVE = 'del_flg=0 OR del_flg IS NULL';
const ACTIVE_AND = (extra: string): string => `(del_flg=0 OR del_flg IS NULL) AND ${extra}`;
// 1940 年以前の異常請求を除外(10-billing.ts と同じ前提)
const POST_1940 = '(seikyu_date IS NULL OR FLOOR(seikyu_date / 10000) >= 1940)';

// ---------------------------------------------------------------------------
// 1. 件数照合
// ---------------------------------------------------------------------------
interface CountRow {
  label: string;
  legacyTable: string | null;
  legacy: number | null;
  actual: number;
  baselineLegacy: number | null;
  baselineInserted: number | null;
  judgment: Judgment;
}

async function reconcileCounts(prisma: PrismaClient, legacyOn: boolean): Promise<CountRow[]> {
  const [
    relationshipMaster,
    staff,
    physicalPlots,
    customers,
    terminatedCustomers,
    applicantCustomers,
    applicantRoles,
    contractPlots,
    saleContractRoles,
    familyContacts,
    buriedPersons,
    constructionInfos,
    billings,
    payments,
  ] = await Promise.all([
    prisma.relationshipMaster.count(),
    // 移行由来のみ（#267）: bootstrap admin 等の手動追加スタッフを混ぜると
    // ベースライン(11)超過で誤 ❌ になるため supabase_uid プレフィクスで絞る
    prisma.staff.count({
      where: { deleted_at: null, supabase_uid: { startsWith: 'legacy-tancd-' } },
    }),
    prisma.physicalPlot.count({ where: { deleted_at: null } }),
    // 契約者由来のみ（#265）: step06 の申込者展開 Customer（1:N）を混ぜると
    // ベースライン(t_danka=契約者のみ)超過で誤 ❌ になるため legacy_danka_cd で絞る。
    // 終了顧客（is_terminated、del_flg=2 由来 #129/PR#309）も legacy_danka_cd を持つが
    // レガシー参照値は del_flg=0 ベースのため除外し、別行で del_flg=2 と突き合わせる（#314）
    prisma.customer.count({
      where: { deleted_at: null, legacy_danka_cd: { not: null }, is_terminated: false },
    }),
    // 終了顧客（del_flg=2 由来、#129）。13-summary の terminated_customers と同じ粒度
    prisma.customer.count({ where: { deleted_at: null, is_terminated: true } }),
    // 申込者展開 Customer は別行で検証（applicant ロール数との整合）
    prisma.customer.count({
      where: { deleted_at: null, legacy_applicant_danka_cd: { not: null } },
    }),
    prisma.saleContractRole.count({ where: { role: 'applicant', deleted_at: null } }),
    prisma.contractPlot.count({ where: { deleted_at: null } }),
    prisma.saleContractRole.count(),
    prisma.familyContact.count({ where: { deleted_at: null } }),
    prisma.buriedPerson.count({ where: { deleted_at: null } }),
    prisma.constructionInfo.count({ where: { deleted_at: null } }),
    prisma.billing.count({ where: { deleted_at: null } }),
    prisma.payment.count({ where: { deleted_at: null } }),
  ]);

  // レガシー件数(既定 del_flg=0)。接続できない場合は null。
  const legacy = async (table: string, where?: string): Promise<number | null> => {
    if (!legacyOn) return null;
    return where ? legacyCount(table, where) : legacyCount(table);
  };

  const [
    legPhysical,
    legCustomer,
    legCustomerTerminated,
    legContract,
    legFamily,
    legBuried,
    legConstruction,
    legBilling,
    legPayment,
  ] = await Promise.all([
    legacy('m_bochi'),
    legacy('t_danka'),
    // 終了顧客のレガシー参照値（13-summary の customer_terminated と同じ条件 #314）
    legacy('t_danka', 'del_flg=2'),
    legacy('m_bochi'),
    legacy('t_family'),
    legacy('t_maisou'),
    legacy('t_foundlog'),
    legacy('t_seikyu'),
    legacy('t_nyukin'),
  ]);

  const b = BASELINE;
  const rows: CountRow[] = [
    {
      label: 'RelationshipMaster (続柄/方角/位置)',
      legacyTable: 'sykbnn',
      legacy: null, // 複数 KBNNO を含むため単純比較せず
      actual: relationshipMaster,
      baselineLegacy: null,
      baselineInserted: b.insertedCounts.relationship_master,
      // マスタは admin がアプリから追加しうるため上振れを許容（#265/#267 同根）
      judgment: judgeCount(relationshipMaster, null, b.insertedCounts.relationship_master, {
        allowGrowth: true,
      }),
    },
    {
      label: 'Staff (matant 由来のみ)',
      legacyTable: 'matant',
      legacy: null,
      actual: staff,
      baselineLegacy: null,
      baselineInserted: b.insertedCounts.staff,
      judgment: judgeCount(staff, null, b.insertedCounts.staff),
    },
    {
      label: 'PhysicalPlot',
      legacyTable: 'm_bochi',
      legacy: legPhysical,
      actual: physicalPlots,
      baselineLegacy: b.legacyCounts.physical_plots,
      baselineInserted: b.insertedCounts.physical_plots,
      judgment: judgeCount(physicalPlots, legPhysical, b.insertedCounts.physical_plots),
    },
    {
      label: 'Customer (契約者: legacy_danka_cd 有・終了顧客除く)',
      legacyTable: 't_danka',
      legacy: legCustomer,
      actual: customers,
      baselineLegacy: b.legacyCounts.customers,
      baselineInserted: b.insertedCounts.customers,
      judgment: judgeCount(customers, legCustomer, b.insertedCounts.customers),
    },
    {
      // 終了顧客（del_flg=2 由来、#129/PR#309）。契約者行とは粒度を分けて
      // レガシー del_flg=2 件数と直接突き合わせる（#314）。
      // 確定ベースラインは未取得（約150件）のため、レガシー接続なし時は ⚠️ となる
      label: 'Customer (終了顧客: is_terminated)',
      legacyTable: 't_danka (del_flg=2)',
      legacy: legCustomerTerminated,
      actual: terminatedCustomers,
      baselineLegacy: null,
      baselineInserted: null,
      judgment: judgeCount(terminatedCustomers, legCustomerTerminated, null),
    },
    {
      // 申込者展開（step06: applicant != contractor の場合の別 Customer）。
      // ベースライン件数を持たないため、applicant ロール数との整合で検証する:
      // 申込者 Customer は必ず applicant ロールに紐づくので、ロール数を超えたら
      // 重複生成（冪等性バグ）の疑い（#223 の検知目的を維持しつつ誤 ❌ を排除）。
      label: 'Customer (申込者展開: applicant ロール数以下であること)',
      legacyTable: 't_danka (request_*)',
      legacy: null,
      actual: applicantCustomers,
      baselineLegacy: null,
      baselineInserted: applicantRoles,
      judgment: applicantCustomers <= applicantRoles ? '✅' : '❌',
    },
    {
      label: 'ContractPlot',
      legacyTable: 'm_bochi (status 有効分)',
      legacy: legContract,
      actual: contractPlots,
      baselineLegacy: null,
      baselineInserted: b.insertedCounts.contract_plots,
      judgment: judgeCount(contractPlots, legContract, b.insertedCounts.contract_plots),
    },
    {
      label: 'SaleContractRole',
      legacyTable: 't_danka + m_bochi',
      legacy: null,
      actual: saleContractRoles,
      baselineLegacy: null,
      baselineInserted: b.insertedCounts.sale_contract_roles,
      judgment: judgeCount(saleContractRoles, null, b.insertedCounts.sale_contract_roles),
    },
    {
      label: 'FamilyContact (step07)',
      legacyTable: 't_family',
      legacy: legFamily,
      actual: familyContacts,
      baselineLegacy: b.legacyCounts.family_contacts,
      baselineInserted: b.insertedCounts.family_contacts,
      judgment: judgeCount(familyContacts, legFamily, b.insertedCounts.family_contacts),
    },
    {
      label: 'BuriedPerson (step08)',
      legacyTable: 't_maisou',
      legacy: legBuried,
      actual: buriedPersons,
      baselineLegacy: b.legacyCounts.buried_persons,
      baselineInserted: b.insertedCounts.buried_persons,
      judgment: judgeCount(buriedPersons, legBuried, b.insertedCounts.buried_persons),
    },
    {
      label: 'ConstructionInfo (step09)',
      legacyTable: 't_foundlog',
      legacy: legConstruction,
      actual: constructionInfos,
      baselineLegacy: null,
      baselineInserted: b.insertedCounts.construction_infos,
      judgment: judgeCount(constructionInfos, legConstruction, b.insertedCounts.construction_infos),
    },
    {
      label: 'Billing (step10)',
      legacyTable: 't_seikyu',
      legacy: legBilling,
      actual: billings,
      baselineLegacy: null,
      baselineInserted: b.insertedCounts.billings,
      judgment: judgeCount(billings, legBilling, b.insertedCounts.billings),
    },
    {
      label: 'Payment (step11)',
      legacyTable: 't_nyukin',
      legacy: legPayment,
      actual: payments,
      baselineLegacy: null,
      baselineInserted: b.insertedCounts.payments,
      judgment: judgeCount(payments, legPayment, b.insertedCounts.payments),
    },
  ];
  return rows;
}

// ---------------------------------------------------------------------------
// 2. 金額照合
// ---------------------------------------------------------------------------
interface AmountRow {
  label: string;
  actual: number;
  legacy: number | null;
  baseline: number | null;
  judgment: Judgment;
}

async function reconcileAmounts(prisma: PrismaClient, legacyOn: boolean): Promise<AmountRow[]> {
  const [usageAgg, mgmtAgg, billingAgg, paymentAgg] = await Promise.all([
    prisma.billing.aggregate({
      where: { category: 'usage_fee', deleted_at: null },
      _sum: { amount: true },
    }),
    prisma.billing.aggregate({
      where: { category: 'management_fee', deleted_at: null },
      _sum: { amount: true },
    }),
    prisma.billing.aggregate({ where: { deleted_at: null }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { deleted_at: null }, _sum: { payment_amount: true } }),
  ]);

  const newUsage = Number(usageAgg._sum.amount ?? 0);
  const newMgmt = Number(mgmtAgg._sum.amount ?? 0);
  const newBilling = Number(billingAgg._sum.amount ?? 0);
  const newPayment = Number(paymentAgg._sum.payment_amount ?? 0);

  let legUsage: number | null = null;
  let legMgmt: number | null = null;
  let legBilling: number | null = null;
  let legPayment: number | null = null;
  if (legacyOn) {
    [legUsage, legMgmt, legBilling, legPayment] = await Promise.all([
      legacySum(
        't_seikyu',
        'seikyu_kingaku',
        ACTIVE_AND(`seikyu_kubun = ${KUBUN_USAGE_FEE} AND ${POST_1940}`)
      ),
      legacySum(
        't_seikyu',
        'seikyu_kingaku',
        ACTIVE_AND(`seikyu_kubun = ${KUBUN_MANAGEMENT_FEE} AND ${POST_1940}`)
      ),
      legacySum('t_seikyu', 'seikyu_kingaku', ACTIVE),
      legacySum('t_nyukin', 'nyukin_fee', ACTIVE),
    ]);
  }

  return [
    {
      label: '使用料総額 (category=usage_fee)',
      actual: newUsage,
      legacy: legUsage,
      baseline: BASELINE.amounts.usage_fee_total,
      judgment: judgeAmount(newUsage, BASELINE.amounts.usage_fee_total),
    },
    {
      label: '管理料総額 (category=management_fee)',
      actual: newMgmt,
      legacy: legMgmt,
      baseline: BASELINE.amounts.management_fee_total,
      judgment: judgeAmount(newMgmt, BASELINE.amounts.management_fee_total),
    },
    {
      label: 'Billing 合計 (全 category)',
      actual: newBilling,
      legacy: legBilling,
      baseline: null,
      judgment: legBilling == null ? '⚠️' : judgeAmount(newBilling, legBilling),
    },
    {
      label: 'Payment 合計',
      actual: newPayment,
      legacy: legPayment,
      baseline: null,
      judgment: legPayment == null ? '⚠️' : judgeAmount(newPayment, legPayment),
    },
  ];
}

// ---------------------------------------------------------------------------
// 3. スポットチェック（PII 非出力。集計値・差異件数・レガシーコードのみ）
// ---------------------------------------------------------------------------
interface SpotResult {
  label: string;
  field: string;
  sampled: number;
  matched: number;
  mismatched: number;
  missingInLegacy: number;
  sampleMismatchCodes: number[]; // 差異のあったレガシーコード(PII ではない)
}

/** 件数から重複しないランダムオフセットを得る */
function randomOffset(total: number, take: number): number {
  const max = Math.max(0, total - take);
  return Math.floor(Math.random() * (max + 1));
}

async function spotCheckBilling(prisma: PrismaClient, sampleSize: number): Promise<SpotResult> {
  const total = await prisma.billing.count({
    where: { legacy_seikyu_cd: { not: null }, deleted_at: null },
  });
  const sample = await prisma.billing.findMany({
    where: { legacy_seikyu_cd: { not: null }, deleted_at: null },
    select: { legacy_seikyu_cd: true, amount: true },
    take: sampleSize,
    skip: randomOffset(total, sampleSize),
    orderBy: { legacy_seikyu_cd: 'asc' },
  });

  const result: SpotResult = {
    label: 'Billing.amount ↔ t_seikyu.seikyu_kingaku',
    field: 'amount',
    sampled: sample.length,
    matched: 0,
    mismatched: 0,
    missingInLegacy: 0,
    sampleMismatchCodes: [],
  };
  if (sample.length === 0) return result;

  const codes = sample.map((s) => s.legacy_seikyu_cd as number);
  const legacyRows = await legacyQuery<
    RowDataPacket & { seikyu_cd: number; seikyu_kingaku: number | null }
  >(`SELECT seikyu_cd, seikyu_kingaku FROM t_seikyu WHERE seikyu_cd IN (${codes.join(',')})`);
  const legacyMap = new Map<number, number>();
  for (const r of legacyRows) legacyMap.set(Number(r.seikyu_cd), Number(r.seikyu_kingaku ?? 0));

  for (const row of sample) {
    const code = row.legacy_seikyu_cd as number;
    if (!legacyMap.has(code)) {
      result.missingInLegacy++;
      continue;
    }
    if (legacyMap.get(code) === row.amount) {
      result.matched++;
    } else {
      result.mismatched++;
      if (result.sampleMismatchCodes.length < 10) result.sampleMismatchCodes.push(code);
    }
  }
  return result;
}

async function spotCheckPayment(prisma: PrismaClient, sampleSize: number): Promise<SpotResult> {
  const total = await prisma.payment.count({
    where: { legacy_nyukin_cd: { not: null }, deleted_at: null },
  });
  const sample = await prisma.payment.findMany({
    where: { legacy_nyukin_cd: { not: null }, deleted_at: null },
    select: { legacy_nyukin_cd: true, payment_amount: true },
    take: sampleSize,
    skip: randomOffset(total, sampleSize),
    orderBy: { legacy_nyukin_cd: 'asc' },
  });

  const result: SpotResult = {
    label: 'Payment.payment_amount ↔ t_nyukin.nyukin_fee',
    field: 'payment_amount',
    sampled: sample.length,
    matched: 0,
    mismatched: 0,
    missingInLegacy: 0,
    sampleMismatchCodes: [],
  };
  if (sample.length === 0) return result;

  const codes = sample.map((s) => s.legacy_nyukin_cd as number);
  const legacyRows = await legacyQuery<
    RowDataPacket & { nyukin_cd: number; nyukin_fee: number | null }
  >(`SELECT nyukin_cd, nyukin_fee FROM t_nyukin WHERE nyukin_cd IN (${codes.join(',')})`);
  const legacyMap = new Map<number, number>();
  for (const r of legacyRows) legacyMap.set(Number(r.nyukin_cd), Number(r.nyukin_fee ?? 0));

  for (const row of sample) {
    const code = row.legacy_nyukin_cd as number;
    if (!legacyMap.has(code)) {
      result.missingInLegacy++;
      continue;
    }
    if (legacyMap.get(code) === row.payment_amount) {
      result.matched++;
    } else {
      result.mismatched++;
      if (result.sampleMismatchCodes.length < 10) result.sampleMismatchCodes.push(code);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// レポート生成
// ---------------------------------------------------------------------------
function buildReport(args: {
  generatedAt: Date;
  legacyOn: boolean;
  sampleSize: number;
  counts: CountRow[];
  amounts: AmountRow[];
  spots: SpotResult[];
}): { markdown: string; hasError: boolean } {
  const { generatedAt, legacyOn, sampleSize, counts, amounts, spots } = args;

  const countErrors = counts.filter((c) => c.judgment === '❌').length;
  const amountErrors = amounts.filter((a) => a.judgment === '❌').length;
  const spotErrors = spots.filter((s) => s.mismatched > 0 || s.missingInLegacy > 0).length;
  const hasError = countErrors + amountErrors + spotErrors > 0;

  const lines: string[] = [];
  lines.push('# レガシー移行検証レポート');
  lines.push('');
  lines.push(`- 生成日時: ${generatedAt.toISOString()}`);
  lines.push(`- レガシーDB照合: ${legacyOn ? '有効' : '**無効（--skip-legacy または接続不可）**'}`);
  lines.push(`- スポットチェック標本数: ${sampleSize}`);
  lines.push(
    `- 総合判定: ${hasError ? '❌ 不一致あり（要調査）' : '✅ 重大な不一致なし'}` +
      `（件数❌ ${countErrors} / 金額❌ ${amountErrors} / スポット異常 ${spotErrors}）`
  );
  lines.push('');

  // 1. 件数照合
  lines.push('## 1. 件数照合');
  lines.push('');
  lines.push(
    '| 判定 | エンティティ | レガシー(del_flg=0) | 新システム | 期待(投入後) | 差分(新-レガシー) |'
  );
  lines.push('|:---:|---|---:|---:|---:|---:|');
  for (const c of counts) {
    const diff = c.legacy == null ? 'N/A' : (c.actual - c.legacy).toLocaleString('ja-JP');
    lines.push(
      `| ${c.judgment} | ${c.label} | ${num(c.legacy)} | ${num(c.actual)} | ${num(c.baselineInserted)} | ${diff} |`
    );
  }
  lines.push('');
  lines.push(
    '> ❌ = 新システム件数が 0、期待の 50% 未満（投入失敗の疑い）、または期待の 105% 超（重複投入の疑い）。⚠️ = 許容差を超える乖離。✅ = ベースライン ±2% またはレガシー比 90% 以上。'
  );
  lines.push('');

  // 2. 金額照合
  lines.push('## 2. 金額照合');
  lines.push('');
  lines.push('| 判定 | 項目 | 新システム | レガシー | ベースライン |');
  lines.push('|:---:|---|---:|---:|---:|');
  for (const a of amounts) {
    lines.push(
      `| ${a.judgment} | ${a.label} | ${yen(a.actual)} | ${a.legacy == null ? 'N/A' : yen(a.legacy)} | ${a.baseline == null ? '—' : yen(a.baseline)} |`
    );
  }
  lines.push('');
  lines.push(
    '> 使用料/管理料の総額は確定ベースラインと照合（±1% 超で ❌）。Billing/Payment 合計はレガシー総額と照合。'
  );
  lines.push('');

  // 3. スポットチェック
  lines.push('## 3. スポットチェック（主要フィールド突合）');
  lines.push('');
  if (!legacyOn) {
    lines.push('> レガシーDB照合が無効のためスキップしました。');
  } else {
    lines.push('| 対象 | 標本 | 一致 | 不一致 | レガシー欠落 | 不一致コード(先頭最大10) |');
    lines.push('|---|---:|---:|---:|---:|---|');
    for (const s of spots) {
      const codes = s.sampleMismatchCodes.length > 0 ? s.sampleMismatchCodes.join(', ') : '—';
      lines.push(
        `| ${s.label} | ${s.sampled} | ${s.matched} | ${s.mismatched} | ${s.missingInLegacy} | ${codes} |`
      );
    }
    lines.push('');
    lines.push(
      '> ランダム抽出した新レコードを legacy_* キーでレガシーと突合し、金額の一致を確認。個人情報は出力せず、差異件数とレガシーコードのみ記録。'
    );
  }
  lines.push('');

  // フッター
  lines.push('---');
  lines.push('');
  lines.push(
    '本レポートは `scripts/verify-migration.ts` により自動生成。再実行: `npm run verify:migration`。'
  );
  lines.push(
    'ベースラインは `scripts/legacy-migration/steps/13-summary.ts` および MIGRATION_STATUS.md と整合。'
  );
  lines.push('');

  return { markdown: lines.join('\n'), hasError };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const generatedAt = new Date();

  const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL'] });
  const prisma = new PrismaClient({ adapter });

  // レガシー接続の可否を判定（--skip-legacy 明示 or 接続失敗で新側のみに切替）
  let legacyOn = !opts.skipLegacy;
  if (legacyOn) {
    try {
      await legacyCount('m_bochi');
    } catch (err) {
      legacyOn = false;
      console.warn(
        `[warn] レガシーDB に接続できませんでした。新システム側のみで検証を続行します: ${(err as Error).message}`
      );
    }
  }

  try {
    console.log('[info] 件数照合を実行中...');
    const counts = await reconcileCounts(prisma, legacyOn);

    console.log('[info] 金額照合を実行中...');
    const amounts = await reconcileAmounts(prisma, legacyOn);

    let spots: SpotResult[] = [];
    if (legacyOn) {
      console.log('[info] スポットチェックを実行中...');
      spots = [
        await spotCheckBilling(prisma, opts.sampleSize),
        await spotCheckPayment(prisma, opts.sampleSize),
      ];
    }

    const { markdown, hasError } = buildReport({
      generatedAt,
      legacyOn,
      sampleSize: opts.sampleSize,
      counts,
      amounts,
      spots,
    });

    mkdirSync(dirname(opts.outPath), { recursive: true });
    writeFileSync(opts.outPath, markdown, 'utf-8');

    console.log(`\n[done] 検証レポートを出力しました: ${opts.outPath}`);
    console.log(`[done] 総合判定: ${hasError ? '❌ 不一致あり（要調査）' : '✅ 重大な不一致なし'}`);
    // 不一致がある場合は CI 等で検知できるよう非ゼロ終了
    process.exitCode = hasError ? 1 : 0;
  } finally {
    await prisma.$disconnect();
    if (legacyOn) await closeLegacyPool();
  }
}

// テストから judgeCount 等を import できるよう、直接実行時のみ main を起動する
if (require.main === module) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
