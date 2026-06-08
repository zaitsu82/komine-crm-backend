import { PrismaClient } from '@prisma/client';
import { seedMasters } from '../../prisma/seedMasters';

/**
 * seedMasters は prisma クライアントを引数で受け取るため、
 * createMany を spy したフェイクを渡して検証する（実DB不要）。
 */
function createFakePrisma() {
  const makeCreateMany = (count: number) => jest.fn().mockResolvedValue({ count });

  return {
    cemeteryTypeMaster: { createMany: makeCreateMany(3) },
    paymentMethodMaster: { createMany: makeCreateMany(3) },
    taxTypeMaster: { createMany: makeCreateMany(2) },
    calcTypeMaster: { createMany: makeCreateMany(2) },
    billingTypeMaster: { createMany: makeCreateMany(3) },
    recipientTypeMaster: { createMany: makeCreateMany(3) },
    constructionTypeMaster: { createMany: makeCreateMany(4) },
    directionMaster: { createMany: makeCreateMany(8) },
    positionMaster: { createMany: makeCreateMany(3) },
    validityPeriodMaster: { createMany: makeCreateMany(4) },
    changeReasonMaster: { createMany: makeCreateMany(9) },
  };
}

describe('seedMasters', () => {
  it('標準マスタ11種すべてに対して createMany を呼ぶ', async () => {
    const prisma = createFakePrisma();

    const summary = await seedMasters(prisma as unknown as PrismaClient);

    expect(prisma.cemeteryTypeMaster.createMany).toHaveBeenCalledTimes(1);
    expect(prisma.paymentMethodMaster.createMany).toHaveBeenCalledTimes(1);
    expect(prisma.taxTypeMaster.createMany).toHaveBeenCalledTimes(1);
    expect(prisma.calcTypeMaster.createMany).toHaveBeenCalledTimes(1);
    expect(prisma.billingTypeMaster.createMany).toHaveBeenCalledTimes(1);
    expect(prisma.recipientTypeMaster.createMany).toHaveBeenCalledTimes(1);
    expect(prisma.constructionTypeMaster.createMany).toHaveBeenCalledTimes(1);
    expect(prisma.directionMaster.createMany).toHaveBeenCalledTimes(1);
    expect(prisma.positionMaster.createMany).toHaveBeenCalledTimes(1);
    expect(prisma.validityPeriodMaster.createMany).toHaveBeenCalledTimes(1);
    expect(prisma.changeReasonMaster.createMany).toHaveBeenCalledTimes(1);

    expect(summary).toHaveLength(11);
  });

  it('冪等性のため skipDuplicates: true で投入する', async () => {
    const prisma = createFakePrisma();

    await seedMasters(prisma as unknown as PrismaClient);

    for (const model of Object.values(prisma)) {
      const arg = model.createMany.mock.calls[0][0];
      expect(arg.skipDuplicates).toBe(true);
      expect(Array.isArray(arg.data)).toBe(true);
      expect(arg.data.length).toBeGreaterThan(0);
    }
  });

  it('投入された件数を master ごとに集計して返す', async () => {
    const prisma = createFakePrisma();

    const summary = await seedMasters(prisma as unknown as PrismaClient);

    const total = summary.reduce((sum, s) => sum + s.inserted, 0);
    expect(total).toBe(3 + 3 + 2 + 2 + 3 + 3 + 4 + 8 + 3 + 4 + 9);
    expect(summary.map((s) => s.master)).toEqual([
      'cemetery_type_master',
      'payment_method_master',
      'tax_type_master',
      'calc_type_master',
      'billing_type_master',
      'recipient_type_master',
      'construction_type_master',
      'direction_master',
      'position_master',
      'validity_period_master',
      'change_reason_master',
    ]);
  });

  it('各マスタの code は重複しない', async () => {
    const prisma = createFakePrisma();

    await seedMasters(prisma as unknown as PrismaClient);

    for (const model of Object.values(prisma)) {
      const rows = model.createMany.mock.calls[0][0].data as Array<{ code: string }>;
      const codes = rows.map((r) => r.code);
      expect(new Set(codes).size).toBe(codes.length);
    }
  });

  it('税区分には tax_rate が含まれる', async () => {
    const prisma = createFakePrisma();

    await seedMasters(prisma as unknown as PrismaClient);

    const rows = prisma.taxTypeMaster.createMany.mock.calls[0][0].data as Array<{
      tax_rate: string | null;
    }>;
    expect(rows.every((r) => 'tax_rate' in r)).toBe(true);
  });
});
