/**
 * 回帰テスト: --only=<step> での resume を dry-run で検証できること (issue #163)
 *
 * 以前は各 step が `if (!dryRun)` で idMap の再構築をスキップしていたため、
 * 03〜06 を飛ばした `--only=familyContact,... --dry-run`（runbook の事前確認手順）だと
 * idMap が空のまま assertIdMapsReady が throw し、移行前の件数確認が動かなかった。
 * rebuildIdMap は新DB（投入済みの 03〜06）からの読み取り専用かつ冪等なので、
 * dry-run でも実行して resume を検証できるようにする。
 */
import type { PrismaClient } from '@prisma/client';

import { createIdMaps } from '../../../../scripts/legacy-migration/idMap';

// 移行元 MySQL に接続せず固定行を返す
jest.mock('../../../../scripts/legacy-migration/legacyDb', () => ({
  legacyQuery: jest.fn(),
}));

import { legacyQuery } from '../../../../scripts/legacy-migration/legacyDb';
import { stepFamilyContact } from '../../../../scripts/legacy-migration/steps/07-family-contact';
import type { MigrationContext } from '../../../../scripts/legacy-migration/types';

const mockedLegacyQuery = legacyQuery as jest.Mock;

function buildLogger(): MigrationContext['logger'] {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    fatal: jest.fn(),
    trace: jest.fn(),
  } as unknown as MigrationContext['logger'];
}

describe('legacy migration resume + dry-run (issue #163)', () => {
  beforeEach(() => {
    mockedLegacyQuery.mockReset();
  });

  it('stepFamilyContact: dry-run で idMap が空でも新DBから再構築し、throw せず件数を返す', async () => {
    // 新DB側（03〜06 投入済み）から idMap を再構築できる状態を模す
    const customerFindMany = jest.fn().mockResolvedValue([{ id: 'cust-1', legacy_danka_cd: 100 }]);
    const contractPlotFindMany = jest
      .fn()
      .mockResolvedValue([{ id: 'cp-1', legacy_grave_cd: 500 }]);
    const familyContactCreate = jest.fn();
    const prisma = {
      customer: { findMany: customerFindMany },
      contractPlot: { findMany: contractPlotFindMany },
      familyContact: { create: familyContactCreate },
    } as unknown as PrismaClient;

    // 1回目: t_danka (danka_cd→grave_cd), 2回目: 解約者 danka（del_flg=2 #311）, 3回目: t_family 本体
    mockedLegacyQuery
      .mockResolvedValueOnce([{ danka_cd: 100, grave_cd: 500 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          family_cd: 1,
          danka_cd: 100,
          family_sei: '山田',
          family_mei: '太郎',
          addr1: null,
          addr2: null,
          addr3: null,
          job_addr1: null,
          job_addr2: null,
          job_addr3: null,
        },
      ]);

    // createIdMaps() は空 = --only で 03〜06 を飛ばした状態を再現
    const idMaps = createIdMaps();
    const ctx: MigrationContext = { prisma, logger: buildLogger(), idMaps, dryRun: true };

    const result = await stepFamilyContact.run(ctx);

    // dry-run でも idMap が新DBから再構築された（= 旧挙動ではここが空で throw していた）
    // customer.findMany は rebuildIdMap + 解約者マップ構築（#311）の2回
    expect(customerFindMany).toHaveBeenCalledTimes(2);
    expect(contractPlotFindMany).toHaveBeenCalledTimes(1);
    expect(idMaps.customer.size).toBe(1);
    expect(idMaps.contractPlot.size).toBe(1);

    // dry-run なので件数だけ数え、書き込みはしない
    expect(result.inserted).toBe(1);
    expect(familyContactCreate).not.toHaveBeenCalled();
  });
});
