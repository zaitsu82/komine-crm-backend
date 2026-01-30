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

// Supabaseモックの作成
const mockSupabaseAuth = {
  getUser: jest.fn(),
};

const mockSupabase = {
  auth: mockSupabaseAuth,
};

// @supabase/supabase-jsモジュールをモック化
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

// Prismaモックの作成
const mockPrisma = {
  staff: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

// 環境変数をモック化
const originalEnv = process.env;

describe('Auth Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  describe('Supabase環境変数が設定されている場合', () => {
    beforeAll(() => {
      // 環境変数を設定
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    beforeEach(() => {
      // モジュールキャッシュをクリア
      jest.resetModules();

      mockRequest = {
        headers: {},
      };
      mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      mockNext = jest.fn();
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      jest.clearAllMocks();
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });

    describe('authenticate', () => {
      let authenticate: any;

      beforeEach(async () => {
        const authMiddleware = await import('../../src/middleware/auth');
        authenticate = authMiddleware.authenticate;
      });

      it('有効なトークンで認証が成功すること', async () => {
        const mockUser = {
          id: 'supabase-uid-123',
          email: 'test@example.com',
        };
        const mockStaff = {
          id: 1,
          name: 'テストユーザー',
          email: 'test@example.com',
          role: 'admin',
          is_active: true,
          supabase_uid: 'supabase-uid-123',
        };

        mockRequest.headers = {
          authorization: 'Bearer test-token-123',
        };

        mockSupabaseAuth.getUser.mockResolvedValue({
          data: { user: mockUser },
          error: null,
        });
        mockPrisma.staff.findUnique.mockResolvedValue(mockStaff);
        mockPrisma.staff.update.mockResolvedValue(mockStaff);

        await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockSupabaseAuth.getUser).toHaveBeenCalledWith('test-token-123');
        expect(mockPrisma.staff.findUnique).toHaveBeenCalledWith({
          where: { supabase_uid: 'supabase-uid-123' },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            is_active: true,
            supabase_uid: true,
          },
        });
        expect(mockPrisma.staff.update).toHaveBeenCalled();
        expect(mockRequest.user).toEqual({
          id: 1,
          email: 'test@example.com',
          name: 'テストユーザー',
          role: 'admin',
          is_active: true,
          supabase_uid: 'supabase-uid-123',
        });
        expect(mockNext).toHaveBeenCalled();
      });

      it('Authorizationヘッダーがない場合、401エラーを返すこと', async () => {
        mockRequest.headers = {};

        await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockResponse.status).toHaveBeenCalledWith(401);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '認証トークンが必要です',
            details: [],
          },
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('トークンが空の場合、401エラーを返すこと', async () => {
        mockRequest.headers = {
          authorization: 'Bearer ',
        };

        await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockResponse.status).toHaveBeenCalledWith(401);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '認証トークンが必要です',
            details: [],
          },
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('無効なトークンの場合、401エラーを返すこと', async () => {
        mockRequest.headers = {
          authorization: 'Bearer invalid-token',
        };

        mockSupabaseAuth.getUser.mockResolvedValue({
          data: { user: null },
          error: { message: 'Invalid token' },
        });

        await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockResponse.status).toHaveBeenCalledWith(401);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '無効なトークンです',
            details: [],
          },
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('ユーザーが登録されていない場合、401エラーを返すこと', async () => {
        const mockUser = {
          id: 'supabase-uid-123',
          email: 'test@example.com',
        };

        mockRequest.headers = {
          authorization: 'Bearer test-token-123',
        };

        mockSupabaseAuth.getUser.mockResolvedValue({
          data: { user: mockUser },
          error: null,
        });
        mockPrisma.staff.findUnique.mockResolvedValue(null);

        await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockResponse.status).toHaveBeenCalledWith(401);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'ユーザーが登録されていません',
            details: [],
          },
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('ユーザーアカウントが無効の場合、401エラーを返すこと', async () => {
        const mockUser = {
          id: 'supabase-uid-123',
          email: 'test@example.com',
        };
        const mockStaff = {
          id: 1,
          name: 'テストユーザー',
          email: 'test@example.com',
          role: 'admin',
          is_active: false, // 無効
          supabase_uid: 'supabase-uid-123',
        };

        mockRequest.headers = {
          authorization: 'Bearer test-token-123',
        };

        mockSupabaseAuth.getUser.mockResolvedValue({
          data: { user: mockUser },
          error: null,
        });
        mockPrisma.staff.findUnique.mockResolvedValue(mockStaff);

        await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockResponse.status).toHaveBeenCalledWith(401);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'ユーザーアカウントが無効になっています',
            details: [],
          },
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('予期しないエラーが発生した場合、401エラーを返すこと', async () => {
        mockRequest.headers = {
          authorization: 'Bearer test-token-123',
        };

        mockSupabaseAuth.getUser.mockRejectedValue(new Error('Unexpected error'));

        await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockResponse.status).toHaveBeenCalledWith(401);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '認証に失敗しました',
            details: [],
          },
        });
        expect(mockNext).not.toHaveBeenCalled();
      });
    });

    describe('optionalAuthenticate', () => {
      let optionalAuthenticate: any;

      beforeEach(async () => {
        const authMiddleware = await import('../../src/middleware/auth');
        optionalAuthenticate = authMiddleware.optionalAuthenticate;
      });

      it('有効なトークンで認証が成功すること', async () => {
        const mockUser = {
          id: 'supabase-uid-123',
          email: 'test@example.com',
        };
        const mockStaff = {
          id: 1,
          name: 'テストユーザー',
          email: 'test@example.com',
          role: 'admin',
          is_active: true,
          supabase_uid: 'supabase-uid-123',
        };

        mockRequest.headers = {
          authorization: 'Bearer test-token-123',
        };

        mockSupabaseAuth.getUser.mockResolvedValue({
          data: { user: mockUser },
          error: null,
        });
        mockPrisma.staff.findUnique.mockResolvedValue(mockStaff);

        await optionalAuthenticate(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockSupabaseAuth.getUser).toHaveBeenCalledWith('test-token-123');
        expect(mockRequest.user).toEqual({
          id: 1,
          email: 'test@example.com',
          name: 'テストユーザー',
          role: 'admin',
          is_active: true,
          supabase_uid: 'supabase-uid-123',
        });
        expect(mockNext).toHaveBeenCalled();
      });

      it('Authorizationヘッダーがなくても次に進むこと', async () => {
        mockRequest.headers = {};

        await optionalAuthenticate(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockSupabaseAuth.getUser).not.toHaveBeenCalled();
        expect(mockRequest.user).toBeUndefined();
        expect(mockNext).toHaveBeenCalled();
      });

      it('トークンが空でも次に進むこと', async () => {
        mockRequest.headers = {
          authorization: 'Bearer ',
        };

        await optionalAuthenticate(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockSupabaseAuth.getUser).not.toHaveBeenCalled();
        expect(mockRequest.user).toBeUndefined();
        expect(mockNext).toHaveBeenCalled();
      });

      it('無効なトークンでも次に進むこと', async () => {
        mockRequest.headers = {
          authorization: 'Bearer invalid-token',
        };

        mockSupabaseAuth.getUser.mockResolvedValue({
          data: { user: null },
          error: { message: 'Invalid token' },
        });

        await optionalAuthenticate(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockRequest.user).toBeUndefined();
        expect(mockNext).toHaveBeenCalled();
      });

      it('ユーザーが登録されていなくても次に進むこと', async () => {
        const mockUser = {
          id: 'supabase-uid-123',
          email: 'test@example.com',
        };

        mockRequest.headers = {
          authorization: 'Bearer test-token-123',
        };

        mockSupabaseAuth.getUser.mockResolvedValue({
          data: { user: mockUser },
          error: null,
        });
        mockPrisma.staff.findUnique.mockResolvedValue(null);

        await optionalAuthenticate(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockRequest.user).toBeUndefined();
        expect(mockNext).toHaveBeenCalled();
      });

      it('ユーザーアカウントが無効でも次に進むこと', async () => {
        const mockUser = {
          id: 'supabase-uid-123',
          email: 'test@example.com',
        };
        const mockStaff = {
          id: 1,
          name: 'テストユーザー',
          email: 'test@example.com',
          role: 'admin',
          is_active: false, // 無効
          supabase_uid: 'supabase-uid-123',
        };

        mockRequest.headers = {
          authorization: 'Bearer test-token-123',
        };

        mockSupabaseAuth.getUser.mockResolvedValue({
          data: { user: mockUser },
          error: null,
        });
        mockPrisma.staff.findUnique.mockResolvedValue(mockStaff);

        await optionalAuthenticate(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockRequest.user).toBeUndefined();
        expect(mockNext).toHaveBeenCalled();
      });

      it('予期しないエラーが発生しても次に進むこと', async () => {
        mockRequest.headers = {
          authorization: 'Bearer test-token-123',
        };

        mockSupabaseAuth.getUser.mockRejectedValue(new Error('Unexpected error'));

        await optionalAuthenticate(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockRequest.user).toBeUndefined();
        expect(mockNext).toHaveBeenCalled();
      });
    });
  }); // Supabase環境変数が設定されている場合の終了

  describe('Supabase環境変数が設定されていない場合', () => {
    beforeAll(() => {
      // 環境変数をクリア
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    beforeEach(() => {
      jest.resetModules();
      mockRequest = { headers: {} };
      mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      mockNext = jest.fn();
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      jest.clearAllMocks();
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });

    it('authenticateが503エラーを返すこと', async () => {
      const authMiddleware = await import('../../src/middleware/auth');
      const authenticate = authMiddleware.authenticate;

      mockRequest.headers = {
        authorization: 'Bearer test-token-123',
      };

      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Supabase認証サービスが利用できません',
          details: [],
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('optionalAuthenticateが次に進むこと', async () => {
      const authMiddleware = await import('../../src/middleware/auth');
      const optionalAuthenticate = authMiddleware.optionalAuthenticate;

      mockRequest.headers = {
        authorization: 'Bearer test-token-123',
      };

      await optionalAuthenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });
  });
});
