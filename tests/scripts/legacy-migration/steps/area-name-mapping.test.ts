/**
 * 回帰テスト: PhysicalPlot.area_name を m_area.area_name（実区画名）から取る（#151）
 */
import type { PrismaClient } from '@prisma/client';

import { createIdMaps } from '../../../../scripts/legacy-migration/idMap';

jest.mock('../../../../scripts/legacy-migration/legacyDb', () => ({
  legacyQuery: jest.fn(),
}));

import { legacyQuery } from '../../../../scripts/legacy-migration/legacyDb';
import { stepPhysicalPlot } from '../../../../scripts/legacy-migration/steps/03-physical-plot';
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

describe('stepPhysicalPlot: area_name を m_area.area_name から取る (#151)', () => {
  beforeEach(() => mockedLegacyQuery.mockReset());

  it('m_area.area_name を区画名に使い、全角英数は半角化。対応無しは旧形式にフォールバック', async () => {
    const created: Array<Record<string, unknown>> = [];
    const prisma = {
      physicalPlot: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
          created.push(data);
          return Promise.resolve({ id: `pp-${created.length}` });
        }),
      },
    } as unknown as PrismaClient;

    mockedLegacyQuery.mockResolvedValueOnce([
      // m_area.area_name あり（凛A）
      { grave_cd: 1, chiku_cd: 1, area_cd: 10, m_area_name: '凛A' },
      // 全角英数 → 半角化（Ａ → A）
      { grave_cd: 2, chiku_cd: 1, area_cd: 11, m_area_name: 'Ａ' },
      // m_area 対応無し → 旧形式 chiku-area にフォールバック
      { grave_cd: 3, chiku_cd: 1, area_cd: 364, m_area_name: null },
    ]);

    await stepPhysicalPlot.run({
      prisma,
      logger: buildLogger(),
      idMaps: createIdMaps(),
      dryRun: false,
    });

    expect(created).toHaveLength(3);
    expect(created[0].area_name).toBe('凛A');
    expect(created[1].area_name).toBe('A'); // 全角Ａ→半角A
    expect(created[2].area_name).toBe('1-364'); // フォールバック
  });
});
