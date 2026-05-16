/// <reference types="node" />
/**
 * READ-only legacy MySQL query runner with PII masking.
 *
 * 詳細仕様は query_result/RECOVERY_PHASE1_HARDENING.md Task 1 を参照。
 *
 * 使い方:
 *   npx ts-node --transpile-only scripts/query-legacy.ts --sql "SELECT ..."
 *   echo "SELECT ..." | npx ts-node --transpile-only scripts/query-legacy.ts
 *
 * フラグ:
 *   --sql "<SELECT>"        実行する SQL（省略時 stdin から読む）
 *   --json                  console.table ではなく JSON 出力
 *   --unmask=col1,col2      指定カラムのマスクを解除
 *   --unmask-all            全マスクを解除（明示）
 *   --no-limit              1000 行ガードを無効化
 *   --help, -h              ヘルプ
 */

import 'dotenv/config';

import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import yaml from 'js-yaml';

import { closeLegacyPool, legacyQuery } from './legacy-migration/legacyDb';

const MASK_CONFIG_PATH = resolve(__dirname, '..', '..', 'query_result', 'legacy-mask-config.yaml');
const AUDIT_LOG_PATH = resolve(__dirname, '..', '.query-legacy.audit.log');
const ROW_LIMIT = 1000;
const MASK_VALUE = '***';

interface CliOptions {
  sql: string | null;
  json: boolean;
  unmask: Set<string>;
  unmaskAll: boolean;
  noLimit: boolean;
}

interface MaskConfig {
  mask: Record<string, string[]>;
}

function printHelp(): void {
  // eslint-disable-next-line no-console
  console.log(`Usage: npx ts-node --transpile-only scripts/query-legacy.ts [options]

Options:
  --sql "<SELECT>"        Execute the given SELECT statement (otherwise read from stdin)
  --json                  Output as JSON instead of console.table
  --unmask=col1,col2      Reveal these columns (matched by column name, case-sensitive)
  --unmask-all            Reveal all masked columns (explicit opt-out)
  --no-limit              Disable the 1000-row safety cap
  --help, -h              Print this help

Only SELECT is allowed. Audit log: .query-legacy.audit.log
`);
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    sql: null,
    json: false,
    unmask: new Set(),
    unmaskAll: false,
    noLimit: false,
  };
  const args = argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--help' || a === '-h') {
      printHelp();
      process.exit(0);
    } else if (a === '--json') {
      opts.json = true;
    } else if (a === '--unmask-all') {
      opts.unmaskAll = true;
    } else if (a === '--no-limit') {
      opts.noLimit = true;
    } else if (a === '--sql') {
      opts.sql = args[++i] ?? null;
    } else if (a?.startsWith('--sql=')) {
      opts.sql = a.slice('--sql='.length);
    } else if (a?.startsWith('--unmask=')) {
      a.slice('--unmask='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((c) => opts.unmask.add(c));
    } else {
      process.stderr.write(`Unknown argument: ${String(a)}\n`);
      process.exit(2);
    }
  }
  return opts;
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return '';
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
  }
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * SQL コメントを取り除く（-- 行コメント / /* ブロックコメント）
 *   文字列リテラル内のコメント風シーケンスは厳密には扱わないが、
 *   ここでは「先頭トークンが SELECT か」を判定するための前処理として実用十分。
 */
function stripComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ')
    .trim();
}

const FORBIDDEN_KEYWORDS = [
  'UPDATE',
  'DELETE',
  'INSERT',
  'CREATE',
  'DROP',
  'ALTER',
  'TRUNCATE',
  'REPLACE',
  'GRANT',
  'REVOKE',
  'RENAME',
  'CALL',
  'LOCK',
  'UNLOCK',
];

function validateSelectOnly(sql: string): void {
  const stripped = stripComments(sql);
  if (stripped.length === 0) {
    throw new Error('Empty SQL');
  }
  if (!/^select\b/i.test(stripped)) {
    throw new Error('Only SELECT statements are allowed');
  }
  for (const kw of FORBIDDEN_KEYWORDS) {
    const re = new RegExp(`\\b${kw}\\b`, 'i');
    if (re.test(stripped)) {
      throw new Error(`Only SELECT statements are allowed (forbidden keyword found: ${kw})`);
    }
  }
}

function loadMaskConfig(): { masked: Set<string>; raw: MaskConfig } {
  const text = readFileSync(MASK_CONFIG_PATH, 'utf8');
  const raw = yaml.load(text) as MaskConfig | null;
  if (!raw || typeof raw !== 'object' || !raw.mask) {
    throw new Error(`Invalid mask config at ${MASK_CONFIG_PATH}: missing 'mask' section`);
  }
  const masked = new Set<string>();
  for (const cols of Object.values(raw.mask)) {
    if (!Array.isArray(cols)) continue;
    for (const c of cols) {
      if (typeof c === 'string' && c.length > 0) masked.add(c);
    }
  }
  return { masked, raw };
}

