import { Request, Response, NextFunction } from 'express';

// Express.Request型を拡張
declare global {
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

// Supabase Adminモックの作成
const mockSupabaseAdminAuth = {
  inviteUserByEmail: jest.fn(),
  createUser: jest.fn(),
  deleteUser: jest.fn(),
  updateUserById: jest.fn(),
};

const mockSupabase = {
  auth: {
    admin: mockSupabaseAdminAuth,
  },
};

// @supabase/supabase-jsモジュールをモック化
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

// Prismaモックの作成
const mockPrisma = {
  staff: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn(),
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

describe('bulkCreateStaff', () => {
  let bulkCreateStaff: any;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(async () => {
    jest.resetModules();
    const staffController = await import('../../src/staff/staffController');
    bulkCreateStaff = staffController.bulkCreateStaff;

    mockRequest = {
      body: {},
      params: {},
      query: {},
      user: {
        id: 1,
        email: 'admin@example.com',
        name: 'Admin',
        role: 'admin',
        is_active: true,
        supabase_uid: 'admin-uid',
      },
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  it('3件のスタッフを一括登録できる', async () => {
    const items = [
      { name: 'Staff A', email: 'a@example.com', role: 'viewer' },
      { name: 'Staff B', email: 'b@example.com', role: 'operator' },
      { name: 'Staff C', email: 'c@example.com', role: 'admin' },
    ];
    mockRequest.body = { items };

    // 既存メールなし
    mockPrisma.staff.findMany.mockResolvedValue([]);

    // トランザクション成功
    const createdStaff = [
      {
        id: 1,
        name: 'Staff A',
        email: 'a@example.com',
        role: 'viewer',
        is_active: true,
        supabase_uid: 'pending_bulk_123_0',
      },
      {
        id: 2,
        name: 'Staff B',
        email: 'b@example.com',
        role: 'operator',
        is_active: true,
        supabase_uid: 'pending_bulk_123_1',
      },
      {
        id: 3,
        name: 'Staff C',
        email: 'c@example.com',
        role: 'admin',
        is_active: true,
        supabase_uid: 'pending_bulk_123_2',
      },
    ];
    mockPrisma.$transaction.mockResolvedValue(createdStaff);

    await bulkCreateStaff(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockResponse.status).toHaveBeenCalledWith(201);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          totalRequested: 3,
          created: 3,
          results: expect.arrayContaining([
            expect.objectContaining({ id: 1, name: 'Staff A', email: 'a@example.com' }),
            expect.objectContaining({ id: 2, name: 'Staff B', email: 'b@example.com' }),
            expect.objectContaining({ id: 3, name: 'Staff C', email: 'c@example.com' }),
          ]),
        }),
      })
    );
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it('バリデーションエラー（無効なメール、名前なし）を行番号付きで返す', async () => {
    const items = [
      { name: '', email: 'valid@example.com', role: 'viewer' },
      { name: 'Staff B', email: 'invalid-email', role: 'viewer' },
    ];
    mockRequest.body = { items };

    await bulkCreateStaff(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: '一括登録でエラーが発生しました',
          details: expect.arrayContaining([
            expect.objectContaining({
              row: 0,
              field: 'name',
              message: expect.stringContaining('名前'),
            }),
            expect.objectContaining({
              row: 1,
              field: 'email',
              message: expect.stringContaining('メールアドレス'),
            }),
          ]),
        }),
      })
    );
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('バッチ内でメールアドレスが重複している場合エラーを返す', async () => {
    const items = [
      { name: 'Staff A', email: 'same@example.com', role: 'viewer' },
      { name: 'Staff B', email: 'same@example.com', role: 'operator' },
    ];
    mockRequest.body = { items };

    await bulkCreateStaff(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'VALIDATION_ERROR',
          details: expect.arrayContaining([
            expect.objectContaining({
              row: 1,
              field: 'email',
              message: 'バッチ内でメールアドレスが重複しています',
            }),
          ]),
        }),
      })
    );
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('既存のDBレコードとメールアドレスが重複している場合409エラーを返す', async () => {
    const items = [
      { name: 'Staff A', email: 'existing@example.com', role: 'viewer' },
      { name: 'Staff B', email: 'new@example.com', role: 'viewer' },
    ];
    mockRequest.body = { items };

    // 既存メールあり
    mockPrisma.staff.findMany.mockResolvedValue([{ email: 'existing@example.com' }]);

    await bulkCreateStaff(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockResponse.status).toHaveBeenCalledWith(409);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'VALIDATION_ERROR',
          details: expect.arrayContaining([
            expect.objectContaining({
              row: 0,
              field: 'email',
              message: 'このメールアドレスは既に使用されています',
            }),
          ]),
        }),
      })
    );
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('空の配列の場合バリデーションエラーを返す', async () => {
    mockRequest.body = { items: [] };

    await bulkCreateStaff(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    const error = (mockNext as jest.Mock).mock.calls[0][0];
    expect(error.message).toBe('items は空にできません');
  });

  it('101件を超える場合バリデーションエラーを返す', async () => {
    const items = Array.from({ length: 101 }, (_, i) => ({
      name: `Staff ${i}`,
      email: `staff${i}@example.com`,
      role: 'viewer',
    }));
    mockRequest.body = { items };

    await bulkCreateStaff(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    const error = (mockNext as jest.Mock).mock.calls[0][0];
    expect(error.message).toBe('一括登録は最大100件までです');
  });

  it('items が配列でない場合バリデーションエラーを返す', async () => {
    mockRequest.body = { items: 'not-an-array' };

    await bulkCreateStaff(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    const error = (mockNext as jest.Mock).mock.calls[0][0];
    expect(error.message).toBe('items は配列である必要があります');
  });

  it('無効なロールの場合バリデーションエラーを返す', async () => {
    const items = [{ name: 'Staff A', email: 'a@example.com', role: 'superadmin' }];
    mockRequest.body = { items };

    await bulkCreateStaff(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'VALIDATION_ERROR',
          details: expect.arrayContaining([
            expect.objectContaining({
              row: 0,
              field: 'role',
            }),
          ]),
        }),
      })
    );
    // Verify the error detail has a message about the role field
    const jsonCall = (mockResponse.json as jest.Mock).mock.calls[0][0];
    const roleError = jsonCall.error.details.find((d: any) => d.field === 'role');
    expect(roleError).toBeDefined();
    expect(roleError.message).toBeTruthy();
  });

  it('名前が100文字を超える場合バリデーションエラーを返す', async () => {
    const items = [{ name: 'A'.repeat(101), email: 'a@example.com', role: 'viewer' }];
    mockRequest.body = { items };

    await bulkCreateStaff(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          details: expect.arrayContaining([
            expect.objectContaining({
              row: 0,
              field: 'name',
              message: expect.stringContaining('100文字'),
            }),
          ]),
        }),
      })
    );
  });
});
