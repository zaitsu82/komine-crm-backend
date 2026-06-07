import type { RowDataPacket } from 'mysql2/promise';

import { legacyQuery } from '../legacyDb';
import {
  cleanPhone,
  cleanStr,
  joinName,
  parseGender,
  parseLegacyDate,
  parseLegacyZip,
} from '../transforms';
import type { MigrationStep } from '../types';

interface DankaRow extends RowDataPacket {
  danka_cd: number;
  grave_cd: number;
  del_flg: number | null;
  // 申込者
  request_sei: string | null;
  request_sei_kana: string | null;
  request_mei: string | null;
  request_mei_kana: string | null;
  request_zip: number | null;
  request_addr1: string | null;
  request_addr2: string | null;
  request_addr3: string | null;
  request_tel1: string | null;
  request_tel2: string | null;
  // 契約者（檀家）
  owner_sei: string | null;
  owner_sei_kana: string | null;
  owner_mei: string | null;
  owner_mei_kana: string | null;
  sex_flg: number | null;
  birthday: number | null;
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
  // 勤務先
  job_name: string | null;
  job_name_kana: string | null;
  job_zip: number | null;
  job_addr1: string | null;
  job_addr2: string | null;
  job_addr3: string | null;
  job_tel1: string | null;
  // ゆうちょ
  kikan_name: string | null;
  shiten_name: string | null;
  kouza_type: number | null;
  kouza_code: string | null;
  kouza_meigi: string | null;
  // 担当者
  tancd: number | null;
  note: string | null;
}

const KOUZA_TYPE_MAP: Record<number, string> = {
  1: 'ordinary', // 普通
  2: 'current', // 当座
  3: 'savings', // 貯蓄
};

/**
 * t_danka → Customer (+ WorkInfo)
 *
 * - 1顧客=1区画固定（C-1: 3,487/3,487）なので applicant != contractor の場合は
 *   Customer を 2 行作る必要がある → 簡略化: t_danka 1 行を「契約者(owner)」として作成。
 *   申込者(request_*) は SaleContractRole 作成時に別 Customer として用意する（Step 6 で処理）
 *
 * - Customer NOT NULL 必須: name / name_kana / postal_code / address / phone_number
 *   D-1 で 100% 埋まり確認済み（業務確認 2026-05-12）
 *
 * - WorkInfo は job_name がある場合のみ作成（C-3: 13.2%）
 * - email は 0% 運用 → 空ならスキップ（nullable）
 *
 * - 終了顧客（del_flg=2、約150件）も is_terminated=true で取り込む（業務確認 2026-06-07 Q21:
 *   「取り込む・解約者で情報まとめる」、#129）。ただし idMaps.customer には載せない —
 *   契約/ロール/請求/入金のリンク対象にせず、旧入金（約35件）の取り込みも防ぐ（Q19: 取り込まない）。
 *   旧運用は解約時に人情報を消すため（Q18/Q20）、氏名・住所欠損はプレースホルダ/空文字で受け入れる。
 */
