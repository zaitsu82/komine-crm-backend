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
 * - 業者名（gyousha_cd）は contractor フィールドに int 文字列で保持（後でマスタ参照可）
 * - work_amount_1 を price、payment_amount_1 を payment に対応
 */
export const stepConstructionInfo: MigrationStep = {
  name: 'constructionInfo',
  dependsOn: ['contractPlot'],
  async run({ prisma, logger, idMaps, dryRun }) {
    if (!dryRun) await rebuildIdMap(prisma, idMaps, 'contractPlot', logger);
    assertIdMapsReady('constructionInfo', idMaps, ['contractPlot']);

    const rows = await legacyQuery<FoundlogRow>(
      `SELECT * FROM t_foundlog WHERE del_flg = 0 OR del_flg IS NULL`
    );

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

    return { inserted, skipped, notes: { source_rows: rows.length } };
  },
};
