/**
 * テスト: 合祀請求予定日バックフィル（#164）
 *
 * - billing_scheduled_date が null の行のみ対象（手動例外・設定済みは上書きしない =
 *   where 条件で除外）
 * - 契約日未設定はスキップ
 * - dry-run では update しない
 */
import { PrismaClient } from '@prisma/client';

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(),
}));
jest.mock('@prisma/adapter-pg', () => ({
  PrismaPg: jest.fn(),
}));

import { backfillCollectiveBurialSchedule } from '../../scripts/backfill-collective-burial-schedule';

const makePrisma = (targets: unknown[]) => {
  const findMany = jest.fn().mockResolvedValue(targets);
  const update = jest.fn().mockResolvedValue({});
  return {
    prisma: { collectiveBurial: { findMany, update } } as unknown as PrismaClient,
    findMany,
    update,
  };
};

describe('backfillCollectiveBurialSchedule (#164)', () => {
  it('billing_scheduled_date が null の行を契約日起点で埋める（apply）', async () => {
    const { prisma, findMany, update } = makePrisma([
      {
        id: 'cb-1',
        validity_period_years: 13,
        contractPlot: { contract_date: new Date('2026-04-01T00:00:00Z') },
      },
      {
        id: 'cb-2',
        validity_period_years: 33,
        contractPlot: { contract_date: null }, // 契約日未設定 → スキップ
      },
    ]);

    const result = await backfillCollectiveBurialSchedule(prisma, true);

    // 対象は null 行のみ（手動例外・設定済みの行は where で除外）
    expect(findMany.mock.calls[0][0].where).toMatchObject({
      deleted_at: null,
      billing_scheduled_date: null,
    });

    expect(result).toEqual({ scanned: 2, updated: 1, skippedNoContractDate: 1 });
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0]).toMatchObject({ where: { id: 'cb-1' } });
    expect(update.mock.calls[0][0].data.billing_scheduled_date.toISOString()).toBe(
      '2039-04-01T00:00:00.000Z'
    );
  });

  it('dry-run では update を実行しない', async () => {
    const { prisma, update } = makePrisma([
      {
        id: 'cb-1',
        validity_period_years: 13,
        contractPlot: { contract_date: new Date('2026-04-01T00:00:00Z') },
      },
    ]);

    const result = await backfillCollectiveBurialSchedule(prisma, false);

    expect(result.updated).toBe(1); // 更新予定としてカウント
    expect(update).not.toHaveBeenCalled();
  });
});
