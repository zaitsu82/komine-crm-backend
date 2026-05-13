import type { RowDataPacket } from 'mysql2/promise';

import { legacyQuery } from '../legacyDb';
import { cleanStr } from '../transforms';
import type { MigrationStep } from '../types';

interface SykbnnRow extends RowDataPacket {
  KBNNO: number;
  NMCODE: number;
  NAMEL: string | null;
  NAMES: string | null;
}

/**
 * sykbnn → 各種 *Master
 *
 * 最小実装: 続柄マスタ (KBNNO=2009) のみ投入。
 * 他のマスタ（区画名 KBNNO=2018、料金種別 KBNNO=2014、法要 KBNNO=2004、
 * アクション履歴 KBNNO=2019 等）は新システムで運用しながら必要に応じて手動投入する方針。
 */
export const stepMasters: MigrationStep = {
  name: 'masters',
  async run({ prisma, logger, dryRun }) {
    const rows = await legacyQuery<SykbnnRow>(
      `SELECT KBNNO, NMCODE, NAMEL, NAMES FROM sykbnn WHERE KBNNO = 2009 ORDER BY NMCODE`
    );

    let inserted = 0;
    let skipped = 0;

    for (const row of rows) {
      const name = cleanStr(row.NAMEL) ?? cleanStr(row.NAMES);
      if (!name) {
        skipped++;
        continue;
      }
      const code = `2009-${row.NMCODE}`;

      if (dryRun) {
        inserted++;
        continue;
      }

      const existing = await prisma.relationshipMaster.findUnique({ where: { code } });
      if (existing) {
        skipped++;
        continue;
      }

      await prisma.relationshipMaster.create({
        data: {
          code,
          name,
          sort_order: row.NMCODE,
          is_active: true,
        },
      });
      inserted++;
    }

    logger.info({ inserted, skipped }, 'Masters (relationship) migrated');
    return { inserted, skipped, notes: { source_rows: rows.length, kbnno: 2009 } };
  },
};
