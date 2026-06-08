/**
 * 回帰テスト: 解約者紐づき家族連絡先の取込（#311）
 *
 * 業務確認（2026-06-07 Q18/Q20/Q21）: 解約者150件は取り込み「解約者で情報まとめる」。
 * 解約者（del_flg=2）に紐づく t_family 91件は契約区画を持たないため、
 * contract_plot_id=null + customer_id 直リンクで取り込む。
 * PR #309 時点では FamilyContact.contract_plot_id が NOT NULL のため見送られていた。
 */
import type { PrismaClient } from '@prisma/client';

import { createIdMaps } from '../../../../scripts/legacy-migration/idMap';

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

const familyRow = (overrides: Record<string, unknown>): Record<string, unknown> => ({
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
  ...overrides,
});

/**
 * legacyQuery のモック順序（07-family-contact.ts の呼び出し順）:
 *   1. t_danka (danka_cd→grave_cd, del_flg=0)
 *   2. 解約者 danka (del_flg=2)
 *   3. t_family 本体
 */
describe('stepFamilyContact: 解約者紐づき family の取込 (#311)', () => {
  beforeEach(() => {
    mockedLegacyQuery.mockReset();
  });

  const buildPrisma = (created: Array<Record<string, unknown>>): PrismaClient => {
    // customer.findMany は rebuildIdMap（is_terminated:false 側）と
    // 解約者マップ構築（is_terminated:true 側）の両方で呼ばれるため where で出し分ける
    const customerFindMany = jest
      .fn()
      .mockImplementation(({ where }: { where: Record<string, unknown> }) => {
        if (where['is_terminated'] === true) {
          return Promise.resolve([{ id: 'cust-terminated', legacy_danka_cd: 200 }]);
        }
        return Promise.resolve([{ id: 'cust-active', legacy_danka_cd: 100 }]);
      });
    return {
      customer: { findMany: customerFindMany },
      contractPlot: {
        findMany: jest.fn().mockResolvedValue([{ id: 'cp-1', legacy_grave_cd: 500 }]),
      },
      familyContact: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
          created.push(data);
          return Promise.resolve({ id: `fc-${created.length}` });
        }),
      },
      relationshipMaster: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaClient;
  };

  it('解約者（del_flg=2）紐づきの family は contract_plot_id=null + customer 直リンクで取り込む', async () => {
    const created: Array<Record<string, unknown>> = [];
    const prisma = buildPrisma(created);

    mockedLegacyQuery
      .mockResolvedValueOnce([{ danka_cd: 100, grave_cd: 500 }]) // del_flg=0 danka
      .mockResolvedValueOnce([{ danka_cd: 200 }]) // del_flg=2（解約者）danka
      .mockResolvedValueOnce([
        familyRow({ family_cd: 1, danka_cd: 100 }), // 現役顧客紐づき（従来どおり区画リンク）
        familyRow({ family_cd: 2, danka_cd: 200, family_mei: '次郎' }), // 解約者紐づき（#311）
      ]);

    const result = await stepFamilyContact.run({
      prisma,
      logger: buildLogger(),
      idMaps: createIdMaps(),
      dryRun: false,
    });

    expect(result.inserted).toBe(2);
    expect(result.notes?.['inserted_terminated_link']).toBe(1);
    expect(result.notes?.['skip_danka_not_mapped']).toBe(0);

    const activeLinked = created.find((d) => d['legacy_family_cd'] === 1);
    const terminatedLinked = created.find((d) => d['legacy_family_cd'] === 2);
    expect(activeLinked?.['contract_plot_id']).toBe('cp-1');
    expect(activeLinked?.['customer_id']).toBe('cust-active');
    expect(terminatedLinked?.['contract_plot_id']).toBeNull();
    expect(terminatedLinked?.['customer_id']).toBe('cust-terminated');
  });

  it('解約者 Customer が新DBに無い場合は orphan を作らずスキップする（step04 未実行ガード）', async () => {
    const created: Array<Record<string, unknown>> = [];
    const prisma = buildPrisma(created);

    mockedLegacyQuery
      .mockResolvedValueOnce([{ danka_cd: 100, grave_cd: 500 }])
      // 解約者 danka 201 はレガシーに存在するが、新DBの解約者マップ（200のみ）に無い
      .mockResolvedValueOnce([{ danka_cd: 201 }])
      .mockResolvedValueOnce([familyRow({ family_cd: 3, danka_cd: 201 })]);

    const result = await stepFamilyContact.run({
      prisma,
      logger: buildLogger(),
      idMaps: createIdMaps(),
      dryRun: false,
    });

    expect(result.inserted).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.notes?.['skip_terminated_customer_not_found']).toBe(1);
    expect(created).toHaveLength(0);
  });

  it('解約者でも区画マップにも無い danka は従来どおり skip_danka_not_mapped（挙動回帰なし）', async () => {
    const created: Array<Record<string, unknown>> = [];
    const prisma = buildPrisma(created);

    mockedLegacyQuery
      .mockResolvedValueOnce([{ danka_cd: 100, grave_cd: 500 }])
      .mockResolvedValueOnce([]) // 解約者なし
      .mockResolvedValueOnce([familyRow({ family_cd: 4, danka_cd: 999 })]);

    const result = await stepFamilyContact.run({
      prisma,
      logger: buildLogger(),
      idMaps: createIdMaps(),
      dryRun: false,
    });

    expect(result.inserted).toBe(0);
    expect(result.notes?.['skip_danka_not_mapped']).toBe(1);
  });

  it('dry-run でも解約者紐づき件数を inserted に計上する', async () => {
    const created: Array<Record<string, unknown>> = [];
    const prisma = buildPrisma(created);

    mockedLegacyQuery
      .mockResolvedValueOnce([{ danka_cd: 100, grave_cd: 500 }])
      .mockResolvedValueOnce([{ danka_cd: 200 }])
      .mockResolvedValueOnce([familyRow({ family_cd: 2, danka_cd: 200 })]);

    const result = await stepFamilyContact.run({
      prisma,
      logger: buildLogger(),
      idMaps: createIdMaps(),
      dryRun: true,
    });

    expect(result.inserted).toBe(1);
    expect(result.notes?.['inserted_terminated_link']).toBe(1);
    expect(created).toHaveLength(0);
  });
});
