/// <reference types="node" />
/**
 * 建立期限/建立日の器ずれ backfill スクリプト（#326）
 *
 * レガシー移行（step05）が建立期限(konryu_kigen)/建立日(konryu_date) を
 * 誤って ContractPlot.permit_date(許可日)/start_date(開始日) に投入していた。
 * 正しい器は GravestoneInfo.establishment_deadline/establishment_date。
 *
 * 本スクリプトはレガシーDB不要で、移行済み行（legacy_grave_cd IS NOT NULL）の
 * permit_date → establishment_deadline / start_date → establishment_date へ DB 内で移送し、
 * その後 permit_date/start_date には契約日(contract_date)を代理投入する
 * （業務確認 komine-docs#10 Q4/Q5: 許可日＝開始日＝契約日相当）。
 *
 * アプリ作成行（legacy_grave_cd IS NULL）は正規の許可日/開始日が入りうるため対象外。
 *
 * ⚠️ 安全ガード: establishment_deadline/establishment_date が**未投入**の行だけ処理する。
 *   これにより、新移行コード（permit=contract_date を投入する版）適用済みの行や、
 *   既に本スクリプトで処理済みの行を再処理して establishment を壊すことを防ぐ。
 *
 * 使い方:
 *   npx ts-node scripts/backfill-konryu-establishment.ts          # dry-run（件数のみ）
 *   npx ts-node scripts/backfill-konryu-establishment.ts --apply  # 実際に更新
 *
 * 冪等: 実行後は establishment が埋まるため、同じ行は次回ガードで除外され再処理されない。
 */
import 'dotenv/config';

import { prisma } from '../src/db/prisma';

const APPLY = process.argv.includes('--apply');
const CONCURRENCY = 25;

async function main(): Promise<void> {
  console.log(`[backfill konryu→establishment] start (apply=${APPLY})`);

  // 候補: 移行行で permit_date か start_date が入っているもの（= 誤投入された建立期限/建立日の疑い）
  const candidates = await prisma.contractPlot.findMany({
    where: {
      legacy_grave_cd: { not: null },
      deleted_at: null,
      OR: [{ permit_date: { not: null } }, { start_date: { not: null } }],
    },
    select: {
      id: true,
      permit_date: true,
      start_date: true,
      contract_date: true,
      gravestoneInfo: {
        select: { id: true, establishment_deadline: true, establishment_date: true },
      },
    },
  });

  // 安全ガード: establishment が未投入の行だけが「旧マッピングの未処理行」。
  // どちらか埋まっていれば（新移行コード適用済み or 本スクリプト処理済み）除外する。
  const targets = candidates.filter(
    (t) =>
      t.gravestoneInfo == null ||
      (t.gravestoneInfo.establishment_deadline == null &&
        t.gravestoneInfo.establishment_date == null)
  );
  console.log(`候補 ${candidates.length} 件 / 対象（establishment 未投入）${targets.length} 件`);

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

        // 誤投入されていた建立期限/建立日は上で establishment へ移送済み。
        // 許可日/開始日は契約日を代理値にする（komine-docs#10 Q4/Q5）。
        await prisma.contractPlot.update({
          where: { id: t.id },
          data: { permit_date: t.contract_date, start_date: t.contract_date },
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
