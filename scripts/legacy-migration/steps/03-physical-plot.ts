import type { RowDataPacket } from 'mysql2/promise';

import { legacyQuery } from '../legacyDb';
import { cleanStr, normalizeGraveName } from '../transforms';
import type { MigrationStep } from '../types';

interface BochiPhysicalRow extends RowDataPacket {
  grave_cd: number;
  chiku_cd: number | null;
  area_cd: number | null;
  grave_name_cd: string | null;
  grave_mei: string | null;
  map_id: number | null;
  note: string | null;
}

/**
 * m_bochi → PhysicalPlot
 *
 * 1 m_bochi 行 = 1 PhysicalPlot + 1 ContractPlot に分解する設計のため、
 * ここでは物理側のみ作成。grave_cd を一意の plot_number とする。
 *
 * area_name は chiku_cd + area_cd の組合せから簡易生成（後でマスタ参照に差し替え可）
 *
 * 異常値除外:
 *   - chiku_cd=0, area_cd=99999999 等は B-3 で発見済のテストデータ
 *   - 移行はするが notes に印を付ける（業務確認: そのまま移行）
 */
export const stepPhysicalPlot: MigrationStep = {
  name: 'physicalPlot',
  async run({ prisma, logger, idMaps, dryRun }) {
    const rows = await legacyQuery<BochiPhysicalRow>(
      `SELECT grave_cd, chiku_cd, area_cd, grave_name_cd, grave_mei, map_id, note
         FROM m_bochi
        WHERE del_flg = 0 OR del_flg IS NULL`
    );

    let inserted = 0;
    let skipped = 0;
    const seenPlotNumbers = new Set<string>();

    for (const row of rows) {
      const plotNumber = `legacy-${row.grave_cd}`;
      if (seenPlotNumbers.has(plotNumber)) {
        skipped++;
        continue;
      }
      seenPlotNumbers.add(plotNumber);

      const areaName =
        row.chiku_cd != null && row.area_cd != null
          ? `${row.chiku_cd}-${row.area_cd}`
          : `unknown-${row.grave_cd}`;

      // 表示用区画番号（grave_name_cd 由来、例: "A-100"）。plot_number は
      // ユニーク制約・一括取込キーのため legacy-{grave_cd} を維持し、表示はこちら。#158
      const displayNumber = normalizeGraveName(row.grave_name_cd);

      const notes =
        [
          cleanStr(row.note),
          cleanStr(row.grave_mei),
          cleanStr(row.grave_name_cd),
          row.chiku_cd === 0 || row.area_cd === 99999999 ? '[test-data candidate]' : null,
        ]
          .filter(Boolean)
          .join('\n') || null;

      if (dryRun) {
        idMaps.physicalPlot.set(row.grave_cd, `dry-physical-${row.grave_cd}`);
        inserted++;
        continue;
      }

      // 冪等性: legacy_grave_cd が ContractPlot にあるが、PhysicalPlot 側にはない
      // → plot_number ユニーク制約で existing チェック
      const existing = await prisma.physicalPlot.findUnique({ where: { plot_number: plotNumber } });
      if (existing) {
        idMaps.physicalPlot.set(row.grave_cd, existing.id);
        skipped++;
        logger.debug({ grave_cd: row.grave_cd }, 'PhysicalPlot already exists');
        continue;
      }

      const created = await prisma.physicalPlot.create({
        data: {
          plot_number: plotNumber,
          display_number: displayNumber,
          area_name: areaName,
          area_sqm: 3.6, // デフォルト（実面積はレガシーに無いので 3.6 固定）
          status: 'available', // ContractPlot 側で active があれば後で sold_out に更新
          map_id: row.map_id ?? null,
          notes,
        },
      });
      idMaps.physicalPlot.set(row.grave_cd, created.id);
      inserted++;
    }

    return { inserted, skipped, notes: { source_rows: rows.length } };
  },
};
