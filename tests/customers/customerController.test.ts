/**
 * 顧客（解約者参照）コントローラのテスト（#311）
 * GET /api/v1/customers/terminated
 */

import { Request, Response, NextFunction } from 'express';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        name: string;
        role: string;
        is_active: boolean;
        supabase_uid: string;
      };
    }
  }
}

const mockPrisma: any = {
  customer: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
};

jest.mock('../../src/db/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
  Prisma: {},
}));

import { getTerminatedCustomers } from '../../src/customers/customerController';

const TERMINATED_CUSTOMER = {
  id: 'cust-t1',
  name: '山田太郎',
  name_kana: 'ヤマダタロウ',
  postal_code: '8000000',
  address: '北九州市',
  phone_number: '0931234567',
  email: null,
  notes: '[解約済み顧客] 旧システム del_flg=2。旧区画cd: 600（区画No: legacy-600）',
  legacy_danka_cd: 200,
  created_at: new Date('2026-06-01'),
  familyContacts: [
    {
      id: 'fc-1',
      name: '山田花子',
      name_kana: 'ヤマダハナコ',
      relationship: '妻',
      postal_code: null,
      address: null,
      phone_number: '0937654321',
      email: null,
      notes: null,
    },
  ],
};

describe('getTerminatedCustomers (#311)', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let responseJson: jest.Mock;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    responseJson = jest.fn().mockReturnThis();
    mockResponse = { json: responseJson, status: jest.fn().mockReturnThis() };
    mockNext = jest.fn();
    mockRequest = { params: {}, body: {}, query: {} };
  });

  it('解約者一覧を items + pagination 形式で返し、家族連絡先も含む', async () => {
    mockPrisma.customer.count.mockResolvedValue(1);
    mockPrisma.customer.findMany.mockResolvedValue([TERMINATED_CUSTOMER]);

    // validate ミドルウェア通過後は number に変換済み
    mockRequest.query = { page: 1, limit: 20 } as unknown as Request['query'];

    await getTerminatedCustomers(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockNext).not.toHaveBeenCalled();

    // is_terminated=true のみに絞っている
    expect(mockPrisma.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deleted_at: null, is_terminated: true },
        skip: 0,
        take: 20,
      })
    );

    expect(responseJson).toHaveBeenCalledWith({
      success: true,
      data: {
        items: [
          expect.objectContaining({
            id: 'cust-t1',
            name: '山田太郎',
            nameKana: 'ヤマダタロウ',
            notes: expect.stringContaining('旧区画cd: 600'),
            legacyDankaCd: 200,
            familyContacts: [
              expect.objectContaining({
                id: 'fc-1',
                name: '山田花子',
                relationship: '妻',
                phoneNumber: '0937654321',
              }),
            ],
          }),
        ],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
    });
  });

  it('search 指定時は氏名・カナ・電話・備考（旧区画手がかり）の OR 検索になる', async () => {
    mockPrisma.customer.count.mockResolvedValue(0);
    mockPrisma.customer.findMany.mockResolvedValue([]);

    mockRequest.query = { page: 1, limit: 20, search: '山田' } as unknown as Request['query'];

    await getTerminatedCustomers(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockPrisma.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          is_terminated: true,
          OR: expect.arrayContaining([
            { name: { contains: '山田', mode: 'insensitive' } },
            { name_kana: { contains: '山田', mode: 'insensitive' } },
            { phone_number: { contains: '山田' } },
            { notes: { contains: '山田', mode: 'insensitive' } },
          ]),
        }),
      })
    );
  });

  it('search が数値なら旧檀家コード一致も検索条件に含める', async () => {
    mockPrisma.customer.count.mockResolvedValue(0);
    mockPrisma.customer.findMany.mockResolvedValue([]);

    mockRequest.query = { page: 1, limit: 20, search: '200' } as unknown as Request['query'];

    await getTerminatedCustomers(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockPrisma.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([{ legacy_danka_cd: 200 }]),
        }),
      })
    );
  });

  it('ページネーションが skip/take と totalPages に反映される', async () => {
    mockPrisma.customer.count.mockResolvedValue(45);
    mockPrisma.customer.findMany.mockResolvedValue([]);

    mockRequest.query = { page: 2, limit: 20 } as unknown as Request['query'];

    await getTerminatedCustomers(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockPrisma.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 20 })
    );
    expect(responseJson).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pagination: { page: 2, limit: 20, total: 45, totalPages: 3 },
        }),
      })
    );
  });

  it('DB エラーは next に伝播する', async () => {
    mockPrisma.customer.count.mockRejectedValue(new Error('db down'));
    mockPrisma.customer.findMany.mockRejectedValue(new Error('db down'));

    mockRequest.query = {} as unknown as Request['query'];

    await getTerminatedCustomers(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
  });
});
