/// <reference types="node" />
/**
 * レガシー値の UI 露出を解消する backfill（#333）
 *
 * 移行済みデータに残る「未設定センチネル/生レガシーint」を正規化する:
 *  1. gravestone_infos.direction_id / position_id = 0 → null（方位/位置の「旧コード:0」）
 *  2. family_contacts.relationship の生int → 続柄マスタ名（'0'/未解決は 'unknown'）
 *  3. buried_persons.religion = 'legacy-shuuha-*' → null（宗派マスタ不要確定）
 *  4. construction_infos.contractor = 'legacy-gyousha-0'（=未設定）→ null + 業者マスタ無効化（#334）
 *
 * いずれもアプリ作成データには影響しない（0/センチネル/生int は移行由来のみ）。
 *
 * 使い方:
 *   npx ts-node scripts/backfill-legacy-value-cleanup.ts          # dry-run（件数のみ）
 *   npx ts-node scripts/backfill-legacy-value-cleanup.ts --apply  # 実際に更新
 *
 * 冪等: 実行後は対象（0 / 生int / legacy-shuuha-*）が消えるため再実行で 0 件。
 */
import 'dotenv/config';

import { prisma } from '../src/db/prisma';
import {
  loadRelationshipNameMap,
  resolveRelationship,
} from './legacy-migration/lib/relationship-resolver';

const APPLY = process.argv.includes('--apply');

async function backfillDirectionPosition(): Promise<Record<string, number>> {
  if (!APPLY) {
    const direction = await prisma.gravestoneInfo.count({ where: { direction_id: 0 } });
    const position = await prisma.gravestoneInfo.count({ where: { position_id: 0 } });
    return { direction_id_zero: direction, position_id_zero: position };
  }
  const direction = await prisma.gravestoneInfo.updateMany({
    where: { direction_id: 0 },
    data: { direction_id: null },
  });
  const position = await prisma.gravestoneInfo.updateMany({
    where: { position_id: 0 },
    data: { position_id: null },
  });
  return { direction_id_nulled: direction.count, position_id_nulled: position.count };
}

async function backfillRelationship(): Promise<Record<string, unknown>> {
  const nameMap = await loadRelationshipNameMap(prisma);

  // 生int（数字のみ）の relationship を持つ family_contacts を値ごとに集計
  const groups = await prisma.familyContact.groupBy({
    by: ['relationship'],
    _count: { _all: true },
  });
  const numericGroups = groups.filter((g) => /^\d+$/.test(g.relationship));

  const plan = numericGroups.map((g) => ({
    from: g.relationship,
    to: resolveRelationship(g.relationship, nameMap),
    count: g._count._all,
  }));

  if (!APPLY) {
    return { numeric_relationship_groups: plan };
  }

  let updated = 0;
  for (const p of plan) {
    const r = await prisma.familyContact.updateMany({
      where: { relationship: p.from },
      data: { relationship: p.to },
    });
    updated += r.count;
  }
  return { updated, plan };
}

async function backfillReligion(): Promise<Record<string, number>> {
  const where = { religion: { startsWith: 'legacy-shuuha-' } };
  if (!APPLY) {
    return { legacy_shuuha_religion: await prisma.buriedPerson.count({ where }) };
  }
  const r = await prisma.buriedPerson.updateMany({ where, data: { religion: null } });
  return { religion_nulled: r.count };
}

async function backfillGyousha(): Promise<Record<string, number>> {
  // gyousha_cd=0（=未設定）由来の contractor='legacy-gyousha-0' を null にし、
  // 「業者ID:0」業者マスタを無効化する（#334）。実在業者（legacy-gyousha-1 等）は対象外。
  const GYOUSHA_ZERO = 'legacy-gyousha-0';
  if (!APPLY) {
    const constructions = await prisma.constructionInfo.count({
      where: { contractor: GYOUSHA_ZERO },
    });
    const master = await prisma.contractorMaster.count({
      where: { code: GYOUSHA_ZERO, is_active: true },
    });
    return { construction_gyousha_zero: constructions, active_gyousha_zero_master: master };
  }
  const constructions = await prisma.constructionInfo.updateMany({
    where: { contractor: GYOUSHA_ZERO },
    data: { contractor: null },
  });
  const master = await prisma.contractorMaster.updateMany({
    where: { code: GYOUSHA_ZERO },
    data: { is_active: false },
  });
  return {
    construction_contractor_nulled: constructions.count,
    gyousha_zero_master_deactivated: master.count,
  };
}

async function main(): Promise<void> {
  console.log(`[backfill legacy-value-cleanup] start (apply=${APPLY})`);

  const directionPosition = await backfillDirectionPosition();
  const relationship = await backfillRelationship();
  const religion = await backfillReligion();
  const gyousha = await backfillGyousha();

  console.log(
    JSON.stringify({ apply: APPLY, directionPosition, relationship, religion, gyousha }, null, 2)
  );
}

main()
  .catch((e) => {
    console.error('ERROR', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
