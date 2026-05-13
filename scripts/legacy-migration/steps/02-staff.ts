import type { RowDataPacket } from 'mysql2/promise';

import { legacyQuery } from '../legacyDb';
import { cleanStr, joinName } from '../transforms';
import type { MigrationStep } from '../types';

interface MatantRow extends RowDataPacket {
  TANCD: number;
  NAMEF: string | null; // 姓
  NAMEK: string | null; // 名
  NAMES: string | null; // 略称（ふりがな？）
  EMAILK: string | null;
  EMAILP: string | null;
  PLEVEL: number | null;
  DELMARK: number | null;
}

/**
 * matant 6名 → Staff
 *
 * - 全員 is_active=true（業務確認: 全員現職、2026-05-12）
 * - supabase_uid はダミー値（後で admin が招待し直す前提）
 * - role はデフォルト viewer
 */
export const stepStaff: MigrationStep = {
  name: 'staff',
  async run({ prisma, logger, idMaps, dryRun }) {
    const rows = await legacyQuery<MatantRow>(
      `SELECT TANCD, NAMEF, NAMEK, NAMES, EMAILK, EMAILP, PLEVEL, DELMARK
         FROM matant
        WHERE DELMARK = 0 OR DELMARK IS NULL`
    );

    let inserted = 0;
    let skipped = 0;

    for (const row of rows) {
      const name = joinName(row.NAMEF, row.NAMEK) ?? cleanStr(row.NAMES) ?? `staff_${row.TANCD}`;
      const email =
        cleanStr(row.EMAILK) ?? cleanStr(row.EMAILP) ?? `legacy_${row.TANCD}@example.invalid`;

      if (dryRun) {
        idMaps.staff.set(row.TANCD, row.TANCD); // 仮 ID
        inserted++;
        continue;
      }

      // 既存チェック（legacy_* カラムが Staff にないため、メール一意性で判定）
      const existing = await prisma.staff.findUnique({ where: { email } });
      if (existing) {
        idMaps.staff.set(row.TANCD, existing.id);
        skipped++;
        logger.debug({ tancd: row.TANCD, email }, 'Staff already exists, skipping');
        continue;
      }

      const created = await prisma.staff.create({
        data: {
          supabase_uid: `legacy-tancd-${row.TANCD}`,
          name,
          email,
          role: 'viewer',
          is_active: true,
        },
      });
      idMaps.staff.set(row.TANCD, created.id);
      inserted++;
    }

    return { inserted, skipped, notes: { source_rows: rows.length } };
  },
};
