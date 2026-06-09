/// <reference types="node" />
/**
 * 合祀情報の一括投入バッチ（#359）
 *
 * 事務所のエクセル（区画残数/合祀台帳）を CSV で受け取り、共同区画の合祀情報を
 * 本番へ一括投入する。詳細ロジックは src/collective-burials/collectiveBurialImportService.ts。
 *
 * CSV（ヘッダ行必須・列順不問。日本語ヘッダ対応）:
 *   区画番号, 埋葬上限数, 合祀年数, 現在埋葬数(任意), 請求金額(任意), 備考(任意)
 *   （英語ヘッダ plotNumber/burialCapacity/validityPeriodYears/currentBurialCount/billingAmount/notes も可）
 *
 * 使い方:
 *   npm run import:collective-burials -- --file=path/to/data.csv               # dry-run
 *   npm run import:collective-burials -- --file=path/to/data.csv --apply        # 投入
 *   npm run import:collective-burials -- --file=path/to/data.csv --apply --overwrite  # 既存も更新
 *   （Excel が Shift-JIS 保存の場合）... --sjis
 *
 * 冪等: 既存（生存）合祀は既定でスキップ。--overwrite で上書き、ソフトデリート行は復活。
 */
import 'dotenv/config';
import * as fs from 'fs';
import iconv from 'iconv-lite';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  importCollectiveBurials,
  CollectiveBurialImportRow,
} from '../src/collective-burials/collectiveBurialImportService';

const APPLY = process.argv.includes('--apply');
const OVERWRITE = process.argv.includes('--overwrite');
const SJIS = process.argv.includes('--sjis');

function getArg(name: string): string | undefined {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.slice(`--${name}=`.length) : undefined;
}

/** RFC4180 風の最小 CSV パーサ（引用符・改行・カンマ対応）。 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  // 先頭の BOM を除去
  const s = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch === '\r') {
      // CRLF / CR を吸収（次が \n ならスキップ）
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const HEADER_ALIASES: Record<keyof CollectiveBurialImportRow, string[]> = {
  plotNumber: ['区画番号', 'plotnumber', 'plot_number', '区画'],
  burialCapacity: ['埋葬上限数', '埋葬上限', 'burialcapacity', 'capacity'],
  validityPeriodYears: ['合祀年数', '有効期間', 'validityperiodyears', 'years'],
  currentBurialCount: ['現在埋葬数', '埋葬数', 'currentburialcount', 'count'],
  billingAmount: ['請求金額', '金額', 'billingamount', 'amount'],
  notes: ['備考', 'notes', 'note'],
};

function buildColumnIndex(
  header: string[]
): Partial<Record<keyof CollectiveBurialImportRow, number>> {
  const norm = (h: string): string => h.trim().toLowerCase().replace(/\s/g, '');
  const idx: Partial<Record<keyof CollectiveBurialImportRow, number>> = {};
  header.forEach((h, i) => {
    const key = norm(h);
    for (const field of Object.keys(HEADER_ALIASES) as (keyof CollectiveBurialImportRow)[]) {
      if (HEADER_ALIASES[field].some((a) => norm(a) === key)) idx[field] = i;
    }
  });
  return idx;
}

function toInt(v: string | undefined): number | undefined {
  if (v == null) return undefined;
  const digits = v.replace(/[^\d-]/g, '');
  if (digits === '') return undefined;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : undefined;
}

function rowsFromCsv(matrix: string[][]): CollectiveBurialImportRow[] {
  if (matrix.length < 2) return [];
  const idx = buildColumnIndex(matrix[0]!);
  if (idx.plotNumber == null || idx.burialCapacity == null || idx.validityPeriodYears == null) {
    throw new Error(
      'CSV ヘッダに 区画番号 / 埋葬上限数 / 合祀年数 が必要です（英語ヘッダも可）。検出: ' +
        matrix[0]!.join(', ')
    );
  }
  const out: CollectiveBurialImportRow[] = [];
  for (let r = 1; r < matrix.length; r++) {
    const cols = matrix[r]!;
    const cell = (i: number | undefined): string | undefined =>
      i == null ? undefined : cols[i]?.trim();
    out.push({
      plotNumber: cell(idx.plotNumber) ?? '',
      burialCapacity: toInt(cell(idx.burialCapacity)) ?? NaN,
      validityPeriodYears: toInt(cell(idx.validityPeriodYears)) ?? NaN,
      currentBurialCount: toInt(cell(idx.currentBurialCount)),
      billingAmount: toInt(cell(idx.billingAmount)) ?? null,
      notes: cell(idx.notes) || null,
    });
  }
  return out;
}

async function main(): Promise<void> {
  const file = getArg('file');
  if (!file) throw new Error('--file=path/to/data.csv を指定してください');
  const buf = fs.readFileSync(file);
  const text = SJIS ? iconv.decode(buf, 'Shift_JIS') : buf.toString('utf8');
  const rows = rowsFromCsv(parseCsv(text));

  console.log(
    `[import:collective-burials] file=${file} rows=${rows.length} apply=${APPLY} overwrite=${OVERWRITE}`
  );

  const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL'] });
  const prisma = new PrismaClient({ adapter });
  try {
    const summary = await importCollectiveBurials(prisma, rows, {
      apply: APPLY,
      overwrite: OVERWRITE,
    });
    const { results, ...counts } = summary;
    console.log(JSON.stringify(counts, null, 2));

    // 該当しなかった/曖昧/不正な行は明示する（請求漏れ・取りこぼし検知）
    const problems = results.filter((r) =>
      ['notFound', 'ambiguous', 'invalid'].includes(r.outcome)
    );
    if (problems.length > 0) {
      console.log(`\n⚠️ 要確認 ${problems.length} 行:`);
      for (const p of problems.slice(0, 50)) {
        console.log(`  [${p.outcome}] ${p.plotNumber}${p.message ? ` — ${p.message}` : ''}`);
      }
      if (problems.length > 50) console.log(`  ...他 ${problems.length - 50} 行`);
    }
    if (!APPLY) console.log('\n（dry-run。--apply で実際に投入します）');
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error('ERROR', e);
    process.exitCode = 1;
  });
}
