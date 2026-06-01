import type { RowDataPacket } from 'mysql2/promise';

import { legacyQuery } from '../legacyDb';
import { rebuildIdMap } from '../lib/id-map-loader';
import { assertIdMapsReady } from '../lib/invariants';
import { cleanStr, parseLegacyDate } from '../transforms';
import type { MigrationStep } from '../types';

interface FoundlogRow extends RowDataPacket {
  construction_id: number;
  grave_cd: number;
  danka_cd: number;
  gyousha_cd: number | null;
  construction_start: number | null;
  construction_sch: number | null;
  construction_end: number | null;
  construction_content: string | null;
  price: number | null;
  payment: number | null;
  construction_type: string | null;
  note: string | null;
}

/**
 * t_foundlog → ConstructionInfo
 *
 * - 業者名（gyousha_cd）は contractor フィールドに `legacy-gyousha-{id}` 形式で保存。
 *   同名 code を持つ ContractorMaster エントリを upsert で確保し、frontend の
 *   select が直接ヒット (= 既存値 fallback ではなく master 値として認識) するようにする。
 *   実際の業者名は業務側確認後にマスタ画面で rename する想定。
 * - work_amount_1 を price、payment_amount_1 を payment に対応
 */
export const stepConstructionInfo: MigrationStep = {
  name: 'constructionInfo',
  dependsOn: ['contractPlot'],
  async run({ prisma, logger, idMaps, dryRun }) {
    // dry-run でも resume 用に再構築（読み取り専用・冪等、full dry-run では no-op）
    await rebuildIdMap(prisma, idMaps, 'contractPlot', logger);
    assertIdMapsReady('constructionInfo', idMaps, ['contractPlot']);

    const rows = await legacyQuery<FoundlogRow>(
      `SELECT * FROM t_foundlog WHERE del_flg = 0 OR del_flg IS NULL`
    );

    // 出現する legacy gyousha_cd の一意集合を ContractorMaster に upsert
    const distinctGyousha = new Set<number>();
    for (const row of rows) {
      if (row.gyousha_cd != null) distinctGyousha.add(row.gyousha_cd);
    }
    let mastersUpserted = 0;
    if (!dryRun) {
      for (const gyoushaCd of distinctGyousha) {
        const code = `legacy-gyousha-${gyoushaCd}`;
        await prisma.contractorMaster.upsert({
          where: { code },
          create: {
            code,
            name: `業者ID:${gyoushaCd}`, // 業務側確認後にリネーム想定
            sort_order: gyoushaCd,
            is_active: true,
          },
          update: {}, // 既に存在する場合は何もしない (名前は手動で更新可能)
        });
        mastersUpserted++;
      }
      logger.info({ mastersUpserted }, 'ContractorMaster upserted from legacy gyousha_cd');
    }

    let inserted = 0;
    let skipped = 0;

    for (const row of rows) {
      const contractPlotId = idMaps.contractPlot.get(row.grave_cd);
      if (!contractPlotId) {
        logger.debug({ construction_id: row.construction_id }, 'No contract plot mapped');
        skipped++;
        continue;
      }

      if (dryRun) {
        inserted++;
        continue;
      }

      await prisma.constructionInfo.create({
        data: {
          contract_plot_id: contractPlotId,
          construction_type: cleanStr(row.construction_type),
          start_date: parseLegacyDate(row.construction_start),
          completion_date: parseLegacyDate(row.construction_end),
          scheduled_end_date: parseLegacyDate(row.construction_sch),
          contractor: row.gyousha_cd != null ? `legacy-gyousha-${row.gyousha_cd}` : null,
          work_amount_1: row.price ?? null,
          payment_amount_1: row.payment ?? null,
          construction_content: cleanStr(row.construction_content),
          notes: cleanStr(row.note),
        },
      });
      inserted++;
    }

    return {
      inserted,
      skipped,
      notes: { source_rows: rows.length, contractor_masters_upserted: mastersUpserted },
    };
  },
};
