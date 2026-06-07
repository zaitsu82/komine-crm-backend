/**
 * 回帰テスト: 終了顧客（t_danka.del_flg=2）の取り込みと旧入金の除外（#129）
 *
 * 業務確認（2026-06-07）:
 *   - Q21: 終了顧客150件は「終了」印付きで取り込む → is_terminated=true
 *   - Q19: もう使っていない区画あての昔の入金記録（約35件）は取り込まない
 *
 * 設計: 終了顧客は idMaps.customer に載せない（契約/請求/入金のリンク対象外）。
 * step11 は terminated danka の入金を danka 単位で明示除外する
 * （grave_cd 経由で空き器契約へ誤リンクされるのを防ぐ）。
 */
import type { PrismaClient } from '@prisma/client';

import { createIdMaps } from '../../../../scripts/legacy-migration/idMap';

jest.mock('../../../../scripts/legacy-migration/legacyDb', () => ({
  legacyQuery: jest.fn(),
}));

import { legacyQuery } from '../../../../scripts/legacy-migration/legacyDb';
import { stepCustomer } from '../../../../scripts/legacy-migration/steps/04-customer';
import { stepPayment } from '../../../../scripts/legacy-migration/steps/11-payment';
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

function buildDankaRow(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    danka_cd: 100,
    grave_cd: 500,
    del_flg: 0,
    owner_sei: '小嶺',
    owner_sei_kana: 'コミネ',
    owner_mei: '太郎',
    owner_mei_kana: 'タロウ',
    sex_flg: null,
    birthday: null,
    honseki_zip: null,
    honseki_addr1: null,
    honseki_addr2: null,
    zip: 8000000,
    addr1: '北九州市',
    addr2: null,
    addr3: null,
    tel1: '0931234567',
    tel2: null,
    fax: null,
    email1: null,
    job_name: null,
    job_name_kana: null,
    job_zip: null,
    job_addr1: null,
    job_addr2: null,
    job_addr3: null,
    job_tel1: null,
    kikan_name: null,
    shiten_name: null,
    kouza_type: null,
    kouza_code: null,
    kouza_meigi: null,
    tancd: null,
    note: null,
    request_sei: null,
    request_sei_kana: null,
    request_mei: null,
    request_mei_kana: null,
    request_zip: null,
    request_addr1: null,
    request_addr2: null,
    request_addr3: null,
    request_tel1: null,
    request_tel2: null,
    ...overrides,
  };
}

describe('stepCustomer: 終了顧客（del_flg=2）の取り込み (#129/Q21)', () => {
  beforeEach(() => {
    mockedLegacyQuery.mockReset();
  });

  it('del_flg=2 を is_terminated=true で取り込み、idMaps.customer には載せない', async () => {
    const created: Array<Record<string, unknown>> = [];
    const customerCreate = jest.fn().mockImplementation(({ data }: { data: never }) => {
      created.push(data);
      return Promise.resolve({ id: `cust-${created.length}` });
    });
    const prisma = {
      customer: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: customerCreate,
      },
      workInfo: { create: jest.fn() },
    } as unknown as PrismaClient;

    mockedLegacyQuery.mockResolvedValueOnce([
      buildDankaRow({ danka_cd: 100, del_flg: 0 }),
      buildDankaRow({ danka_cd: 200, grave_cd: 600, del_flg: 2, note: '旧メモ' }),
    ]);

    const idMaps = createIdMaps();
    const result = await stepCustomer.run({
      prisma,
      logger: buildLogger(),
      idMaps,
      dryRun: false,
    });

    expect(result.inserted).toBe(2);
    expect(result.notes?.['terminated_imported']).toBe(1);
    expect(customerCreate).toHaveBeenCalledTimes(2);

    const active = created.find((d) => d['legacy_danka_cd'] === 100);
    const terminated = created.find((d) => d['legacy_danka_cd'] === 200);
    expect(active?.['is_terminated']).toBe(false);
    expect(terminated?.['is_terminated']).toBe(true);
    // 解約場所の手がかり（Q18/Q20）を notes に残し、元の note も保持する
    expect(terminated?.['notes']).toContain('旧区画cd: 600');
    expect(terminated?.['notes']).toContain('旧メモ');

    // 終了顧客は契約/請求/入金のリンク対象にしない
    expect(idMaps.customer.has(100)).toBe(true);
    expect(idMaps.customer.has(200)).toBe(false);
  });

  it('終了顧客は氏名・住所欠損でもプレースホルダ/空文字で取り込む（旧運用は解約で人情報を消すため）', async () => {
    const created: Array<Record<string, unknown>> = [];
    const prisma = {
      customer: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }: { data: never }) => {
          created.push(data);
          return Promise.resolve({ id: 'cust-t' });
        }),
      },
      workInfo: { create: jest.fn() },
    } as unknown as PrismaClient;

    mockedLegacyQuery.mockResolvedValueOnce([
      buildDankaRow({
        danka_cd: 201,
        del_flg: 2,
        owner_sei: null,
        owner_mei: null,
        owner_sei_kana: null,
        owner_mei_kana: null,
        zip: null,
        addr1: null,
        tel1: null,
      }),
    ]);

    const idMaps = createIdMaps();
    const result = await stepCustomer.run({
      prisma,
      logger: buildLogger(),
      idMaps,
      dryRun: false,
    });

    expect(result.inserted).toBe(1);
    expect(created[0]?.['name']).toBe('（氏名不明）');
    expect(created[0]?.['name_kana']).toBe('（フメイ）');
    expect(created[0]?.['postal_code']).toBe('');
    expect(created[0]?.['address']).toBe('');
    expect(result.notes?.['terminated_field_fallback']).toBe(2);
  });

  it('現役顧客（del_flg=0）の氏名欠損は従来どおりスキップする（挙動回帰なし）', async () => {
    const customerCreate = jest.fn();
    const prisma = {
      customer: { findFirst: jest.fn().mockResolvedValue(null), create: customerCreate },
      workInfo: { create: jest.fn() },
    } as unknown as PrismaClient;

    mockedLegacyQuery.mockResolvedValueOnce([
      buildDankaRow({ danka_cd: 101, del_flg: 0, owner_sei: null, owner_mei: null }),
    ]);

    const result = await stepCustomer.run({
      prisma,
      logger: buildLogger(),
      idMaps: createIdMaps(),
      dryRun: false,
    });

    expect(customerCreate).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
    expect(result.notes?.['skip_missing_name']).toBe(1);
  });

  it('dry-run でも終了顧客を idMaps.customer に載せない', async () => {
    const prisma = {} as unknown as PrismaClient;
    mockedLegacyQuery.mockResolvedValueOnce([
      buildDankaRow({ danka_cd: 100, del_flg: 0 }),
      buildDankaRow({ danka_cd: 200, del_flg: 2 }),
    ]);

    const idMaps = createIdMaps();
    const result = await stepCustomer.run({
      prisma,
      logger: buildLogger(),
      idMaps,
      dryRun: true,
    });

    expect(result.inserted).toBe(2);
    expect(result.notes?.['terminated_imported']).toBe(1);
    expect(idMaps.customer.has(100)).toBe(true);
    expect(idMaps.customer.has(200)).toBe(false);
  });
});

