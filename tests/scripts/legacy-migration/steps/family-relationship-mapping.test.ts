/**
 * 回帰テスト: step07 の続柄(zokugara)生int → 続柄マスタ名 解決（#333）
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

describe('stepFamilyContact: 続柄の名称解決 (#333)', () => {
  beforeEach(() => {
    mockedLegacyQuery.mockReset();
  });

  it('生int zokugara を続柄マスタ名に解決し、0/未解決は unknown にする', async () => {
    const created: Array<Record<string, unknown>> = [];
    const prisma = {
      customer: { findMany: jest.fn().mockResolvedValue([{ id: 'cust-1', legacy_danka_cd: 100 }]) },
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
      relationshipMaster: {
        findMany: jest.fn().mockResolvedValue([
          { code: '2009-13', name: '配偶者' },
          { code: '2009-1', name: '本人' },
        ]),
      },
    } as unknown as PrismaClient;

    mockedLegacyQuery
      .mockResolvedValueOnce([{ danka_cd: 100, grave_cd: 500 }]) // del_flg=0 danka
      .mockResolvedValueOnce([]) // 解約者 danka なし
      .mockResolvedValueOnce([
        familyRow({ family_cd: 1, zokugara: '13' }), // → 配偶者
        familyRow({ family_cd: 2, zokugara: '0', family_mei: '次郎' }), // → unknown（未設定）
        familyRow({ family_cd: 3, zokugara: '友人', family_mei: '三郎' }), // 自由記述はそのまま
      ]);

    await stepFamilyContact.run({
      prisma,
      logger: buildLogger(),
      idMaps: createIdMaps(),
      dryRun: false,
    });

    const byCd = (cd: number) => created.find((d) => d['legacy_family_cd'] === cd);
    expect(byCd(1)?.['relationship']).toBe('配偶者');
    expect(byCd(2)?.['relationship']).toBe('unknown');
    expect(byCd(3)?.['relationship']).toBe('友人');
  });
});
