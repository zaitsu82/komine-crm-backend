import type { PrismaClient } from '@prisma/client';

import { IdMap } from '../../../../scripts/legacy-migration/idMap';
import type { IdMaps } from '../../../../scripts/legacy-migration/idMap';
import {
  assertIdMapsReady,
  assertNoOrphanRows,
  InvariantViolationError,
} from '../../../../scripts/legacy-migration/lib/invariants';

function buildIdMaps(): IdMaps {
  return {
    staff: new IdMap('staff'),
    customer: new IdMap('customer'),
    physicalPlot: new IdMap('physicalPlot'),
    contractPlot: new IdMap('contractPlot'),
    billing: new IdMap('billing'),
  };
}

describe('assertIdMapsReady', () => {
  it('passes when all required idMaps are populated', () => {
    const idMaps = buildIdMaps();
    idMaps.physicalPlot.set(1, 'uuid-1');
    idMaps.contractPlot.set(1, 'uuid-c-1');
    expect(() => assertIdMapsReady('contractPlot', idMaps, ['physicalPlot'])).not.toThrow();
  });

  it('throws InvariantViolationError when a single required idMap is empty', () => {
    const idMaps = buildIdMaps();
    expect(() => assertIdMapsReady('contractPlot', idMaps, ['physicalPlot'])).toThrow(
      InvariantViolationError
    );
    expect(() => assertIdMapsReady('contractPlot', idMaps, ['physicalPlot'])).toThrow(
      /idMaps\.physicalPlot is empty/
    );
  });

  it('reports all empty idMaps in the error message when multiple are missing', () => {
    const idMaps = buildIdMaps();
    idMaps.customer.set(1, 'uuid-c-1');
    let captured: Error | null = null;
    try {
      assertIdMapsReady('payment', idMaps, ['billing', 'contractPlot', 'customer']);
    } catch (e) {
      captured = e as Error;
    }
    expect(captured).toBeInstanceOf(InvariantViolationError);
    expect(captured!.message).toMatch(/idMaps\.billing/);
    expect(captured!.message).toMatch(/idMaps\.contractPlot/);
    expect(captured!.message).not.toMatch(/idMaps\.customer/);
    expect(captured!.message).toMatch(/abort to prevent NULL FK insertion/);
  });

  it('handles an empty required list as a no-op', () => {
    const idMaps = buildIdMaps();
    expect(() => assertIdMapsReady('contractPlot', idMaps, [])).not.toThrow();
  });
});

describe('assertNoOrphanRows', () => {
  it('passes when count returns 0', async () => {
    const prisma = {
      payment: { count: jest.fn().mockResolvedValue(0) },
    } as unknown as PrismaClient;

    await expect(
      assertNoOrphanRows(prisma, 'payment', { billing_id: null, contract_plot_id: null }, 'payment')
    ).resolves.toBeUndefined();
    expect(
      (prisma as unknown as { payment: { count: jest.Mock } }).payment.count
    ).toHaveBeenCalledWith({ where: { billing_id: null, contract_plot_id: null } });
  });

  it('throws InvariantViolationError when count > 0', async () => {
    const prisma = {
      payment: { count: jest.fn().mockResolvedValue(3) },
    } as unknown as PrismaClient;

    await expect(
      assertNoOrphanRows(
        prisma,
        'payment',
        { billing_id: null, contract_plot_id: null },
        'payment',
        'orphan check'
      )
    ).rejects.toBeInstanceOf(InvariantViolationError);

    await expect(
      assertNoOrphanRows(
        prisma,
        'payment',
        { billing_id: null, contract_plot_id: null },
        'payment',
        'orphan check'
      )
    ).rejects.toThrow(/3 orphan row\(s\) detected in payment/);
  });

  it('throws when the model delegate is unknown', async () => {
    const prisma = {} as unknown as PrismaClient;
    await expect(assertNoOrphanRows(prisma, 'doesNotExist', {}, 'someStep')).rejects.toThrow(
      /Unknown Prisma model: doesNotExist/
    );
  });
});