describe('stepPayment: 終了顧客の旧入金は取り込まない (#129/Q19)', () => {
  beforeEach(() => {
    mockedLegacyQuery.mockReset();
  });

  function buildNyukinRow(overrides: Record<string, unknown>): Record<string, unknown> {
    return {
      nyukin_cd: 1,
      seikyu_cd: null,
      danka_cd: null,
      grave_cd: null,
      nyukin_yotei_date: null,
      nyukin_yotei_fee: null,
      nyukin_date: 20200101,
      nyukin_fee: 10000,
      fee_type: null,
      note: null,
      charge: null,
      tekiyou_kubun: null,
      seikyu_kubun: null,
      ...overrides,
    };
  }

  it('terminated danka の入金は grave_cd でリンク可能でもスキップする', async () => {
    const paymentCreate = jest.fn().mockResolvedValue({ id: 'pay-1' });
    const prisma = {
      customer: {
        findMany: jest.fn().mockResolvedValue([{ id: 'cust-1', legacy_danka_cd: 100 }]),
      },
      contractPlot: {
        findMany: jest.fn().mockResolvedValue([{ id: 'cp-1', legacy_grave_cd: 500 }]),
      },
      billing: {
        findMany: jest.fn().mockResolvedValue([{ id: 'bill-1', legacy_seikyu_cd: 900 }]),
      },
      payment: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: paymentCreate,
        count: jest.fn().mockResolvedValue(0), // assertNoOrphanRows 用
      },
    } as unknown as PrismaClient;

    mockedLegacyQuery
      // ① SELECT danka_cd FROM t_danka WHERE del_flg = 2
      .mockResolvedValueOnce([{ danka_cd: 200 }])
      // ② SELECT * FROM t_nyukin ...
      .mockResolvedValueOnce([
        // 終了顧客の旧入金: grave_cd=500 は contractPlot にリンク可能だが取り込まない（Q19）
        buildNyukinRow({ nyukin_cd: 10, danka_cd: 200, grave_cd: 500 }),
        // 通常の入金: 取り込む
        buildNyukinRow({ nyukin_cd: 11, seikyu_cd: 900, danka_cd: 100, grave_cd: 500 }),
      ]);

    const result = await stepPayment.run({
      prisma,
      logger: buildLogger(),
      idMaps: createIdMaps(),
      dryRun: false,
    });

    expect(result.inserted).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.notes?.['skip_terminated_danka']).toBe(1);
    expect(paymentCreate).toHaveBeenCalledTimes(1);
    expect(paymentCreate.mock.calls[0][0].data.legacy_nyukin_cd).toBe(11);
  });
});
