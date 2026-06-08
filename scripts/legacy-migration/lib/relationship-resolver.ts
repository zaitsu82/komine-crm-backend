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
 *  - 数字（'0' やマスタに無い） → 'unknown'（未設定。relationship は NOT NULL のため）
 *  - 自由記述（数字でない） → そのまま（既に名称）
 *  - null/空 → 'unknown'
 */
export function resolveRelationship(
  raw: string | null | undefined,
  nameMap: Map<string, string>
): string {
  const cleaned = raw?.trim();
  if (!cleaned) return 'unknown';
  if (/^\d+$/.test(cleaned)) {
    return nameMap.get(cleaned) ?? 'unknown';
  }
  return cleaned;
}
