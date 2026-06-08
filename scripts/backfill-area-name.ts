/// <reference types="node" />
/**
 * 既存 physical_plots の area_name backfill スクリプト（#151）
 *
 * 移行が area_name を `chiku_cd-area_cd`（例 `1-364`）の中間コードで生成していたのを、
 * レガシー `m_bochi.area_cd → m_area.area_name`（実区画名: 凛A/つながり/樹林/A〜V/数字 等）に
 * 置き換える。全角英数は半角化（normalizeGraveName）。
 *
 * 対象は旧形式の area_name（`\d+-\d+` または `unknown-` 始まり）の移行区画のみ。
 * アプリ作成区画や既に正規名が入っている区画は対象外（冪等・再実行安全）。
 *
 * 使い方:
 *   npm run backfill:area-name -- --dry-run   # 更新せず件数だけ確認
 *   npm run backfill:area-name                # 実投入
 *
 * 環境変数: LEGACY_MYSQL_* / DATABASE_URL（migrate:legacy と同じ）
 */
import 'dotenv/config';

import { prisma } from '../src/db/prisma';
import { closeLegacyPool, legacyQuery } from './legacy-migration/legacyDb';
import { normalizeGraveName } from './legacy-migration/transforms';

interface AreaNameRow {
  grave_cd: number;
  m_area_name: string | null;
}

const BATCH = 500;
const OLD_FORMAT = /^(\d+-\d+|unknown-)/; // 移行が生成した旧 area_name 形式

async function main(): Promise<void> {
  const dryRun = process.argv.slice(2).includes('--dry-run');
  console.log(`[backfill area_name] start (dryRun=${dryRun})`);

  // 対象: legacy-{grave_cd} 形式で area_name が旧形式の物理区画
  const targets = await prisma.physicalPlot.findMany({
    where: { plot_number: { startsWith: 'legacy-' } },
    select: { id: true, plot_number: true, area_name: true },
  });
  const oldFormat = targets.filter((t) => OLD_FORMAT.test(t.area_name));
  console.log(`legacy 物理区画 ${targets.length} 件 / 旧形式 area_name ${oldFormat.length} 件`);

  // plot_number から grave_cd を抽出
  const graveCdById = new Map<string, number>();
  for (const t of oldFormat) {
    const cd = Number(t.plot_number.slice('legacy-'.length));
    if (Number.isInteger(cd)) graveCdById.set(t.id, cd);
  }

  // レガシーから grave_cd → m_area.area_name を一括取得
  const allCds = [...new Set(graveCdById.values())];
  const nameByCd = new Map<number, string | null>();
  for (let i = 0; i < allCds.length; i += BATCH) {
    const chunk = allCds.slice(i, i + BATCH);
    const rows = await legacyQuery<AreaNameRow & { constructor: { name: 'RowDataPacket' } }>(
      `SELECT b.grave_cd, a.area_name AS m_area_name
         FROM m_bochi b LEFT JOIN m_area a ON a.area_cd = b.area_cd
        WHERE b.grave_cd IN (${chunk.map(() => '?').join(',')})`,
      chunk
    );
    for (const r of rows) nameByCd.set(r.grave_cd, r.m_area_name);
  }

  let skippedNoName = 0;
  let skippedNoCd = 0;
  const updates: Array<{ id: string; areaName: string }> = [];
  for (const t of oldFormat) {
    const cd = graveCdById.get(t.id);
    if (cd === undefined) {
      skippedNoCd++;
      continue;
    }
    const areaName = normalizeGraveName(nameByCd.get(cd));
    if (areaName === null) {
      skippedNoName++; // m_area に対応無し（実測3件）→ 旧形式のまま残す
      continue;
    }
    updates.push({ id: t.id, areaName });
  }

  let updated = 0;
  if (!dryRun) {
    const CONCURRENCY = 25;
    for (let i = 0; i < updates.length; i += CONCURRENCY) {
      const chunk = updates.slice(i, i + CONCURRENCY);
      await Promise.all(
        chunk.map((u) =>
          prisma.physicalPlot.update({ where: { id: u.id }, data: { area_name: u.areaName } })
        )
      );
      updated += chunk.length;
      if (updated % 500 === 0 || updated === updates.length) {
        console.log(`  updated ${updated}/${updates.length}`);
      }
    }
  } else {
    updated = updates.length;
  }

  console.log(
    JSON.stringify(
      {
        legacy_plots: targets.length,
        old_format: oldFormat.length,
        updated,
        skip_no_m_area_name: skippedNoName,
        skip_no_grave_cd: skippedNoCd,
        sample: updates.slice(0, 10).map((u) => u.areaName),
      },
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
    await closeLegacyPool();
    await prisma.$disconnect();
  });
