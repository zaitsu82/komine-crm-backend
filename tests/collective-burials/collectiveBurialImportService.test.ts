jest.mock('../../src/collective-burials/utils', () => ({
  resolveBillingScheduledDate: jest.fn(() => null),
}));

import {
  importCollectiveBurials,
  CollectiveBurialImportRow,
} from '../../src/collective-burials/collectiveBurialImportService';

const baseRow = (over: Partial<CollectiveBurialImportRow> = {}): CollectiveBurialImportRow => ({
  plotNumber: '樹林-1',
  burialCapacity: 1,
  validityPeriodYears: 13,
  ...over,
});

function buildPrisma(opts: {
  contractPlots?: Array<{ id: string; contract_date: Date | null }>;
  existing?: { id: string; deleted_at: Date | null } | null;
}) {
  const create = jest.fn().mockResolvedValue({ id: 'cb-new' });
  const update = jest.fn().mockResolvedValue({ id: 'cb-upd' });
  const prisma = {
    contractPlot: { findMany: jest.fn().mockResolvedValue(opts.contractPlots ?? []) },
    collectiveBurial: {
      findUnique: jest.fn().mockResolvedValue(opts.existing ?? null),
      create,
      update,
    },
  };
  return { prisma: prisma as never, create, update };
}

describe('importCollectiveBurials (#359)', () => {
  it('区画番号で有効契約区画を解決し合祀を作成する', async () => {
    const { prisma, create } = buildPrisma({
      contractPlots: [{ id: 'cp1', contract_date: null }],
      existing: null,
    });
    const r = await importCollectiveBurials(prisma, [baseRow()], { apply: true });

    expect(r.created).toBe(1);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contract_plot_id: 'cp1',
          burial_capacity: 1,
          validity_period_years: 13,
          billing_status: 'pending',
        }),
      })
    );
  });

  it('区画が見つからなければ notFound', async () => {
    const { prisma, create } = buildPrisma({ contractPlots: [], existing: null });
    const r = await importCollectiveBurials(prisma, [baseRow()], { apply: true });

    expect(r.notFound).toBe(1);
    expect(create).not.toHaveBeenCalled();
  });

  it('有効契約区画が複数該当なら ambiguous（分割販売等）', async () => {
    const { prisma } = buildPrisma({
      contractPlots: [
        { id: 'cp1', contract_date: null },
        { id: 'cp2', contract_date: null },
      ],
      existing: null,
    });
    const r = await importCollectiveBurials(prisma, [baseRow()], { apply: true });

    expect(r.ambiguous).toBe(1);
  });

  it('生存する既存合祀は既定でスキップ', async () => {
    const { prisma, update } = buildPrisma({
      contractPlots: [{ id: 'cp1', contract_date: null }],
      existing: { id: 'cb1', deleted_at: null },
    });
    const r = await importCollectiveBurials(prisma, [baseRow()], { apply: true });

    expect(r.skippedExisting).toBe(1);
    expect(update).not.toHaveBeenCalled();
  });

  it('--overwrite で既存合祀を更新', async () => {
    const { prisma, update } = buildPrisma({
      contractPlots: [{ id: 'cp1', contract_date: null }],
      existing: { id: 'cb1', deleted_at: null },
    });
    const r = await importCollectiveBurials(prisma, [baseRow()], { apply: true, overwrite: true });

    expect(r.updated).toBe(1);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'cb1' },
        data: expect.objectContaining({ deleted_at: null }),
      })
    );
  });

  it('ソフトデリート済み合祀は復活更新される', async () => {
    const { prisma, update } = buildPrisma({
      contractPlots: [{ id: 'cp1', contract_date: null }],
      existing: { id: 'cb1', deleted_at: new Date('2026-01-01') },
    });
    const r = await importCollectiveBurials(prisma, [baseRow()], { apply: true });

    expect(r.updated).toBe(1);
    expect(update).toHaveBeenCalled();
  });

  it('埋葬上限/合祀年数が不正なら invalid', async () => {
    const { prisma } = buildPrisma({ contractPlots: [{ id: 'cp1', contract_date: null }] });
    const r = await importCollectiveBurials(
      prisma,
      [baseRow({ burialCapacity: 0 }), baseRow({ validityPeriodYears: 0 })],
      { apply: true }
    );

    expect(r.invalid).toBe(2);
  });

  it('dry-run(apply=false)では作成せず件数のみ算出', async () => {
    const { prisma, create } = buildPrisma({
      contractPlots: [{ id: 'cp1', contract_date: null }],
      existing: null,
    });
    const r = await importCollectiveBurials(prisma, [baseRow()], { apply: false });

    expect(r.created).toBe(1);
    expect(create).not.toHaveBeenCalled();
  });
});
