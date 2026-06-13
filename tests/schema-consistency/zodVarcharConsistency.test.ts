/**
 * zod `.max()` ⇔ schema.prisma `@db.VarChar(n)` 突き合わせテスト（#321）
 *
 * 背景: 共有 zod スキーマ（@komine/types）の `.max()` と Prisma の `@db.VarChar` 長の
 * 不整合が過去3回再発した（types#37 / #38 / #40）。不整合があると「中間長」の入力が
 * client/backend 双方の zod を通過し、Prisma P2000 で更新 tx 全体が 500 になる。
 * 機械的な突き合わせ検査が無いのが根本原因のため、ここで回帰テストを置く。
 *
 * 置き場が backend な理由: CI が types main を直接 clone する構成のため、types 側の
 * 将来の変更も backend CI で自動検知できる。schema.prisma も手元にある。
 *
 * 検査内容:
 *   VarChar(n) 列に対応する zod string フィールドは「`.max()` が存在し、かつ max ≤ n」。
 *   - zod max < VarChar（zod が厳しい側）は安全なので違反としない。
 *   - `@db.Text` 列は対象外（長さ無制限）。
 *   - 数値フィールドの `.max()`（例: targetMonth.max(12)）は string ではないので無視する。
 *   - マッピング表に載らない zod フィールド / VarChar 列はテスト失敗にせず coverage 集計のみ。
 *
 * ベースライン方針（issue #321 の「最初から全量強制せず増減を追う」に従う）:
 *   現時点で既に存在する不整合は KNOWN_VIOLATIONS に文書化済みで許容する。
 *   テストは「KNOWN に無い新規不整合（= #38→#40 のような横展開漏れ）」で落ちる。
 *   KNOWN の各エントリが解消されたら（VarChar 拡幅 or zod 縮小）テストが
 *   「stale baseline」で落ちるので、必ず KNOWN から削除する＝ベースラインは縮む一方になる。
 *   KNOWN の正式対応（拡幅 vs zod 縮小の方針確定）は別 issue で追跡する。
 *
 * 例外マッピングの保守:
 *   camelCase ↔ snake_case 変換（数字サフィックス前にも `_` を挿入。例: workItem1 →
 *   work_item_1）で大半は解決する。規約で対応できないものだけ EXCEPTIONS に
 *   `schemaName -> { zodField: prismaColumn }` で明示する。現状は規約変換で全件解決するため空。
 */

import { readFileSync } from 'fs';
import path from 'path';
import * as types from '@komine/types';
import * as plotValidation from '../../src/validations/plotValidation';

// ---- Prisma schema 側: model -> { column: varcharLen } を抽出 ----

type PrismaVarcharMap = Record<string, Record<string, number>>;

function parsePrismaVarchar(schemaText: string): PrismaVarcharMap {
  const models: PrismaVarcharMap = {};
  const modelRe = /model\s+(\w+)\s*\{([\s\S]*?)\n\}/g;
  let m: RegExpExecArray | null;
  while ((m = modelRe.exec(schemaText)) !== null) {
    const [, name, body] = m;
    const cols: Record<string, number> = {};
    for (const line of body.split('\n')) {
      const fm = line.match(/^\s*(\w+)\s+\S+.*@db\.VarChar\((\d+)\)/);
      if (fm) cols[fm[1]] = parseInt(fm[2], 10);
    }
    models[name] = cols;
  }
  return models;
}

// ---- zod 側: object schema の string フィールド -> max を抽出 ----

interface UnwrapResult {
  def: { type?: string };
  node: { maxLength?: number | null };
}

/** zod ノードが `z.literal('')`（空文字リテラル）かどうか。 */
function isEmptyLiteral(node: unknown): boolean {
  const d = node as {
    _def?: { type?: string; values?: unknown[] };
    def?: { type?: string; values?: unknown[] };
  };
  const def = d._def || d.def;
  if (!def || def.type !== 'literal') return false;
  // zod4: literal の値は def.values（配列）に入る。'' のみのリテラルを空文字扱いする。
  const values = def.values;
  if (!Array.isArray(values)) return false;
  return values.length === 1 && values[0] === '';
}

/**
 * optional / nullable / default / pipe(preprocess) / union を剥がして内側の string に到達する。
 *
 * union 対応（#395 の死角是正）: backend ローカルスキーマは `z.string().max(n).optional().or(z.literal(''))`
 * 形式（= ZodUnion[ stringish, literal('') ]）を多用する。これを剥がさないと string と認識されず
 * VarChar 突き合わせの対象外になり、plotValidation の workPostalCode max(10) を見逃す原因になっていた。
 * union のうち `literal('')` でない枝を選んで再帰的に剥がす。
 */
