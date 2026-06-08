/**
 * 回帰テスト: t_dankalog / t_famlog → History 移行（#324）
 */
import type { PrismaClient } from '@prisma/client';

import { createIdMaps } from '../../../../scripts/legacy-migration/idMap';

jest.mock('../../../../scripts/legacy-migration/legacyDb', () => ({
  legacyQuery: jest.fn(),
}));

import { legacyQuery } from '../../../../scripts/legacy-migration/legacyDb';
import { stepHistory } from '../../../../scripts/legacy-migration/steps/14-history';
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

describe('stepHistory: t_dankalog / t_famlog → History (#324)', () => {
  beforeEach(() => mockedLegacyQuery.mockReset());

  const buildIdMaps = () => {
    const idMaps = createIdMaps();
    idMaps.customer.set(100, 'cust-100'); // rebuildIdMap を no-op に
    idMaps.contractPlot.set(500, 'cp-500');
    idMaps.physicalPlot.set(500, 'pp-500');
    return idMaps;
  };

  const buildPrisma = (created: Array<Record<string, unknown>>, existing: unknown[] = []) =>
    ({
      customer: { findMany: jest.fn() },
      contractPlot: { findMany: jest.fn() },
      physicalPlot: { findMany: jest.fn() },
      familyContact: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'fc-1', legacy_family_cd: 9, contract_plot_id: 'cp-500' }]),
      },
      history: {
        findMany: jest.fn().mockResolvedValue(existing),
        createMany: jest
          .fn()
          .mockImplementation(({ data }: { data: Record<string, unknown>[] }) => {
            created.push(...data);
            return Promise.resolve({ count: data.length });
          }),
      },
    }) as unknown as PrismaClient;

  it('連続スナップショットを CREATE + 差分 UPDATE として取り込む', async () => {
    const created: Array<Record<string, unknown>> = [];
    const prisma = buildPrisma(created);

    mockedLegacyQuery
      // t_dankalog: danka_cd=100 の2世代（tel1 が変化）
      .mockResolvedValueOnce([
        {
          danka_log_cd: 1,
          rireki_cd: 1,
          danka_cd: 100,
          grave_cd: 500,
          tancd: 7,
          reg_date: 20200101,
          owner_sei: '山田',
          tel1: '03-1111',
        },
        {
          danka_log_cd: 2,
          rireki_cd: 2,
          danka_cd: 100,
          grave_cd: 500,
          tancd: 8,
          reg_date: 20210101,
          owner_sei: '山田',
          tel1: '03-2222',
        },
      ])
      // t_famlog: なし
      .mockResolvedValueOnce([]);

    await stepHistory.run({ prisma, logger: buildLogger(), idMaps: buildIdMaps(), dryRun: false });

    expect(created).toHaveLength(2);

    const createEntry = created.find((e) => e['action_type'] === 'CREATE')!;
    expect(createEntry['entity_type']).toBe('Customer');
    expect(createEntry['entity_id']).toBe('cust-100');
    expect(createEntry['contract_plot_id']).toBe('cp-500');
    expect(createEntry['physical_plot_id']).toBe('pp-500');
    expect(createEntry['changed_by']).toBe('legacy-tancd-7');
    expect(createEntry['legacy_log_cd']).toBe(1);
    expect(createEntry['legacy_log_table']).toBe('t_dankalog');
    expect((createEntry['after_record'] as Record<string, unknown>)['tel1']).toBe('03-1111');

    const updateEntry = created.find((e) => e['action_type'] === 'UPDATE')!;
    expect(updateEntry['changed_fields']).toEqual(['tel1']);
    expect((updateEntry['before_record'] as Record<string, unknown>)['tel1']).toBe('03-1111');
    expect((updateEntry['after_record'] as Record<string, unknown>)['tel1']).toBe('03-2222');
    expect(updateEntry['changed_by']).toBe('legacy-tancd-8');
    expect(updateEntry['legacy_log_cd']).toBe(2);
  });

  it('変化なしの世代は記録せず、Customer 未マップの danka はスキップする', async () => {
    const created: Array<Record<string, unknown>> = [];
    const prisma = buildPrisma(created);

    mockedLegacyQuery
      .mockResolvedValueOnce([
        // danka_cd=100: 2世代だが内容同一 → CREATE のみ（2件目は no-change skip）
        {
          danka_log_cd: 1,
          rireki_cd: 1,
          danka_cd: 100,
          grave_cd: 500,
          tancd: 7,
          reg_date: 20200101,
          owner_sei: '山田',
        },
        {
          danka_log_cd: 2,
          rireki_cd: 2,
          danka_cd: 100,
          grave_cd: 500,
          tancd: 7,
          reg_date: 20200201,
          owner_sei: '山田',
        },
        // danka_cd=999: idMap 未登録 → group ごとスキップ
        {
          danka_log_cd: 3,
          rireki_cd: 1,
          danka_cd: 999,
          grave_cd: 500,
          tancd: 7,
          reg_date: 20200101,
          owner_sei: '佐藤',
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await stepHistory.run({
      prisma,
      logger: buildLogger(),
      idMaps: buildIdMaps(),
      dryRun: false,
    });

    expect(created).toHaveLength(1); // CREATE のみ
    expect(created[0]['action_type']).toBe('CREATE');
    expect(result.notes?.['skip_no_change']).toBe(1);
    expect(result.notes?.['skip_no_entity']).toBe(1);
  });

  it('既存の legacy_log_cd は再取込しない（冪等）', async () => {
    const created: Array<Record<string, unknown>> = [];
    const prisma = buildPrisma(created, [{ legacy_log_table: 't_dankalog', legacy_log_cd: 1 }]);

    mockedLegacyQuery
      .mockResolvedValueOnce([
        {
          danka_log_cd: 1,
          rireki_cd: 1,
          danka_cd: 100,
          grave_cd: 500,
          tancd: 7,
          reg_date: 20200101,
          owner_sei: '山田',
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await stepHistory.run({
      prisma,
      logger: buildLogger(),
      idMaps: buildIdMaps(),
      dryRun: false,
    });

    expect(created).toHaveLength(0);
    expect(result.notes?.['skip_existing']).toBe(1);
  });

  it('t_famlog は FamilyContact エンティティとして取り込む', async () => {
    const created: Array<Record<string, unknown>> = [];
    const prisma = buildPrisma(created);

    mockedLegacyQuery
      .mockResolvedValueOnce([]) // dankalog なし
      .mockResolvedValueOnce([
        {
          family_log_id: 11,
          rireki_cd: 1,
          family_cd: 9,
          danka_cd: 100,
          reg_date: 20200101,
          family_sei: '田中',
          tel1: '090-0000',
        },
      ]);

    await stepHistory.run({ prisma, logger: buildLogger(), idMaps: buildIdMaps(), dryRun: false });

    expect(created).toHaveLength(1);
    expect(created[0]['entity_type']).toBe('FamilyContact');
    expect(created[0]['entity_id']).toBe('fc-1');
    expect(created[0]['contract_plot_id']).toBe('cp-500');
    expect(created[0]['changed_by']).toBeNull(); // famlog に tancd 無し
    expect(created[0]['legacy_log_table']).toBe('t_famlog');
  });

  it('dryRun では createMany を呼ばず件数のみ返す', async () => {
    const created: Array<Record<string, unknown>> = [];
    const prisma = buildPrisma(created);

    mockedLegacyQuery
      .mockResolvedValueOnce([
        {
          danka_log_cd: 1,
          rireki_cd: 1,
          danka_cd: 100,
          grave_cd: 500,
          tancd: 7,
          reg_date: 20200101,
          owner_sei: '山田',
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await stepHistory.run({
      prisma,
      logger: buildLogger(),
      idMaps: buildIdMaps(),
      dryRun: true,
    });

    expect(prisma.history.createMany as jest.Mock).not.toHaveBeenCalled();
    expect(result.inserted).toBe(1);
  });
});
