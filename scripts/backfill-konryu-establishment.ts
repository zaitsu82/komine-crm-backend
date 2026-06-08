/// <reference types="node" />
/**
 * 建立期限/建立日の器ずれ backfill スクリプト（#326）
 *
 * レガシー移行（step05）が建立期限(konryu_kigen)/建立日(konryu_date) を
 * 誤って ContractPlot.permit_date(許可日)/start_date(開始日) に投入していた。
 * 正しい器は GravestoneInfo.establishment_deadline/establishment_date。
 *
 * 本スクリプトはレガシーDB不要で、移行済み行（legacy_grave_cd IS NOT NULL）の
 * permit_date → establishment_deadline / start_date → establishment_date へ
 * DB 内で移送し、ContractPlot.permit_date/start_date を null に戻す。
 *
 * アプリ作成行（legacy_grave_cd IS NULL）は正規の許可日/開始日が入りうるため対象外。
 *
 * 使い方:
 *   npx ts-node scripts/backfill-konryu-establishment.ts          # dry-run（件数のみ）
 *   npx ts-node scripts/backfill-konryu-establishment.ts --apply  # 実際に更新
 *
 * 冪等: 実行後は対象行の permit_date/start_date が null になるため再実行で 0 件。
 *       establishment 側に既存値があれば上書きしない（?? で温存）。
 */
import 'dotenv/config';

import { prisma } from '../src/db/prisma';

const APPLY = process.argv.includes('--apply');
const CONCURRENCY = 25;

async function main(): Promise<void> {
  console.log(`[backfill konryu→establishment] start (apply=${APPLY})`);

  // 対象: 移行行で permit_date か start_date が入っているもの（= 誤投入された建立期限/建立日）
  const targets = await prisma.contractPlot.findMany({
    where: {
      legacy_grave_cd: { not: null },
      deleted_at: null,
      OR: [{ permit_date: { not: null } }, { start_date: { not: null } }],
    },
    select: {
      id: true,
      permit_date: true,
      start_date: true,
      gravestoneInfo: {
        select: { id: true, establishment_deadline: true, establishment_date: true },
      },
    },
  });
  console.log(`対象 contract_plots: ${targets.length} 件`);

  let updated = 0;
  let createdGravestone = 0;

  if (!APPLY) {
    const missingGravestone = targets.filter((t) => !t.gravestoneInfo).length;
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          targets: targets.length,
          would_create_gravestone_info: missingGravestone,
          sample: targets.slice(0, 5).map((t) => ({
            id: t.id,
            permit_date: t.permit_date,
            start_date: t.start_date,
            has_gravestone: !!t.gravestoneInfo,
          })),
        },
        null,
        2
      )
    );
    return;
  }

  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const chunk = targets.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map(async (t) => {
        const deadline = t.gravestoneInfo?.establishment_deadline ?? t.permit_date;
        const date = t.gravestoneInfo?.establishment_date ?? t.start_date;

        // GravestoneInfo へ建立期限/建立日を移送（無ければ作成）
        if (t.gravestoneInfo) {
          await prisma.gravestoneInfo.update({
            where: { id: t.gravestoneInfo.id },
            data: { establishment_deadline: deadline, establishment_date: date },
          });
        } else {
          await prisma.gravestoneInfo.create({
            data: {
              contract_plot_id: t.id,
              establishment_deadline: deadline,
              establishment_date: date,
            },
          });
          createdGravestone++;
        }

        // 誤投入された permit_date/start_date を null に戻す
        await prisma.contractPlot.update({
          where: { id: t.id },
          data: { permit_date: null, start_date: null },
        });
      })
    );
    updated += chunk.length;
    if (updated % 500 === 0 || updated === targets.length) {
      console.log(`  updated ${updated}/${targets.length}`);
    }
  }

  console.log(
    JSON.stringify(
      { targets: targets.length, updated, created_gravestone_info: createdGravestone },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error('ERROR', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