export const stepCustomer: MigrationStep = {
  name: 'customer',
  dependsOn: ['staff'],
  async run({ prisma, logger, idMaps, dryRun }) {
    const rows = await legacyQuery<DankaRow>(
      `SELECT * FROM t_danka WHERE del_flg = 0 OR del_flg IS NULL OR del_flg = 2`
    );

    let inserted = 0;
    let skipped = 0;
    let workInfoInserted = 0;
    let skipMissingName = 0;
    let skipMissingRequiredField = 0;
    let skipExisting = 0;
    let terminatedImported = 0;
    let terminatedFieldFallback = 0;

    for (const row of rows) {
      const isTerminated = row.del_flg === 2;

      // 契約者（owner）として Customer を作る
      let name = joinName(row.owner_sei, row.owner_mei);
      let nameKana = joinName(row.owner_sei_kana, row.owner_mei_kana);

      if (!name || !nameKana) {
        if (!isTerminated) {
          logger.warn(
            { danka_cd: row.danka_cd },
            'Skipping t_danka row: owner name/kana missing (data quality issue)'
          );
          skipped++;
          skipMissingName++;
          continue;
        }
        // 終了顧客は氏名が消されている場合がある → プレースホルダで取り込む
        name = name ?? '（氏名不明）';
        nameKana = nameKana ?? '（フメイ）';
        terminatedFieldFallback++;
      }

      // 住所組み立て: addr1 + addr2 + addr3
      const addressParts = [row.addr1, row.addr2, row.addr3]
        .map((p) => cleanStr(p))
        .filter((p): p is string => p !== null);
      let address = addressParts.join(' ');
      let postalCode = parseLegacyZip(row.zip);
      const phone = cleanPhone(row.tel1) ?? cleanPhone(row.tel2);

      // 住所・郵便番号は必須。電話番号は nullable（レガシー実データに 17 件欠損あり、schema 側も nullable）
      if (!address || !postalCode) {
        if (!isTerminated) {
          logger.warn(
            { danka_cd: row.danka_cd, address: !!address, postalCode: !!postalCode },
            'Skipping t_danka row: required field missing'
          );
          skipped++;
          skipMissingRequiredField++;
          continue;
        }
        // 終了顧客は住所等が消されている場合がある → 空文字で取り込む（NOT NULL 制約対応）
        address = address || '';
        postalCode = postalCode ?? '';
        terminatedFieldFallback++;
      }

      const staffId = row.tancd != null ? (idMaps.staff.get(row.tancd) ?? null) : null;

      if (dryRun) {
        if (isTerminated) terminatedImported++;
        else idMaps.customer.set(row.danka_cd, `dry-customer-${row.danka_cd}`);
        inserted++;
        if (cleanStr(row.job_name)) workInfoInserted++;
        continue;
      }

      // 冪等性: legacy_danka_cd で既存チェック
      const existing = await prisma.customer.findFirst({
        where: { legacy_danka_cd: row.danka_cd, deleted_at: null },
      });
      if (existing) {
        if (!isTerminated) idMaps.customer.set(row.danka_cd, existing.id);
        skipped++;
        skipExisting++;
        continue;
      }

      const customer = await prisma.customer.create({
        data: {
          name,
          name_kana: nameKana,
          birth_date: parseLegacyDate(row.birthday),
          gender: parseGender(row.sex_flg),
          postal_code: postalCode,
          address,
          registered_postal_code: parseLegacyZip(row.honseki_zip),
          registered_address:
            [cleanStr(row.honseki_addr1), cleanStr(row.honseki_addr2)].filter(Boolean).join(' ') ||
            null,
          phone_number: phone,
          fax_number: cleanPhone(row.fax),
          email: cleanStr(row.email1),
          // 振込先（レガシーで 0 件運用、将来入力用にカラムだけ存在）
          bank_name: cleanStr(row.kikan_name),
          branch_name: cleanStr(row.shiten_name),
          account_type: row.kouza_type ? (KOUZA_TYPE_MAP[row.kouza_type] ?? null) : null,
          account_number: cleanStr(row.kouza_code),
          account_holder: cleanStr(row.kouza_meigi),
          // 終了顧客は「解約場所が分かるように」（Q18/Q20）旧区画への手がかりを notes に残す
          notes: isTerminated
            ? [
                `[解約済み顧客] 旧システム del_flg=2。旧区画cd: ${row.grave_cd}（区画No: legacy-${row.grave_cd}）`,
                cleanStr(row.note),
              ]
                .filter(Boolean)
                .join('\n')
            : cleanStr(row.note),
          staff_id: staffId,
          legacy_danka_cd: row.danka_cd,
          is_terminated: isTerminated,
        },
      });
      if (isTerminated) terminatedImported++;
      else idMaps.customer.set(row.danka_cd, customer.id);
      inserted++;

      // WorkInfo（job_name がある場合のみ）
      const jobName = cleanStr(row.job_name);
      if (jobName) {
        await prisma.workInfo.create({
          data: {
            customer_id: customer.id,
            company_name: jobName,
            company_name_kana: cleanStr(row.job_name_kana) ?? jobName,
            work_address:
              [row.job_addr1, row.job_addr2, row.job_addr3]
                .map(cleanStr)
                .filter((p): p is string => p !== null)
                .join(' ') || '',
            work_postal_code: parseLegacyZip(row.job_zip) ?? '',
            work_phone_number: cleanPhone(row.job_tel1) ?? '',
            dm_setting: 'deny', // C-3 でメール送信 0 件運用 → デフォルト deny
            address_type: 'work',
          },
        });
        workInfoInserted++;
      }
    }

    return {
      inserted,
      skipped,
      notes: {
        source_rows: rows.length,
        work_info_inserted: workInfoInserted,
        skip_missing_name: skipMissingName,
        skip_missing_required_field: skipMissingRequiredField,
        skip_existing: skipExisting,
        terminated_imported: terminatedImported,
        terminated_field_fallback: terminatedFieldFallback,
      },
    };
  },
};
