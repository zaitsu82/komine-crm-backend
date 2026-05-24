/**
 * マスタ初期データ投入スクリプト
 *
 * 標準マスタ7種の初期データを冪等に投入する。
 * code を unique キーとした insert-only（`skipDuplicates`）方式のため、
 * 何度実行しても既存レコードは上書きしない（マスタ管理画面での編集を保護する）。
 *
 * 対象マスタ（GitHub issue #46「対象マスタ8種」のうち、別系統で投入されるものを除く）:
 *   - 墓地区分 (cemetery_type_master)
 *   - 支払方法 (payment_method_master)
 *   - 税区分   (tax_type_master)
 *   - 計算方法 (calc_type_master)
 *   - 請求方法 (billing_type_master)
 *   - 宛先区分 (recipient_type_master)
 *   - 工事種別 (construction_type_master)
 *
 * 対象外（投入元が別にあるため、ここでは触らない）:
 *   - 区画名 (section_name_master) ......... issue #14 で別途対応
 *   - 続柄   (relationship_master) ......... レガシー移行 scripts/legacy-migration/steps/01-masters.ts
 *   - 工事業者 (contractor_master) ......... レガシー移行 + migration プレースホルダ
 *
 * 値の出典:
 *   - 墓地区分/支払方法/宛先区分/工事種別: frontend モック（masters.ts）を確定ベースラインとして採用（#46 方針）
 *   - 計算区分/税区分/請求区分: 旧システム sykbnn（KBNNO 2026/2027/2028）の意味に合わせて再定義（旧データ忠実移行）。
 *     migration step05 は旧int値をこの code に remap する（scripts/legacy-migration/steps/05-contract-plot.ts）。
 *   業務確定での値追加（クレカ等）は、このファイルへ追記して再実行すれば冪等に反映される。
 *
 * 実行方法:
 *   npm run seed:masters
 *
 * 必須環境変数:
 *   DATABASE_URL
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

interface MasterSeedRow {
  code: string;
  name: string;
  description?: string | null;
  sort_order?: number | null;
}

interface TaxTypeSeedRow extends MasterSeedRow {
  tax_rate: string | null;
}

const cemeteryType: MasterSeedRow[] = [
  { code: 'GENERAL', name: '一般墓地', description: '一般的な墓地', sort_order: 1 },
  { code: 'MEMORIAL', name: '永代供養墓', description: '永代供養用の墓地', sort_order: 2 },
  { code: 'TREE', name: '樹木葬', description: '樹木葬用の区画', sort_order: 3 },
];

const paymentMethod: MasterSeedRow[] = [
  { code: 'CASH', name: '現金払い', description: '現金での支払い', sort_order: 1 },
  { code: 'BANK_TRANSFER', name: '銀行振込', description: '銀行口座への振込', sort_order: 2 },
  { code: 'ACCOUNT_TRANSFER', name: '口座振替', description: '自動口座振替', sort_order: 3 },
];

// 税区分: 旧システム(sykbnn KBNNO=2027 税金区分)の意味に合わせ「内税/外税」。
// ※新システム初期設計の税率(10%/8%/非課税)ではない。旧データ忠実移行のため再定義。
//   tax_rate は内税/外税の概念では持たないため null（請求書の税率は document-form 側で別管理）。
const taxType: TaxTypeSeedRow[] = [
  { code: 'INCLUSIVE', name: '内税', description: '税込み', sort_order: 1, tax_rate: null },
  { code: 'EXCLUSIVE', name: '外税', description: '税抜き', sort_order: 2, tax_rate: null },
];

// 計算区分: 旧 sykbnn KBNNO=2026（0=面積×単価 / 1=任意設定）。code は既存と互換維持。
const calcType: MasterSeedRow[] = [
  { code: 'AREA', name: '面積×単価', description: '面積×単価で計算', sort_order: 1 },
  { code: 'FIXED', name: '任意設定', description: '金額を任意設定', sort_order: 2 },
];

// 請求区分: 旧 sykbnn KBNNO=2028（0=なし / 1=あり / 2=永代）。
const billingType: MasterSeedRow[] = [
  { code: 'NONE', name: 'なし', description: '請求なし', sort_order: 1 },
  { code: 'PRESENT', name: 'あり', description: '請求あり', sort_order: 2 },
  { code: 'PERPETUAL', name: '永代', description: '永代', sort_order: 3 },
];

const recipientType: MasterSeedRow[] = [
  { code: 'CONTRACTOR', name: '契約者', description: '契約者本人', sort_order: 1 },
  { code: 'SUCCESSOR', name: '承継者', description: '承継者', sort_order: 2 },
  { code: 'OTHER', name: 'その他', description: 'その他の受取人', sort_order: 3 },
];

const constructionType: MasterSeedRow[] = [
  { code: 'FOUNDATION', name: '基礎工事', description: '墓石の基礎工事', sort_order: 1 },
  { code: 'TOMBSTONE', name: '墓石設置', description: '墓石の設置工事', sort_order: 2 },
  { code: 'REMOVAL', name: '墓石撤去', description: '墓石の撤去工事', sort_order: 3 },
  { code: 'REPAIR', name: '修繕工事', description: '墓石の修繕', sort_order: 4 },
];

export interface MasterSeedSummary {
  master: string;
  inserted: number;
}

/**
 * 標準マスタ7種を冪等に投入する。
 * 既存 code はスキップ（skipDuplicates）するため上書きしない。
 */
