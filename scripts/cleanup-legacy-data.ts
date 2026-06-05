/// <reference types="node" />
/**
 * dev DB から「レガシー由来データ」だけを安全に削除するスクリプト
 *
 * Phase 2 のクリーンスタート用。手動投入分（legacy_*_cd が NULL、または
 * supabase_uid / plot_number / code に legacy プレフィクスがない行）は残す。
 *
 * 削除対象（依存関係を考慮した順序、すべて legacy フィルタ付き）:
 *   1. Payment           : legacy_nyukin_cd IS NOT NULL
 *   2. Billing           : legacy_seikyu_cd IS NOT NULL
 *   3. ContractPlot      : legacy_grave_cd IS NOT NULL
 *      → Cascade で SaleContractRole / FamilyContact / BuriedPerson /
 *        ConstructionInfo / UsageFee / ManagementFee / GravestoneInfo /
 *        CollectiveBurial も自動削除
 *   4. Customer          : legacy_danka_cd IS NOT NULL
 *      → Cascade で WorkInfo 自動削除、FamilyContact.customer_id は SetNull
 *   5. PhysicalPlot      : plot_number LIKE 'legacy-%'
 *   6. Staff             : supabase_uid LIKE 'legacy-tancd-%'
 *   7. RelationshipMaster: code LIKE '2009-%'
 *
 * 使い方:
 *   npx ts-node --transpile-only scripts/cleanup-legacy-data.ts          # 件数表示のみ (dry-run)
 *   npx ts-node --transpile-only scripts/cleanup-legacy-data.ts --apply  # 実行
 */

import 'dotenv/config';

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL'] });
  const prisma = new PrismaClient({ adapter });

  try {
    const paymentWhere = { legacy_nyukin_cd: { not: null } } as const;
    const billingWhere = { legacy_seikyu_cd: { not: null } } as const;
    const contractPlotWhere = { legacy_grave_cd: { not: null } } as const;
    // 申込者として移行作成された Customer（legacy_applicant_danka_cd）も対象に含める（#221）
    const customerWhere = {
      OR: [{ legacy_danka_cd: { not: null } }, { legacy_applicant_danka_cd: { not: null } }],
    } as const;
    const physicalPlotWhere = { plot_number: { startsWith: 'legacy-' } } as const;
    const staffWhere = { supabase_uid: { startsWith: 'legacy-tancd-' } } as const;
    const relationshipMasterWhere = { code: { startsWith: '2009-' } } as const;

    // Cascade で消えるサブ要素も件数を見せる（参考表示用）
    const legacyContractPlotIds = await prisma.contractPlot.findMany({
      where: contractPlotWhere,
      select: { id: true },
    });
    const cpIdList = legacyContractPlotIds.map((r) => r.id);

    const before = {
      payment: await prisma.payment.count({ where: paymentWhere }),
      billing: await prisma.billing.count({ where: billingWhere }),
      saleContractRole_cascade: await prisma.saleContractRole.count({
        where: { contract_plot_id: { in: cpIdList } },
      }),
      familyContact_cascade: await prisma.familyContact.count({
        where: { contract_plot_id: { in: cpIdList } },
      }),
      buriedPerson_cascade: await prisma.buriedPerson.count({
        where: { contract_plot_id: { in: cpIdList } },
      }),
      constructionInfo_cascade: await prisma.constructionInfo.count({
        where: { contract_plot_id: { in: cpIdList } },
      }),
      contractPlot: await prisma.contractPlot.count({ where: contractPlotWhere }),
      customer: await prisma.customer.count({ where: customerWhere }),
      physicalPlot: await prisma.physicalPlot.count({ where: physicalPlotWhere }),
      staff: await prisma.staff.count({ where: staffWhere }),
      relationshipMaster: await prisma.relationshipMaster.count({ where: relationshipMasterWhere }),
    };

    // eslint-disable-next-line no-console
    console.log('=== 削除対象件数 (before) ===');
    // eslint-disable-next-line no-console
    console.table(before);
    // eslint-disable-next-line no-console
    console.log(
      '*_cascade は ContractPlot 削除時に Cascade で連動削除される件数（明示削除はしない）'
    );

    if (!apply) {
      // eslint-disable-next-line no-console
      console.log('\n--apply フラグがないので削除せず終了。実行するには --apply を付けて再度。');
      return;
    }

    // 依存関係を考慮した削除順序:
    //   Payment → Billing → ContractPlot (Cascade) → Customer → PhysicalPlot → Staff → RelationshipMaster
    // ContractPlot 削除で SaleContractRole/FamilyContact/BuriedPerson/ConstructionInfo/
    // UsageFee/ManagementFee/GravestoneInfo/CollectiveBurial は自動削除される（onDelete: Cascade）
    const result = await prisma.$transaction(
      async (tx) => {
        const payment = await tx.payment.deleteMany({ where: paymentWhere });
        const billing = await tx.billing.deleteMany({ where: billingWhere });
        const contractPlot = await tx.contractPlot.deleteMany({ where: contractPlotWhere });
        const customer = await tx.customer.deleteMany({ where: customerWhere });
        const physicalPlot = await tx.physicalPlot.deleteMany({ where: physicalPlotWhere });
        const staff = await tx.staff.deleteMany({ where: staffWhere });
        const relationshipMaster = await tx.relationshipMaster.deleteMany({
          where: relationshipMasterWhere,
        });
        return {
          payment,
          billing,
          contractPlot,
          customer,
          physicalPlot,
          staff,
          relationshipMaster,
        };
      },
      { timeout: 120_000 }
    );

    // eslint-disable-next-line no-console
    console.log('\n=== 削除結果 ===');
    // eslint-disable-next-line no-console
    console.table({
      payment: { deleted: result.payment.count },
      billing: { deleted: result.billing.count },
      contractPlot: { deleted: result.contractPlot.count },
      customer: { deleted: result.customer.count },
      physicalPlot: { deleted: result.physicalPlot.count },
      staff: { deleted: result.staff.count },
      relationshipMaster: { deleted: result.relationshipMaster.count },
    });

    const after = {
      payment: await prisma.payment.count({ where: paymentWhere }),
      billing: await prisma.billing.count({ where: billingWhere }),
      contractPlot: await prisma.contractPlot.count({ where: contractPlotWhere }),
      customer: await prisma.customer.count({ where: customerWhere }),
      physicalPlot: await prisma.physicalPlot.count({ where: physicalPlotWhere }),
      staff: await prisma.staff.count({ where: staffWhere }),
      relationshipMaster: await prisma.relationshipMaster.count({ where: relationshipMasterWhere }),
    };

    // eslint-disable-next-line no-console
    console.log('\n=== 削除後の残件数 (after) ===');
    // eslint-disable-next-line no-console
    console.table(after);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
