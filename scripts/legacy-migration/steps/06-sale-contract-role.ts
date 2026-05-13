import type { RowDataPacket } from 'mysql2/promise';

import { legacyQuery } from '../legacyDb';
import { cleanPhone, cleanStr, joinName, parseLegacyZip } from '../transforms';
import type { MigrationStep } from '../types';

interface DankaRoleRow extends RowDataPacket {
  danka_cd: number;
  grave_cd: number;
  request_sei: string | null;
  request_sei_kana: string | null;
  request_mei: string | null;
  request_mei_kana: string | null;
  request_zip: number | null;
  request_addr1: string | null;
  request_addr2: string | null;
  request_addr3: string | null;
  request_tel1: string | null;
  owner_sei: string | null;
  owner_mei: string | null;
}

/**
 * t_danka → SaleContractRole（applicant + contractor）
 *
 * - 各 t_danka 行に対し contractor（owner_*）の SaleContractRole を作成
 * - applicant（request_*）が contractor と異なる場合は別 Customer を作成して applicant ロールも追加
 *   C-1 で 35.5% が別人と確認済
 * - 同一の場合は contractor 1 行のみ
 */
export const stepSaleContractRole: MigrationStep = {
  name: 'saleContractRole',
  dependsOn: ['customer', 'contractPlot'],
  async run({ prisma, logger, idMaps, dryRun }) {
    const rows = await legacyQuery<DankaRoleRow>(
      `SELECT danka_cd, grave_cd,
              request_sei, request_sei_kana, request_mei, request_mei_kana,
              request_zip, request_addr1, request_addr2, request_addr3, request_tel1,
              owner_sei, owner_mei
         FROM t_danka WHERE del_flg = 0 OR del_flg IS NULL`
    );

    let contractorInserted = 0;
    let applicantInserted = 0;
    let skipped = 0;
    let skipNoCustomer = 0;
    let skipNoContractPlot = 0;
    let skipNoBoth = 0;
    let skipApplicantMissingFields = 0;

    for (const row of rows) {
      const customerId = idMaps.customer.get(row.danka_cd);
      const contractPlotId = idMaps.contractPlot.get(row.grave_cd);
      if (!customerId || !contractPlotId) {
        skipped++;
        if (!customerId && !contractPlotId) skipNoBoth++;
        else if (!customerId) skipNoCustomer++;
        else skipNoContractPlot++;
        continue;
      }

      // contractor ロール
      if (!dryRun) {
        await prisma.saleContractRole
          .upsert({
            where: {
              contract_plot_id_customer_id_role_deleted_at: {
                contract_plot_id: contractPlotId,
                customer_id: customerId,
                role: 'contractor',
                deleted_at: null as unknown as Date, // composite unique with nullable
              },
            },
            create: {
              contract_plot_id: contractPlotId,
              customer_id: customerId,
              role: 'contractor',
            },
            update: {},
          })
          .catch(async (e: unknown) => {
            // upsert で deleted_at null との合成キーが Prisma で扱いにくい場合のフォールバック
            logger.debug({ err: e }, 'upsert failed, falling back to findFirst+create');
            const existing = await prisma.saleContractRole.findFirst({
              where: {
                contract_plot_id: contractPlotId,
                customer_id: customerId,
                role: 'contractor',
                deleted_at: null,
              },
            });
            if (!existing) {
              await prisma.saleContractRole.create({
                data: {
                  contract_plot_id: contractPlotId,
                  customer_id: customerId,
                  role: 'contractor',
                },
              });
            }
          });
      }
      contractorInserted++;

      // applicant が contractor と異なる場合に別 Customer + SaleContractRole を作る
      const ownerName = joinName(row.owner_sei, row.owner_mei);
      const requestName = joinName(row.request_sei, row.request_mei);

      if (!requestName) continue;
      if (ownerName && requestName === ownerName) {
        // 同一人物 → applicant ロールは contractor と同じ Customer に紐づける
        if (!dryRun) {
          const existing = await prisma.saleContractRole.findFirst({
            where: {
              contract_plot_id: contractPlotId,
              customer_id: customerId,
              role: 'applicant',
              deleted_at: null,
            },
          });
          if (!existing) {
            await prisma.saleContractRole.create({
              data: {
                contract_plot_id: contractPlotId,
                customer_id: customerId,
                role: 'applicant',
              },
            });
          }
        }
        applicantInserted++;
        continue;
      }

      // 別人 → 申込者の Customer を新規作成
      const reqKana = joinName(row.request_sei_kana, row.request_mei_kana);
      const reqAddress = [row.request_addr1, row.request_addr2, row.request_addr3]
        .map(cleanStr)
        .filter((p): p is string => p !== null)
        .join(' ');
      const reqZip = parseLegacyZip(row.request_zip);
      const reqPhone = cleanPhone(row.request_tel1);

      if (!reqKana || !reqAddress || !reqZip || !reqPhone) {
        logger.debug(
          { danka_cd: row.danka_cd },
          'Applicant differs from contractor but lacks required fields, skipping applicant role'
        );
        skipApplicantMissingFields++;
        continue;
      }

      if (dryRun) {
        applicantInserted++;
        continue;
      }

      const applicantCustomer = await prisma.customer.create({
        data: {
          name: requestName,
          name_kana: reqKana,
          postal_code: reqZip,
          address: reqAddress,
          phone_number: reqPhone,
          notes: `legacy applicant of danka_cd=${row.danka_cd}`,
        },
      });

      await prisma.saleContractRole.create({
        data: {
          contract_plot_id: contractPlotId,
          customer_id: applicantCustomer.id,
          role: 'applicant',
        },
      });
      applicantInserted++;
    }

    return {
      inserted: contractorInserted + applicantInserted,
      skipped,
      notes: {
        source_rows: rows.length,
        contractor_roles: contractorInserted,
        applicant_roles: applicantInserted,
        skip_no_customer: skipNoCustomer,
        skip_no_contract_plot: skipNoContractPlot,
        skip_no_both: skipNoBoth,
        skip_applicant_missing_fields: skipApplicantMissingFields,
      },
    };
  },
};
