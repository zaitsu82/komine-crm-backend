import type { PrismaClient } from '@prisma/client';

import { IdMap } from '../../../../scripts/legacy-migration/idMap';
import type { IdMaps } from '../../../../scripts/legacy-migration/idMap';
import {
  loadIdMapFromDb,
  rebuildIdMap,
} from '../../../../scripts/legacy-migration/lib/id-map-loader';

function buildIdMaps(): IdMaps {
  return {
    staff: new IdMap('staff'),
    customer: new IdMap('customer'),
    physicalPlot: new IdMap('physicalPlot'),
    contractPlot: new IdMap('contractPlot'),
    billing: new IdMap('billing'),
  };
}

describe('loadIdMapFromDb', () => {
  it('returns a Map<number, string> built from the legacy column → id pairs', async () => {
    const rows = [
      { id: 'uuid-1', legacy_danka_cd: 1 },
      { id: 'uuid-2', legacy_danka_cd: 2 },
      { id: 'uuid-3', legacy_danka_cd: 3 },
    ];
    const findMany = jest.fn().mockResolvedValue(rows);
    const prisma = { customer: { findMany } } as unknown as PrismaClient;

    const map = await loadIdMapFromDb(prisma, 'customer', 'legacy_danka_cd');

    expect(map.size).toBe(3);
    expect(map.get(1)).toBe('uuid-1');
    expect(map.get(2)).toBe('uuid-2');
    expect(map.get(3)).toBe('uuid-3');
    expect(findMany).toHaveBeenCalledWith({
      where: { legacy_danka_cd: { not: null }, deleted_at: null },
      select: { id: true, legacy_danka_cd: true },
    });
  });

  it('skips rows whose legacy column or id is not a primitive', async () => {
    const rows = [
      { id: 'uuid-1', legacy_grave_cd: 1 },
      { id: null, legacy_grave_cd: 2 }, // bad id
      { id: 'uuid-3', legacy_grave_cd: null }, // bad legacy
      { id: 'uuid-4', legacy_grave_cd: 4 },
    ];
    const findMany = jest.fn().mockResolvedValue(rows);
    const prisma = { contractPlot: { findMany } } as unknown as PrismaClient;

    const map = await loadIdMapFromDb(prisma, 'contractPlot', 'legacy_grave_cd');
    expect(map.size).toBe(2);
    expect([...map.keys()]).toEqual([1, 4]);
  });

  it('throws when the model delegate does not exist', async () => {
    const prisma = {} as unknown as PrismaClient;
    await expect(
      loadIdMapFromDb(prisma, 'customer' as never, 'legacy_danka_cd' as never)
    ).rejects.toThrow(/Unknown Prisma model: customer/);
  });
});

describe('rebuildIdMap', () => {
  it('is a no-op when the target idMap already has entries', async () => {
    const idMaps = buildIdMaps();
    idMaps.customer.set(99, 'pre-existing');
    const findMany = jest.fn();
    const prisma = { customer: { findMany } } as unknown as PrismaClient;

    const result = await rebuildIdMap(prisma, idMaps, 'customer');
    expect(result).toBe(1);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('loads customer idMap from DB when empty', async () => {
    const idMaps = buildIdMaps();
    const findMany = jest.fn().mockResolvedValue([
      { id: 'c-1', legacy_danka_cd: 10 },
      { id: 'c-2', legacy_danka_cd: 20 },
    ]);
    const prisma = { customer: { findMany } } as unknown as PrismaClient;
    const info = jest.fn();

    const result = await rebuildIdMap(prisma, idMaps, 'customer', { info });
    expect(result).toBe(2);
    expect(idMaps.customer.size).toBe(2);
    expect(idMaps.customer.get(10)).toBe('c-1');
    expect(info).toHaveBeenCalledWith(
      { key: 'customer', loaded: 2 },
      'idMaps.customer loaded 2 from DB'
    );
  });

  it('parses the legacy- prefix for physicalPlot', async () => {
    const idMaps = buildIdMaps();
    const findMany = jest.fn().mockResolvedValue([
      { id: 'p-1', plot_number: 'legacy-100' },
      { id: 'p-2', plot_number: 'legacy-200' },
      { id: 'p-3', plot_number: 'legacy-not-a-number' }, // dropped
    ]);
    const prisma = { physicalPlot: { findMany } } as unknown as PrismaClient;

    const result = await rebuildIdMap(prisma, idMaps, 'physicalPlot');
    expect(result).toBe(2);
    expect(idMaps.physicalPlot.get(100)).toBe('p-1');
    expect(idMaps.physicalPlot.get(200)).toBe('p-2');
    expect(findMany).toHaveBeenCalledWith({
      where: { plot_number: { startsWith: 'legacy-' }, deleted_at: null },
      select: { id: true, plot_number: true },
    });
  });

  it('parses the legacy-tancd- prefix for staff', async () => {
    const idMaps = buildIdMaps();
    const findMany = jest.fn().mockResolvedValue([
      { id: 5, supabase_uid: 'legacy-tancd-1' },
      { id: 6, supabase_uid: 'legacy-tancd-2' },
    ]);
    const prisma = { staff: { findMany } } as unknown as PrismaClient;

    const result = await rebuildIdMap(prisma, idMaps, 'staff');
    expect(result).toBe(2);
    expect(idMaps.staff.get(1)).toBe(5);
    expect(idMaps.staff.get(2)).toBe(6);
  });

  it('does not log when nothing was loaded', async () => {
    const idMaps = buildIdMaps();
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = { billing: { findMany } } as unknown as PrismaClient;
    const info = jest.fn();

    const result = await rebuildIdMap(prisma, idMaps, 'billing', { info });
    expect(result).toBe(0);
    expect(info).not.toHaveBeenCalled();
  });
});
