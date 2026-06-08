/// <reference types="node" />
/**
 * 既存 physical_plots の display_number backfill スクリプト（#158）
 *
 * plot_number が `legacy-{grave_cd}` の物理区画について、レガシー
 * `m_bochi.grave_name_cd` を正規化（全角→半角）して display_number に投入する。
 *
 * 使い方:
 *   npm run backfill:display-number -- --dry-run   # 更新せず件数だけ確認
 *   npm run backfill:display-number                # 実投入
 *
 * 環境変数: LEGACY_MYSQL_* / DATABASE_URL（migrate:legacy と同じ）
 *
 * 冪等: display_number が既に入っている行はスキップ（再実行安全）。
 */
import 'dotenv/config';

import { prisma } from '../src/db/prisma';
import { closeLegacyPool, legacyQuery } from './legacy-migration/legacyDb';
import { normalizeGraveName } from './legacy-migration/transforms';

interface MaisouNameRow {
  grave_cd: number;
  grave_name_cd: string | null;
}

const BATCH = 500;

async function main(): Promise<void> {
  const dryRun = process.argv.slice(2).includes('--dry-run');
  console.log(`[backfill display_number] start (dryRun=${dryRun})`);

  // 対象: legacy-{grave_cd} 形式で display_number 未設定の物理区画（削除済み含む）
  const targets = await prisma.physicalPlot.findMany({
    where: { plot_number: { startsWith: 'legacy-' }, display_number: null },
    select: { id: true, plot_number: true },
  });
  console.log(`対象 physical_plots: ${targets.length} 件`);

  // plot_number から grave_cd を抽出
  const graveCdById = new Map<string, number>();
  for (const t of targets) {
    const cd = Number(t.plot_number.slice('legacy-'.length));
    if (Number.isInteger(cd)) graveCdById.set(t.id, cd);
  }

  // レガシーから grave_cd → grave_name_cd を一括取得
  const allCds = [...new Set(graveCdById.values())];
  const nameByCd = new Map<number, string | null>();
  for (let i = 0; i < allCds.length; i += BATCH) {
    const chunk = allCds.slice(i, i + BATCH);
    const rows = await legacyQuery<MaisouNameRow & { constructor: { name: 'RowDataPacket' } }>(
      `SELECT grave_cd, grave_name_cd FROM m_bochi WHERE grave_cd IN (${chunk.map(() => '?').join(',')})`,
      chunk
    );
    for (const r of rows) nameByCd.set(r.grave_cd, r.grave_name_cd);
  }

  let updated = 0;
  let skippedNoName = 0;
  let skippedNoCd = 0;
  const updates: Array<{ id: string; display: string }> = [];
  for (const t of targets) {
    const cd = graveCdById.get(t.id);
    if (cd === undefined) {
      skippedNoCd++;
      continue;
    }
    const display = normalizeGraveName(nameByCd.get(cd));
    if (display === null) {
      skippedNoName++;
      continue;
    }
    updates.push({ id: t.id, display });
  }

  if (!dryRun) {
    // Supabase pooler のインタラクティブ tx は 5s 制限が厳しいため、
    // 個別 update（各自コミット）を小チャンクで並列実行する。冪等なので
    // 途中失敗しても再実行で続行できる。
    const CONCURRENCY = 25;
    for (let i = 0; i < updates.length; i += CONCURRENCY) {
      const chunk = updates.slice(i, i + CONCURRENCY);
      await Promise.all(
        chunk.map((u) =>
          prisma.physicalPlot.update({
            where: { id: u.id },
            data: { display_number: u.display },
          })
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
        targets: targets.length,
        updated,
        skip_no_grave_name_cd: skippedNoName,
        skip_no_grave_cd: skippedNoCd,
        sample: updates.slice(0, 10).map((u) => u.display),
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
