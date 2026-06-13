/// <reference types="node" />
/**
 * 建立期限/建立日の器ずれ backfill スクリプト（#326 / #390）
 *
 * ⚠️ **新移行コード（PR#342 以降の step05）で移行した DB には不要・実行禁止**。
 *   現行 step05 は establishment を GravestoneInfo へ正しく入れ、permit_date/start_date には
 *   contract_date を投入する（許可日＝開始日＝契約日 / komine-docs#10 Q4/Q5）。
 *   このスクリプトは **旧移行コード（konryu を permit/start へ誤投入していた版）で投入した DB** の
 *   是正専用。新コード移行済み行は下記ガード(1)で除外され処理されない（#390 の捏造防止）。
 *
 * 旧移行（step05 旧版）が建立期限(konryu_kigen)/建立日(konryu_date) を
 * 誤って ContractPlot.permit_date(許可日)/start_date(開始日) に投入していた。
 * 正しい器は GravestoneInfo.establishment_deadline/establishment_date。
 *
 * 本スクリプトはレガシーDB不要で、以下 2 パスを実行する。
 *
 *   パス1（是正）: 旧誤投入行の permit_date → establishment_deadline /
 *     start_date → establishment_date へ DB 内で移送し、その後 permit_date/start_date には
 *     契約日(contract_date)を代理投入する。
 *   パス2（代理投入の取りこぼし補完 / #390 low）: konryu_kigen/konryu_date が両方 null で
 *     permit_date=start_date=null のまま移行された行へ、許可日＝開始日＝契約日を代理投入する
 *     （establishment 非干渉・冪等）。
 *
 * アプリ作成行（legacy_grave_cd IS NULL）は正規の許可日/開始日が入りうるため対象外。
 *
 * 安全ガード（パス1）:
 *   (1) permit_date/start_date が既に contract_date と一致する行（= 新移行コード適用済み or
 *       本スクリプト処理済み）は除外する（#390: 契約日を establishment へ捏造するのを防ぐ）。
 *   (2) establishment_deadline/establishment_date が**未投入**の行だけ処理する。
 *       これにより、既に establishment が埋まっている行を再処理して壊すことを防ぐ。
 *
 * 使い方:
 *   npx ts-node scripts/backfill-konryu-establishment.ts          # dry-run（件数のみ）
 *   npx ts-node scripts/backfill-konryu-establishment.ts --apply  # 実際に更新
 *
 * 冪等: 実行後は establishment が埋まり、permit/start が contract_date と一致するため、
 *   同じ行は次回ガード(1)(2)で除外され再処理されない。
 */
import 'dotenv/config';

import { prisma } from '../src/db/prisma';

const APPLY = process.argv.includes('--apply');
const CONCURRENCY = 25;

/** 2 つの Date / null が同一日付か（参照ではなく値で比較） */
export function sameDate(a: Date | null, b: Date | null): boolean {
  if (a === null || b === null) return a === b;
  return a.getTime() === b.getTime();
}

type CandidateRow = {
  permit_date: Date | null;
  start_date: Date | null;
  contract_date: Date | null;
  gravestoneInfo: {
    establishment_deadline: Date | null;
    establishment_date: Date | null;
  } | null;
};

/**
 * パス1の是正対象か判定する（DB 非依存の純関数 / #390）。
 *
 * - 新移行コード適用済み（permit_date と start_date が両方 contract_date と一致）は除外。
 *   → 契約日を establishment へ捏造するのを防ぐ。
 * - establishment が既に埋まっている行（新コード or 処理済み）は除外。
 */
export function isPass1Target(row: CandidateRow): boolean {
  // ガード(1): 新マッピング済み（permit=start=contract_date）は除外。
  const newMappingApplied =
    sameDate(row.permit_date, row.contract_date) && sameDate(row.start_date, row.contract_date);
  if (newMappingApplied) return false;

  // ガード(2): establishment 未投入の行だけが「旧マッピングの未処理行」。
  return (
    row.gravestoneInfo == null ||
    (row.gravestoneInfo.establishment_deadline == null &&
      row.gravestoneInfo.establishment_date == null)
  );
}

async function runPass1(): Promise<{
  candidates: number;
  targets: number;
  updated: number;
  createdGravestone: number;
}> {
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

  const targets = candidates.filter((t) => isPass1Target(t));
  console.log(
    `[パス1 是正] 候補 ${candidates.length} 件 / 対象（新マッピング除外・establishment 未投入）${targets.length} 件`
  );

  if (!APPLY) {
    const missingGravestone = targets.filter((t) => !t.gravestoneInfo).length;
    console.log(
      JSON.stringify(
        {
          pass: 1,
          dryRun: true,
          candidates: candidates.length,
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
    return {
      candidates: candidates.length,
      targets: targets.length,
      updated: 0,
      createdGravestone: 0,
    };
  }

  let updated = 0;
  let createdGravestone = 0;
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
      console.log(`  [パス1] updated ${updated}/${targets.length}`);
    }
  }

  return { candidates: candidates.length, targets: targets.length, updated, createdGravestone };
}

async function runPass2(): Promise<{ targets: number; updated: number }> {
  // パス2（#390 low）: 移行行のうち permit_date=start_date=null（konryu 両方 null で
  // 旧版が何も入れなかった行）で contract_date を持つものへ、許可日＝開始日＝契約日を代理投入。
  // establishment には一切触れない（非干渉・冪等）。
  const targets = await prisma.contractPlot.findMany({
    where: {
      legacy_grave_cd: { not: null },
      deleted_at: null,
      permit_date: null,
      start_date: null,
      contract_date: { not: null },
    },
    select: { id: true, contract_date: true },
  });
  console.log(`[パス2 代理投入補完] 対象（permit/start 両 null・契約日あり）${targets.length} 件`);

  if (!APPLY) {
    console.log(
      JSON.stringify(
        {
          pass: 2,
          dryRun: true,
          targets: targets.length,
          sample: targets.slice(0, 5).map((t) => ({ id: t.id, contract_date: t.contract_date })),
        },
        null,
        2
      )
    );
    return { targets: targets.length, updated: 0 };
  }

  let updated = 0;
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const chunk = targets.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map((t) =>
        prisma.contractPlot.update({
          where: { id: t.id },
          data: { permit_date: t.contract_date, start_date: t.contract_date },
        })
      )
    );
    updated += chunk.length;
    if (updated % 500 === 0 || updated === targets.length) {
      console.log(`  [パス2] updated ${updated}/${targets.length}`);
    }
  }

  return { targets: targets.length, updated };
}

async function main(): Promise<void> {
  console.log(`[backfill konryu→establishment] start (apply=${APPLY})`);

  const pass1 = await runPass1();
  const pass2 = await runPass2();

  console.log(
    JSON.stringify(
      {
        pass1_candidates: pass1.candidates,
        pass1_targets: pass1.targets,
        pass1_updated: pass1.updated,
        pass1_created_gravestone_info: pass1.createdGravestone,
        pass2_targets: pass2.targets,
        pass2_updated: pass2.updated,
      },
      null,
      2
    )
  );
}

// テストから import されたとき（require.main 不一致）は自動実行しない。
if (require.main === module) {
  main()
    .catch((e) => {
      console.error('ERROR', e);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
