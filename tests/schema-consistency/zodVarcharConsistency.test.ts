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

/** optional / nullable / default / pipe(preprocess) を剥がして内側の型に到達する。 */
function unwrapZod(schema: unknown): UnwrapResult {
  let cur = schema as {
    _def?: { type?: string; innerType?: unknown; out?: unknown };
    def?: { type?: string; innerType?: unknown; out?: unknown };
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

/** object schema から { field: maxLength|null } を集める（string 型のみ）。 */
function collectZodStringMaxes(objectSchema: unknown): Record<string, number | null> {
  const shape = (objectSchema as { shape?: Record<string, unknown> }).shape;
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

// ---- 共有スキーマ -> Prisma モデルの対応 ----

const SCHEMA_MODEL_PAIRS: Array<{ schemaName: string; model: string }> = [
  { schemaName: 'physicalPlotSchema', model: 'PhysicalPlot' },
  { schemaName: 'contractPlotSchema', model: 'ContractPlot' },
  { schemaName: 'saleContractSchema', model: 'ContractPlot' },
  { schemaName: 'customerSchema', model: 'Customer' },
  { schemaName: 'applicantSchema', model: 'Customer' },
  { schemaName: 'workInfoSchema', model: 'WorkInfo' },
  { schemaName: 'usageFeeSchema', model: 'UsageFee' },
  { schemaName: 'managementFeeSchema', model: 'ManagementFee' },
  { schemaName: 'gravestoneInfoSchema', model: 'GravestoneInfo' },
  { schemaName: 'familyContactSchema', model: 'FamilyContact' },
  { schemaName: 'buriedPersonSchema', model: 'BuriedPerson' },
  { schemaName: 'constructionInfoSchema', model: 'ConstructionInfo' },
  { schemaName: 'collectiveBurialSchema', model: 'CollectiveBurial' },
  { schemaName: 'createPaymentSchema', model: 'Payment' },
  { schemaName: 'createBillingSchema', model: 'Billing' },
  { schemaName: 'updateBillingSchema', model: 'Billing' },
];

/** schemaName -> { zodField: prismaColumn } の明示マッピング（規約変換で解決できないもの）。 */
const EXCEPTIONS: Record<string, Record<string, string>> = {
  // 現状は camelToSnake（数字前 `_` 含む）で全件解決するため空。
};

/**
 * 既知の不整合ベースライン（key=`${schemaName}.${zodField}`、value=対応 VarChar 長）。
 * これらは本テスト導入時点で既に存在していた zod max > VarChar。正式対応（拡幅 vs zod 縮小）は
 * backend #338 で追跡する。解消したら必ずこのテーブルから削除すること（stale 検出で落ちる）。
 *
 * 内訳:
 *  - 電話/郵便番号(6件): DB は全モデル一律 VarChar(7=郵便, 11/15=電話) の digits-only 想定。
 *    zod はハイフン込みの緩い max。保存規約（数字のみ vs 書式込み）の確定が必要。
 *  - paymentMethod(2件)/gravestoneType(1件): zod が兄弟フィールドと不揃い（コピペ）。
 *    zod を VarChar に合わせる（types 変更）べきもの。
 */
const KNOWN_VIOLATIONS: Record<string, number> = {
  'workInfoSchema.workPostalCode': 7,
  'familyContactSchema.postalCode': 7,
  'familyContactSchema.phoneNumber': 11,
  'familyContactSchema.phoneNumber2': 15,
  'familyContactSchema.faxNumber': 11,
  'familyContactSchema.workPhoneNumber': 15,
  'usageFeeSchema.paymentMethod': 20,
  'managementFeeSchema.paymentMethod': 20,
  'gravestoneInfoSchema.gravestoneType': 50,
};

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
  pairs: Array<{ schemaName: string; model: string; schema: unknown }>,
  exceptions: Record<string, Record<string, string>>
): CheckResult {
  const violations: Violation[] = [];
  const coveredColumns = new Set<string>();
  const uncoveredZodFields: string[] = [];

  for (const { schemaName, model, schema } of pairs) {
    const zodMaxes = collectZodStringMaxes(schema);
    const modelCols = prismaVarchar[model] || {};
    for (const [zodField, zodMax] of Object.entries(zodMaxes)) {
      const column = exceptions[schemaName]?.[zodField] ?? camelToSnake(zodField);
      const varcharLen = modelCols[column];
      if (varcharLen === undefined) {
        uncoveredZodFields.push(`${schemaName}.${zodField}`);
        continue;
      }
      if (zodMax === null) {
        // VarChar 列だが zod に max が無い（#37 系）。本テストは max>VarChar 回帰防止が責務なので
        // 失敗にはせず coverage 外として記録のみ。
        uncoveredZodFields.push(`${schemaName}.${zodField} (no zod max, VarChar(${varcharLen}))`);
        continue;
      }
      coveredColumns.add(`${model}.${column}`);
      if (zodMax > varcharLen) {
        violations.push({
          key: `${schemaName}.${zodField}`,
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

  const pairs = SCHEMA_MODEL_PAIRS.map(({ schemaName, model }) => ({
    schemaName,
    model,
    schema: (types as Record<string, unknown>)[schemaName],
  }));

  it('全共有スキーマが @komine/types から解決できる', () => {
    const missing = pairs.filter((p) => !p.schema).map((p) => p.schemaName);
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