const AGGREGATE_FN_RE =
  /\b(COUNT|SUM|AVG|MIN|MAX|GROUP_CONCAT|BIT_AND|BIT_OR|BIT_XOR|STDDEV|VARIANCE)\s*\(\s*(?:DISTINCT\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\)/gi;

/**
 * SQL 中の集計関数呼び出しに含まれるマスク対象カラム名を検出し、
 * stderr に警告を出す（ブロックはしない）。
 */
function warnIfMaskedColumnInAggregate(
  sql: string,
  masked: Set<string>,
  effectiveMasked: Set<string>
): void {
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  AGGREGATE_FN_RE.lastIndex = 0;
  while ((m = AGGREGATE_FN_RE.exec(sql)) !== null) {
    const col = m[2];
    if (!col) continue;
    if (masked.has(col) && effectiveMasked.has(col) && !seen.has(col)) {
      seen.add(col);
      process.stderr.write(
        `[query-legacy] warning: aggregate over masked column "${col}" — value cannot be masked in result\n`
      );
    }
  }
}

function ensureLimit(sql: string, noLimit: boolean): { sql: string; cap: number } {
  if (noLimit) return { sql, cap: Infinity };
  const stripped = stripComments(sql);
  // 末尾近くに LIMIT 句があれば既存を尊重
  if (/\blimit\b\s+\d+/i.test(stripped)) {
    return { sql, cap: Infinity };
  }
  const trimmed = sql.replace(/;\s*$/, '');
  return { sql: `${trimmed} LIMIT ${ROW_LIMIT + 1}`, cap: ROW_LIMIT };
}

type Row = Record<string, unknown>;

function applyMask(rows: Row[], effectiveMasked: Set<string>): Row[] {
  if (effectiveMasked.size === 0 || rows.length === 0) return rows;
  return rows.map((row) => {
    const out: Row = {};
    for (const [k, v] of Object.entries(row)) {
      if (!effectiveMasked.has(k)) {
        out[k] = v;
        continue;
      }
      if (v === null || v === undefined) {
        out[k] = v;
      } else if (typeof v === 'string' && v.length === 0) {
        out[k] = v;
      } else if (Buffer.isBuffer(v)) {
        out[k] = MASK_VALUE;
      } else {
        out[k] = MASK_VALUE;
      }
    }
    return out;
  });
}

function appendAuditLog(entry: Record<string, unknown>): void {
  try {
    appendFileSync(AUDIT_LOG_PATH, `${JSON.stringify(entry)}\n`, { encoding: 'utf8' });
  } catch (err) {
    // 監査ログ書き込み失敗は致命ではないが stderr に残す
    process.stderr.write(
      `[query-legacy] warning: failed to write audit log: ${(err as Error).message}\n`
    );
  }
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv);
  const sql = (opts.sql ?? (await readStdin())).trim();
  if (!sql) {
    process.stderr.write('No SQL provided (use --sql "<SELECT>" or pipe via stdin)\n');
    process.exit(2);
  }
  validateSelectOnly(sql);

  const { masked } = loadMaskConfig();
  const effectiveMasked = opts.unmaskAll
    ? new Set<string>()
    : new Set([...masked].filter((c) => !opts.unmask.has(c)));

  warnIfMaskedColumnInAggregate(sql, masked, effectiveMasked);

  const { sql: finalSql, cap } = ensureLimit(sql, opts.noLimit);

  const startedAt = new Date().toISOString();
  let rowCount = 0;
  let truncated = false;
  let errorMessage: string | null = null;

  try {
    const rows = (await legacyQuery(finalSql)) as Row[];
    rowCount = rows.length;
    let displayRows = rows;
    if (Number.isFinite(cap) && rows.length > cap) {
      truncated = true;
      displayRows = rows.slice(0, cap);
      process.stderr.write(
        `[query-legacy] warning: result truncated to ${cap} rows (use --no-limit to disable)\n`
      );
    }
    const output = applyMask(displayRows, effectiveMasked);
    if (opts.json) {
      process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    } else {
      // eslint-disable-next-line no-console
      console.table(output);
    }
  } catch (err) {
    errorMessage = (err as Error).message;
    process.stderr.write(`[query-legacy] error: ${errorMessage}\n`);
    process.exitCode = 1;
  } finally {
    appendAuditLog({
      ts: startedAt,
      sql,
      unmask: [...opts.unmask],
      unmask_all: opts.unmaskAll,
      no_limit: opts.noLimit,
      rows: rowCount,
      truncated,
      error: errorMessage,
    });
    await closeLegacyPool();
  }
}

main().catch((err) => {
  process.stderr.write(`[query-legacy] fatal: ${(err as Error).message}\n`);
  process.exit(1);
});