function unwrapZod(schema: unknown): UnwrapResult {
  let cur = schema as {
    _def?: { type?: string; innerType?: unknown; out?: unknown; options?: unknown[] };
    def?: { type?: string; innerType?: unknown; out?: unknown; options?: unknown[] };
    unwrap?: () => unknown;
  };
  for (let i = 0; i < 12; i++) {
    const d = cur._def || cur.def;
    if (!d) break;
    const type = d.type;
    if (
      ['optional', 'nullable', 'default', 'readonly', 'catch', 'nonoptional'].includes(
        type as string
      )
    ) {
      cur = (d.innerType as typeof cur) || (cur.unwrap ? (cur.unwrap() as typeof cur) : cur);
    } else if (type === 'union') {
      // `...or(z.literal(''))` パターン: 空文字リテラル以外の枝を選んで剥がし続ける。
      const options = Array.isArray(d.options) ? d.options : [];
      const branch = options.find((o) => !isEmptyLiteral(o));
      if (branch) {
        cur = branch as typeof cur;
      } else {
        break;
      }
    } else if (type === 'pipe') {
      // z.preprocess / z.coerce などは out 側が実体
      cur = (d.out as typeof cur) || cur;
      break;
    } else {
      break;
    }
  }
  const d = (cur._def || cur.def) as { type?: string };
  return { def: d, node: cur as unknown as { maxLength?: number | null } };
}

/**
 * スキーマを optional / nullable / union を剥がして内側の ZodObject の `.shape` を取り出す。
 *
 * 共有スキーマは素の `z.object(...)`（.shape 直結）だが、backend ローカルスキーマは
 * `z.object(...).optional().or(z.null())` 形式（= union[ optional[object], null ]）なので、
 * .shape まで降りないと string フィールドを 1 つも拾えず VarChar 突き合わせがスキップされる。
 * これが #395 でローカル workInfoSchema を検査対象にしても workPostalCode を見逃した一因。
 */
function findObjectShape(schema: unknown): Record<string, unknown> | undefined {
  let cur = schema as {
    shape?: Record<string, unknown>;
    _def?: { type?: string; innerType?: unknown; options?: unknown[] };
    def?: { type?: string; innerType?: unknown; options?: unknown[] };
  };
  for (let i = 0; i < 12; i++) {
    if (cur.shape) return cur.shape;
    const d = cur._def || cur.def;
    if (!d) break;
    if (
      ['optional', 'nullable', 'default', 'readonly', 'catch', 'nonoptional'].includes(
        d.type as string
      )
    ) {
      cur = d.innerType as typeof cur;
    } else if (d.type === 'union') {
      const options = Array.isArray(d.options) ? d.options : [];
      // 空文字 / null リテラル枝を避け、object に到達できる枝を選ぶ。
      const branch = options.find(
        (o) => !isEmptyLiteral(o) && (o as { _def?: { type?: string } })._def?.type !== 'null'
      );
      if (!branch) break;
      cur = branch as typeof cur;
    } else {
      break;
    }
  }
  return cur.shape;
}

/** object schema から { field: maxLength|null } を集める（string 型のみ）。 */
function collectZodStringMaxes(objectSchema: unknown): Record<string, number | null> {
  const shape = findObjectShape(objectSchema);
  const out: Record<string, number | null> = {};
  if (!shape) return out;
  for (const [key, value] of Object.entries(shape)) {
    const { def, node } = unwrapZod(value);
    if (def.type === 'string') {
      out[key] = node.maxLength ?? null;
    }
  }
  return out;
}

// ---- camelCase -> snake_case（数字サフィックス前にも `_`）----

function camelToSnake(s: string): string {
  return s
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([a-zA-Z])([0-9])/g, '$1_$2')
    .toLowerCase();
}

// ---- 共有スキーマ / backend ローカルスキーマ -> Prisma モデルの対応 ----
//
// source で実体の取得元を切り替える:
//   - 'types'  … @komine/types の共有スキーマ（client/backend 双方が使う）
//   - 'local'  … backend ローカルスキーマ（src/validations 配下。plot ルートで実使用される）
//
// 死角の是正（#395）: #321 導入時は共有スキーマ（'types'）だけを検査していたが、
// plot ルートが実際に使う workInfoSchema は plotValidation.ts のローカル定義であり、
// 共有 workInfoSchema（max(7) で正しい）を見ても plotValidation の workPostalCode max(10) を
// 検知できなかった。実使用されるローカルスキーマも対象に含めることで構造的死角を塞ぐ。

