/**
 * 回帰テスト: 建立期限/建立日のマッピング修正（#326）
 *
 * step05 は以前 konryu_kigen(建立期限)/konryu_date(建立日) を
 * ContractPlot.permit_date(許可日)/start_date(開始日) に誤投入していた。
 * 正しい器は GravestoneInfo.establishment_deadline/establishment_date。
 * permit_date/start_date は真の許可日列が未確定（komine-docs#10 項目5）のため null。
 */
import type { PrismaClient } from '@prisma/client';

import { createIdMaps } from '../../../../scripts/legacy-migration/idMap';

jest.mock('../../../../scripts/legacy-migration/legacyDb', () => ({
  legacyQuery: jest.fn(),
}));

import { legacyQuery } from '../../../../scripts/legacy-migration/legacyDb';
import { stepContractPlot } from '../../../../scripts/legacy-migration/steps/05-contract-plot';
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

describe('step05 konryu → establishment マッピング (#326)', () => {
  beforeEach(() => {
    mockedLegacyQuery.mockReset();
  });

  it('konryu_kigen/konryu_date を GravestoneInfo へ入れ、permit_date/start_date は null にする', async () => {
    const contractPlotCreate = jest.fn().mockResolvedValue({ id: 'cp-1' });
    const gravestoneInfoCreate = jest.fn().mockResolvedValue({ id: 'gi-1' });

    const prisma = {
      physicalPlot: { findMany: jest.fn(), update: jest.fn() },
      contractPlot: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: contractPlotCreate,
      },
      usageFee: { create: jest.fn() },
      managementFee: { create: jest.fn() },
      gravestoneInfo: { create: gravestoneInfoCreate },
    } as unknown as PrismaClient;

    // boshi/houi_id/ichi_id/bosekiryou は無し → 建立期限/建立日のみで GravestoneInfo が作られる
    mockedLegacyQuery.mockResolvedValueOnce([
      {
        grave_cd: 500,
        danka_cd: 100,
        status: 1, // active
        konryu_kigen: 20200101,
        konryu_date: 20200201,
        note: null,
      },
    ]);

    const idMaps = createIdMaps();
    idMaps.physicalPlot.set(500, 'pp-1'); // rebuildIdMap を no-op にする

    await stepContractPlot.run({ prisma, logger: buildLogger(), idMaps, dryRun: false });

    // permit_date/start_date は null（誤投入しない）
    expect(contractPlotCreate).toHaveBeenCalledTimes(1);
    const cpData = contractPlotCreate.mock.calls[0][0].data;
    expect(cpData.permit_date).toBeNull();
    expect(cpData.start_date).toBeNull();

    // GravestoneInfo に建立期限/建立日が入る
    expect(gravestoneInfoCreate).toHaveBeenCalledTimes(1);
    const giData = gravestoneInfoCreate.mock.calls[0][0].data;
    expect(giData.establishment_deadline).toBeInstanceOf(Date);
    expect(giData.establishment_date).toBeInstanceOf(Date);
    expect(giData.contract_plot_id).toBe('cp-1');
  });
});
