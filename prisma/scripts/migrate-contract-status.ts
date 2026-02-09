/// <reference types="node" />
/**
 * データマイグレーションスクリプト
 * 既存のcontract_plotsレコードにcontract_statusを設定する
 */

import { PrismaClient, PaymentStatus, ContractStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting contract_status migration...');

  // 全契約を取得
  const contracts = await prisma.contractPlot.findMany({
    where: { deleted_at: null },
    select: {
      id: true,
      payment_status: true,
      contract_status: true,
    },
  });

  console.log(`Found ${contracts.length} contracts to migrate`);

  let updated = 0;
  for (const contract of contracts) {
    // 既にactiveでないものはスキップ（既にマイグレーション済み）
    if (contract.contract_status !== ContractStatus.active) {
      continue;
    }

    let newStatus: ContractStatus = ContractStatus.active;

    // payment_statusに基づいてcontract_statusを決定
    switch (contract.payment_status) {
      case PaymentStatus.cancelled:
      case PaymentStatus.refunded:
        newStatus = ContractStatus.cancelled;
        break;
      case PaymentStatus.overdue:
        newStatus = ContractStatus.suspended;
        break;
      default:
        newStatus = ContractStatus.active;
    }

    if (newStatus !== ContractStatus.active) {
      await prisma.contractPlot.update({
        where: { id: contract.id },
        data: { contract_status: newStatus },
      });
      updated++;
      console.log(`Updated contract ${contract.id}: ${contract.payment_status} -> ${newStatus}`);
    }
  }

  console.log(`Migration complete. Updated ${updated} contracts.`);
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