type SchemaSource = 'types' | 'local';

const SCHEMA_MODEL_PAIRS: Array<{ schemaName: string; model: string; source: SchemaSource }> = [
  { schemaName: 'physicalPlotSchema', model: 'PhysicalPlot', source: 'types' },
  { schemaName: 'contractPlotSchema', model: 'ContractPlot', source: 'types' },
  { schemaName: 'saleContractSchema', model: 'ContractPlot', source: 'types' },
  { schemaName: 'customerSchema', model: 'Customer', source: 'types' },
  { schemaName: 'applicantSchema', model: 'Customer', source: 'types' },
  { schemaName: 'workInfoSchema', model: 'WorkInfo', source: 'types' },
  { schemaName: 'usageFeeSchema', model: 'UsageFee', source: 'types' },
  { schemaName: 'managementFeeSchema', model: 'ManagementFee', source: 'types' },
  { schemaName: 'gravestoneInfoSchema', model: 'GravestoneInfo', source: 'types' },
  { schemaName: 'familyContactSchema', model: 'FamilyContact', source: 'types' },
  { schemaName: 'buriedPersonSchema', model: 'BuriedPerson', source: 'types' },
  { schemaName: 'constructionInfoSchema', model: 'ConstructionInfo', source: 'types' },
  { schemaName: 'collectiveBurialSchema', model: 'CollectiveBurial', source: 'types' },
  { schemaName: 'createPaymentSchema', model: 'Payment', source: 'types' },
  { schemaName: 'createBillingSchema', model: 'Billing', source: 'types' },
  { schemaName: 'updateBillingSchema', model: 'Billing', source: 'types' },
  // backend ローカル（plotValidation.ts）— plot ルートで実使用される定義。#395 の死角是正。
  { schemaName: 'workInfoSchema', model: 'WorkInfo', source: 'local' },
];

/** source -> モジュール名前空間。schemaName をキーに実スキーマを引く。 */
const SCHEMA_NAMESPACES: Record<SchemaSource, Record<string, unknown>> = {
  types: types as Record<string, unknown>,
  local: plotValidation as Record<string, unknown>,
};

/** schemaName -> { zodField: prismaColumn } の明示マッピング（規約変換で解決できないもの）。 */
const EXCEPTIONS: Record<string, Record<string, string>> = {
  // 現状は camelToSnake（数字前 `_` 含む）で全件解決するため空。
};

/**
 * 既知の不整合ベースライン（key=`${schemaName}.${zodField}`、value=対応 VarChar 長）。
 * 本テスト導入時点の不整合9件は #338 / types#46 で全て解消（電話/郵便は「数字のみ保存」確定で
 * zod を VarChar に縮小、paymentMethod/gravestoneType も zod を縮小）。ベースラインは空に戻した。
 * 今後 zod max > VarChar が新たに出たらテストが落ちる。正当な例外を許容する場合のみここへ追記する。
 */
const KNOWN_VIOLATIONS: Record<string, number> = {};

interface Violation {
  key: string;
  schemaName: string;
  model: string;
  zodField: string;
  column: string;
  zodMax: number;
  varcharLen: number;
}

interface CheckResult {
  violations: Violation[];
  coveredColumns: Set<string>;
  uncoveredZodFields: string[];
}

function checkConsistency(
  prismaVarchar: PrismaVarcharMap,
  pairs: Array<{ schemaName: string; model: string; schema: unknown; source?: SchemaSource }>,
  exceptions: Record<string, Record<string, string>>
): CheckResult {
  const violations: Violation[] = [];
  const coveredColumns = new Set<string>();
  const uncoveredZodFields: string[] = [];

  for (const { schemaName, model, schema, source } of pairs) {
    // 同名スキーマ（types/local の workInfoSchema 等）の key 衝突を避けるため source を前置する。
    const prefix = source ? `${source}:${schemaName}` : schemaName;
    const zodMaxes = collectZodStringMaxes(schema);
    const modelCols = prismaVarchar[model] || {};
    for (const [zodField, zodMax] of Object.entries(zodMaxes)) {
      const column = exceptions[schemaName]?.[zodField] ?? camelToSnake(zodField);
      const varcharLen = modelCols[column];
      if (varcharLen === undefined) {
        uncoveredZodFields.push(`${prefix}.${zodField}`);
        continue;
      }
      if (zodMax === null) {
        // VarChar 列だが zod に max が無い（#37 系）。本テストは max>VarChar 回帰防止が責務なので
        // 失敗にはせず coverage 外として記録のみ。
        uncoveredZodFields.push(`${prefix}.${zodField} (no zod max, VarChar(${varcharLen}))`);
        continue;
      }
      coveredColumns.add(`${model}.${column}`);
      if (zodMax > varcharLen) {
        violations.push({
          key: `${prefix}.${zodField}`,
          schemaName,
          model,
          zodField,
          column,
          zodMax,
          varcharLen,
        });
      }
    }
  }

  return { violations, coveredColumns, uncoveredZodFields };
}

