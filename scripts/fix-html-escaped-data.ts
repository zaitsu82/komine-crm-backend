/**
 * HTMLエスケープ済みデータの一括是正スクリプト（#218）
 *
 * 旧 sanitizeInput が入力時に HTML エスケープ（& < > " ' /）した値を
 * DB へ永続化していたため、既存データに &amp; &#x27; &#x2F; 等の
 * HTMLエンティティが混入している。本スクリプトはそれらを元の文字へ復号する。
 *
 * 使い方:
 *   npx ts-node scripts/fix-html-escaped-data.ts            # dry-run（件数と変更例の表示のみ）
 *   npx ts-node scripts/fix-html-escaped-data.ts --apply    # 実際に更新
 *
 * 二重エスケープ（&amp;amp; 等）にも対応するため、変化しなくなるまで
 * （最大5回）復号を繰り返す。
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const APPLY = process.argv.includes('--apply');

/** 旧 sanitizeString が生成していたエンティティのみを対象に復号する */
const decodeOnce = (value: string): string =>
  value
    .replace(/&#x2F;/g, '/')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&'); // & は最後に戻す（順序重要）

const decodeFully = (value: string): string => {
  let current = value;
  for (let i = 0; i < 5; i++) {
    const next = decodeOnce(current);
    if (next === current) break;
    current = next;
  }
  return current;
};

/** エンティティ混入の検出パターン（旧 sanitizeString が生成する6種） */
const ENTITY_PATTERN = /&(amp|lt|gt|quot|#x27|#x2F);/;

/**
 * 是正対象のモデルとテキスト系フィールド。
 * ゆうちょCSV・帳票に乗る列（顧客名義・口座情報）を最優先に、
 * ユーザー入力由来の自由記述フィールドを広めにカバーする。
 */
const TARGETS: Array<{ model: string; idField: string; fields: string[] }> = [
  {
    model: 'customer',
    idField: 'id',
    fields: [
      'name',
      'name_kana',
      'address',
      'address_line_2',
      'registered_address',
      'email',
      'notes',
      'bank_name',
      'branch_name',
      'account_number',
      'account_holder',
    ],
  },
  {
    model: 'familyContact',
    idField: 'id',
    fields: [
      'name',
      'name_kana',
      'address',
      'registered_address',
      'email',
      'work_company_name',
      'work_company_name_kana',
      'work_address',
      'notes',
    ],
  },
  {
    model: 'buriedPerson',
    idField: 'id',
    fields: [
      'name',
      'name_kana',
      'posthumous_name',
      'relationship',
      'religion',
      'death_place',
      'cause_of_death',
      'chief_mourner_name',
      'chief_mourner_relationship',
      'notes',
    ],
  },
  { model: 'physicalPlot', idField: 'id', fields: ['notes'] },
  {
    model: 'contractPlot',
    idField: 'id',
    fields: ['location_description', 'staff_in_charge', 'agent_name', 'notes'],
  },
  {
    model: 'gravestoneInfo',
    idField: 'id',
    fields: [
      'gravestone_base',
      'enclosure_position',
      'gravestone_dealer',
      'gravestone_type',
      'surrounding_area',
      'gravestone_inscription',
    ],
  },
  { model: 'constructionInfo', idField: 'id', fields: ['construction_type', 'notes'] },
  { model: 'collectiveBurial', idField: 'id', fields: ['notes'] },
  { model: 'workInfo', idField: 'id', fields: ['company_name', 'work_address', 'notes'] },
  { model: 'staff', idField: 'id', fields: ['name'] },
  { model: 'document', idField: 'id', fields: ['name', 'description', 'notes'] },
  { model: 'billing', idField: 'id', fields: ['notes'] },
  { model: 'payment', idField: 'id', fields: ['staff_in_charge', 'notes'] },
];

interface ModelDelegate {
  findMany(args: unknown): Promise<Record<string, unknown>[]>;
  update(args: unknown): Promise<unknown>;
}

async function main(): Promise<void> {
  const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL'] });
  const prisma = new PrismaClient({ adapter });

  console.log(`=== HTMLエスケープ済みデータの是正 (${APPLY ? 'APPLY' : 'DRY-RUN'}) ===`);

  let totalRows = 0;
  let totalFields = 0;

  try {
    for (const target of TARGETS) {
      const delegate = (prisma as unknown as Record<string, ModelDelegate>)[target.model];
      if (!delegate) {
        console.warn(`! モデル ${target.model} が見つかりません（スキップ）`);
        continue;
      }

      // エンティティ混入の可能性がある行のみ取得（contains は近似フィルタ、最終判定は正規表現）
      const rows = await delegate.findMany({
        where: {
          OR: target.fields.map((f) => ({ [f]: { contains: '&' } })),
        },
        select: Object.fromEntries(
          [target.idField, ...target.fields].map((f) => [f, true])
        ) as Record<string, boolean>,
      });

      let modelRows = 0;
      for (const row of rows) {
        const data: Record<string, string> = {};
        for (const field of target.fields) {
          const value = row[field];
          if (typeof value !== 'string' || !ENTITY_PATTERN.test(value)) continue;
          const decoded = decodeFully(value);
          if (decoded !== value) {
            data[field] = decoded;
          }
        }
        if (Object.keys(data).length === 0) continue;

        modelRows += 1;
        totalFields += Object.keys(data).length;

        const id = row[target.idField];
        if (APPLY) {
          await delegate.update({ where: { [target.idField]: id }, data });
        } else {
          // dry-run: 変更内容のサンプル表示
          for (const [field, decoded] of Object.entries(data)) {
            console.log(
              `  [${target.model}.${field}] id=${String(id)}: ${JSON.stringify(row[field])} -> ${JSON.stringify(decoded)}`
            );
          }
        }
      }

      if (modelRows > 0) {
        totalRows += modelRows;
        console.log(`${target.model}: ${modelRows} 行 ${APPLY ? '更新' : '是正対象'}`);
      }
    }

    console.log(`=== 合計: ${totalRows} 行 / ${totalFields} フィールド ===`);
    if (!APPLY && totalRows > 0) {
      console.log('実際に更新するには --apply を付けて再実行してください');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
