import type { RowDataPacket } from 'mysql2/promise';

import { legacyQuery } from '../legacyDb';
import { rebuildIdMap } from '../lib/id-map-loader';
import { assertIdMapsReady } from '../lib/invariants';
import { cleanPhone, cleanStr, joinName, parseLegacyDate, parseLegacyZip } from '../transforms';
import type { MigrationStep } from '../types';

interface FamilyRow extends RowDataPacket {
  family_cd: number;
  danka_cd: number;
  family_sei: string | null;
  family_sei_kana: string | null;
  family_mei: string | null;
  family_mei_kana: string | null;
  birthday: number | null;
  zokugara: string | null;
  honseki_zip: number | null;
  honseki_addr1: string | null;
  honseki_addr2: string | null;
  zip: number | null;
  addr1: string | null;
  addr2: string | null;
  addr3: string | null;
  tel1: string | null;
  tel2: string | null;
  fax: string | null;
  email1: string | null;
  job_name: string | null;
  job_name_kana: string | null;
  job_addr1: string | null;
  job_addr2: string | null;
  job_addr3: string | null;
  job_tel1: string | null;
  family_memo: string | null;
  note: string | null;
}

/**
 * t_family → FamilyContact
 *
 * 注意: t_family は danka_cd 経由で contract_plot を取得する。t_danka.grave_cd 経由でルックアップ
 * 業務確認済（2026-05-12）: address 41% / phone 3% 欠損は nullable で受け入れ
 */
export const stepFamilyContact: MigrationStep = {
  name: 'familyContact',
  dependsOn: ['customer', 'contractPlot'],
  async run({ prisma, logger, idMaps, dryRun }) {
    // dry-run でも idMap を再構築する。rebuildIdMap は新DBからの読み取り専用かつ冪等なので
    // 安全で、--only=<step> で 03〜06 を飛ばして resume するとき空マップで
    // assertIdMapsReady が落ちるのを防ぐ。full dry-run では既に placeholder で埋まっており no-op。
    await rebuildIdMap(prisma, idMaps, 'customer', logger);
    await rebuildIdMap(prisma, idMaps, 'contractPlot', logger);
    assertIdMapsReady('familyContact', idMaps, ['customer', 'contractPlot']);

    // t_danka から danka_cd → grave_cd の対応を取得
    const dankaToGrave = await legacyQuery<RowDataPacket & { danka_cd: number; grave_cd: number }>(
      `SELECT danka_cd, grave_cd FROM t_danka WHERE del_flg = 0 OR del_flg IS NULL`
    );
    const dankaGraveMap = new Map<number, number>();
    for (const r of dankaToGrave) dankaGraveMap.set(r.danka_cd, r.grave_cd);

    const rows = await legacyQuery<FamilyRow>(
      `SELECT * FROM t_family WHERE del_flg = 0 OR del_flg IS NULL`
    );

    let inserted = 0;
    let skipped = 0;
    let skipMissingName = 0;
    let skipDankaNotMapped = 0;
    let skipContractPlotNotMapped = 0;

    for (const row of rows) {
      const name = joinName(row.family_sei, row.family_mei);
      if (!name) {
        skipped++;
        skipMissingName++;
        continue;
      }

      const graveCd = dankaGraveMap.get(row.danka_cd);
      const contractPlotId = graveCd != null ? idMaps.contractPlot.get(graveCd) : undefined;
      if (!contractPlotId) {
        logger.debug(
          { family_cd: row.family_cd, danka_cd: row.danka_cd, grave_cd: graveCd ?? null },
          'No contract plot mapped'
        );
        skipped++;
        if (graveCd == null) skipDankaNotMapped++;
        else skipContractPlotNotMapped++;
        continue;
      }
      const customerId = idMaps.customer.get(row.danka_cd) ?? null;

      const addressParts = [row.addr1, row.addr2, row.addr3]
        .map(cleanStr)
        .filter((p): p is string => p !== null);

      const workAddress =
        [row.job_addr1, row.job_addr2, row.job_addr3]
          .map(cleanStr)
          .filter((p): p is string => p !== null)
          .join(' ') || null;

      if (dryRun) {
        inserted++;
        continue;
      }

      await prisma.familyContact.create({
        data: {
          contract_plot_id: contractPlotId,
          customer_id: customerId,
          name,
          name_kana: joinName(row.family_sei_kana, row.family_mei_kana),
          birth_date: parseLegacyDate(row.birthday),
          relationship: cleanStr(row.zokugara) ?? 'unknown',
          postal_code: parseLegacyZip(row.zip),
          address: addressParts.length > 0 ? addressParts.join(' ') : null,
          phone_number: cleanPhone(row.tel1),
          phone_number_2: cleanPhone(row.tel2),
          fax_number: cleanPhone(row.fax),
          email: cleanStr(row.email1),
          registered_address:
            [cleanStr(row.honseki_addr1), cleanStr(row.honseki_addr2)].filter(Boolean).join(' ') ||
            null,
          work_company_name: cleanStr(row.job_name),
          work_company_name_kana: cleanStr(row.job_name_kana),
          work_address: workAddress,
          work_phone_number: cleanPhone(row.job_tel1),
          notes: [cleanStr(row.family_memo), cleanStr(row.note)].filter(Boolean).join('\n') || null,
        },
      });
      inserted++;
    }

    return {
      inserted,
      skipped,
      notes: {
        source_rows: rows.length,
        skip_missing_name: skipMissingName,
        skip_danka_not_mapped: skipDankaNotMapped,
        skip_contract_plot_not_mapped: skipContractPlotNotMapped,
      },
    };
  },
};