// ---- テスト本体 ----

describe('zod max ⇔ schema.prisma VarChar consistency (#321)', () => {
  const schemaText = readFileSync(path.join(__dirname, '../../prisma/schema.prisma'), 'utf8');
  const prismaVarchar = parsePrismaVarchar(schemaText);

  const pairs = SCHEMA_MODEL_PAIRS.map(({ schemaName, model, source }) => ({
    schemaName,
    model,
    source,
    schema: SCHEMA_NAMESPACES[source][schemaName],
  }));

  it('全スキーマ（共有 + backend ローカル）が解決できる', () => {
    const missing = pairs.filter((p) => !p.schema).map((p) => `${p.source}:${p.schemaName}`);
    expect(missing).toEqual([]);
  });

  it('schema.prisma の VarChar 列が抽出できている', () => {
    const totalCols = Object.values(prismaVarchar).reduce(
      (n, cols) => n + Object.keys(cols).length,
      0
    );
    expect(totalCols).toBeGreaterThan(100); // 現状 145 列
  });

  it('KNOWN_VIOLATIONS 以外に zod max > VarChar の不整合が無い（#38→#40 横展開漏れの回帰防止）', () => {
    const { violations, coveredColumns, uncoveredZodFields } = checkConsistency(
      prismaVarchar,
      pairs,
      EXCEPTIONS
    );

    // eslint-disable-next-line no-console
    console.log(
      `[zod⇔VarChar] covered VarChar columns: ${coveredColumns.size}, ` +
        `uncovered zod fields: ${uncoveredZodFields.length}, ` +
        `known violations: ${Object.keys(KNOWN_VIOLATIONS).length}`
    );

    const newViolations = violations.filter((v) => !(v.key in KNOWN_VIOLATIONS));
    if (newViolations.length > 0) {
      const detail = newViolations
        .map(
          (v) =>
            `  ${v.schemaName}.${v.zodField} max(${v.zodMax}) > ${v.model}.${v.column} VarChar(${v.varcharLen})`
        )
        .join('\n');
      throw new Error(
        `KNOWN_VIOLATIONS に無い新規の zod max > VarChar 不整合が ${newViolations.length} 件あります（P2000 の原因）。\n` +
          `zod max を VarChar 以下に直すか、正当なら KNOWN_VIOLATIONS に理由付きで追加してください:\n${detail}`
      );
    }
    expect(newViolations).toEqual([]);
  });

  it('KNOWN_VIOLATIONS に解消済み(stale)エントリが残っていない', () => {
    const { violations } = checkConsistency(prismaVarchar, pairs, EXCEPTIONS);
    const currentKeys = new Set(violations.map((v) => v.key));
    const stale = Object.keys(KNOWN_VIOLATIONS).filter((k) => !currentKeys.has(k));
    if (stale.length > 0) {
      throw new Error(
        `KNOWN_VIOLATIONS が解消済みなのにテーブルに残っています。削除してください:\n  ${stale.join('\n  ')}`
      );
    }
    expect(stale).toEqual([]);
  });

  it('故意に max を VarChar 超にすると検出される（テスト自体の妥当性確認）', () => {
    // buriedPersonSchema.name は max(100)。これを VarChar(1) の列に対応付ければ必ず違反になる。
    const { violations } = checkConsistency(
      { Fake: { name: 1 } },
      [
        {
          schemaName: 'buriedPersonSchema',
          model: 'Fake',
          schema: (types as Record<string, unknown>).buriedPersonSchema,
        },
      ],
      {}
    );
    expect(
      violations.some((v) => v.zodField === 'name' && v.zodMax === 100 && v.varcharLen === 1)
    ).toBe(true);
  });
});
