/**
 * 続柄（zokugara）の生レガシー値 → 続柄マスタ名 解決（#333）
 *
 * レガシー t_family.zokugara は続柄マスタ（KBNNO=2009）の NMCODE を数字文字列で
 * 保持している（例: '13'）。フロントは続柄を「名称」で保存・照合する
 * （ContactsTab は `value={r.name}` / MasterFallbackSelectItem matchBy='name'）ため、
 * 移行データも名称で保存しないと詳細画面に生int（'13'）、編集画面に未解決値が露出する。
 *
 * 埋葬者(buried_persons.relationship)は元から名称で保存しており、これに揃える。
 */
import type { PrismaClient } from '@prisma/client';

const RELATIONSHIP_KBNNO = '2009';

/**
 * 未解決の続柄を表すセンチネル（#375）。
 *
 * FamilyContact.relationship は NOT NULL VarChar のため未設定を空文字で表す。
 * フロントの空値規約（#181 `isEmptyDisplayValue('')`）でそのまま「未登録」表示になり、
 * 日本語UIに英単語が露出しない。以前は英語 `'unknown'` を使っていたが、それが
 * #355 backfill で本番に live していたため本値へ統一する。
 */
export const UNRESOLVED_RELATIONSHIP = '';

/**
 * #355 backfill が本番に生成してしまった旧センチネル（英語 `'unknown'`、#375）。
 * 本番の既存 `relationship = 'unknown'` を {@link UNRESOLVED_RELATIONSHIP} に補正する
 * ために参照する。
 */
export const LEGACY_UNKNOWN_RELATIONSHIP = 'unknown';

/** 続柄マスタを読み込み NMCODE(文字列) → 名称 の対応表を返す。 */
export async function loadRelationshipNameMap(
  prisma: Pick<PrismaClient, 'relationshipMaster'>
): Promise<Map<string, string>> {
  const rows = await prisma.relationshipMaster.findMany({
    select: { code: true, name: true },
  });
  const map = new Map<string, string>();
  for (const r of rows) {
    // code は `2009-${NMCODE}`。NMCODE で引けるようにする。
    const m = r.code.match(new RegExp(`^${RELATIONSHIP_KBNNO}-(.+)$`));
    if (m) map.set(m[1], r.name);
  }
  return map;
}

/**
 * 生 zokugara 値を保存用の続柄文字列に解決する。
 *  - 数字（マスタにあり） → マスタ名称
 *  - 数字（'0' やマスタに無い） → 空文字（未設定。UIで「未登録」表示・#375）
 *  - 自由記述（数字でない） → そのまま（既に名称）
 *  - null/空 → 空文字
 */
export function resolveRelationship(
  raw: string | null | undefined,
  nameMap: Map<string, string>
): string {
  const cleaned = raw?.trim();
  if (!cleaned) return UNRESOLVED_RELATIONSHIP;
  if (/^\d+$/.test(cleaned)) {
    return nameMap.get(cleaned) ?? UNRESOLVED_RELATIONSHIP;
  }
  return cleaned;
}