export async function seedMasters(prisma: PrismaClient): Promise<MasterSeedSummary[]> {
  const summary: MasterSeedSummary[] = [];

  const cemetery = await prisma.cemeteryTypeMaster.createMany({
    data: cemeteryType,
    skipDuplicates: true,
  });
  summary.push({ master: 'cemetery_type_master', inserted: cemetery.count });

  const payment = await prisma.paymentMethodMaster.createMany({
    data: paymentMethod,
    skipDuplicates: true,
  });
  summary.push({ master: 'payment_method_master', inserted: payment.count });

  const tax = await prisma.taxTypeMaster.createMany({
    data: taxType,
    skipDuplicates: true,
  });
  summary.push({ master: 'tax_type_master', inserted: tax.count });

  const calc = await prisma.calcTypeMaster.createMany({
    data: calcType,
    skipDuplicates: true,
  });
  summary.push({ master: 'calc_type_master', inserted: calc.count });

  const billing = await prisma.billingTypeMaster.createMany({
    data: billingType,
    skipDuplicates: true,
  });
  summary.push({ master: 'billing_type_master', inserted: billing.count });

  const recipient = await prisma.recipientTypeMaster.createMany({
    data: recipientType,
    skipDuplicates: true,
  });
  summary.push({ master: 'recipient_type_master', inserted: recipient.count });

  const construction = await prisma.constructionTypeMaster.createMany({
    data: constructionType,
    skipDuplicates: true,
  });
  summary.push({ master: 'construction_type_master', inserted: construction.count });

  return summary;
}

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: process.env['DATABASE_URL'],
  });
  return new PrismaClient({ adapter });
}

async function main(): Promise<void> {
  if (!process.env['DATABASE_URL']) {
    throw new Error('DATABASE_URL が未設定です。.env を確認してください。');
  }

  const prisma = createPrismaClient();
  try {
    console.log('🌱 マスタ初期データを投入中...');
    const summary = await seedMasters(prisma);

    const total = summary.reduce((sum, s) => sum + s.inserted, 0);
    for (const s of summary) {
      console.log(`  ${s.master}: +${s.inserted} 件`);
    }
    console.log(`✅ マスタ投入完了（新規 ${total} 件 / 既存はスキップ）`);
  } finally {
    await prisma.$disconnect();
  }
}

// 直接実行されたときのみ main() を走らせる（テストから import しても実行されない）
if (require.main === module) {
  main().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`❌ ${message}`);
    process.exit(1);
  });
}
