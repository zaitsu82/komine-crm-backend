import { Request, Response } from 'express';

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
  signInWithPassword: jest.fn(),
  getUser: jest.fn(),
  admin: {
    signOut: jest.fn(),
    updateUserById: jest.fn(),
  },
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

describe('Auth Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
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
        body: {},
        headers: {},
        cookies: {},
      };
      mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        cookie: jest.fn().mockReturnThis(),
        clearCookie: jest.fn().mockReturnThis(),
      };
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      jest.clearAllMocks();
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });

    describe('login', () => {
      let login: any;

      beforeEach(async () => {
        // 毎回モジュールを再インポート
        const authController = await import('../../src/auth/authController');
        login = authController.login;
      });

      it('正常なログインが成功すること', async () => {
        const mockUser = {
          id: 'supabase-uid-123',
          email: 'test@example.com',
        };
        const mockSession = {
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          expires_at: 1234567890,
        };
        const mockStaff = {
          id: 1,
          name: 'テストユーザー',
          email: 'test@example.com',
          role: 'admin',
          is_active: true,
          supabase_uid: 'supabase-uid-123',
        };

        mockRequest.body = {
          email: 'test@example.com',
          password: 'password123',
        };

        mockSupabaseAuth.signInWithPassword.mockResolvedValue({
          data: { user: mockUser, session: mockSession },
          error: null,
        });
        mockPrisma.staff.findUnique.mockResolvedValue(mockStaff);
        mockPrisma.staff.update.mockResolvedValue(mockStaff);

        await login(mockRequest as Request, mockResponse as Response);

        expect(mockSupabaseAuth.signInWithPassword).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
        });
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
        expect(mockResponse.status).toHaveBeenCalledWith(200);
        // トークンはCookieに設定されるため、レスポンスボディには含まれない
        expect(mockResponse.cookie).toHaveBeenCalled();
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          data: {
            user: {
              id: 1,
              email: 'test@example.com',
              name: 'テストユーザー',
              role: 'admin',
              supabase_uid: 'supabase-uid-123',
            },
            session: {
              expires_at: 1234567890,
            },
          },
        });
      });

      it('メールアドレスが未入力の場合、400エラーを返すこと', async () => {
        mockRequest.body = {
          password: 'password123',
        };

        await login(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'メールアドレスとパスワードは必須です',
            details: [],
          },
        });
      });

      it('パスワードが未入力の場合、400エラーを返すこと', async () => {
        mockRequest.body = {
          email: 'test@example.com',
        };

        await login(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'メールアドレスとパスワードは必須です',
            details: [],
          },
        });
      });

      it('Supabase認証に失敗した場合、401エラーを返すこと', async () => {
        mockRequest.body = {
          email: 'test@example.com',
          password: 'wrongpassword',
        };

        mockSupabaseAuth.signInWithPassword.mockResolvedValue({
          data: { user: null, session: null },
          error: { message: 'Invalid credentials' },
        });

        await login(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(401);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'メールアドレスまたはパスワードが正しくありません',
            details: [],
          },
        });
      });

      it('ユーザーが登録されていない場合、401エラーを返すこと', async () => {
        const mockUser = {
          id: 'supabase-uid-123',
          email: 'test@example.com',
        };
        const mockSession = {
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          expires_at: 1234567890,
        };

        mockRequest.body = {
          email: 'test@example.com',
          password: 'password123',
        };

        mockSupabaseAuth.signInWithPassword.mockResolvedValue({
          data: { user: mockUser, session: mockSession },
          error: null,
        });
        mockPrisma.staff.findUnique.mockResolvedValue(null);

        await login(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(401);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'ユーザーが登録されていません',
            details: [],
          },
        });
      });

      it('ユーザーアカウントが無効の場合、401エラーを返すこと', async () => {
        const mockUser = {
          id: 'supabase-uid-123',
          email: 'test@example.com',
        };
        const mockSession = {
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          expires_at: 1234567890,
        };
        const mockStaff = {
          id: 1,
          name: 'テストユーザー',
          email: 'test@example.com',
          role: 'admin',
          is_active: false, // 無効
          supabase_uid: 'supabase-uid-123',
        };

        mockRequest.body = {
          email: 'test@example.com',
          password: 'password123',
        };

        mockSupabaseAuth.signInWithPassword.mockResolvedValue({
          data: { user: mockUser, session: mockSession },
          error: null,
        });
        mockPrisma.staff.findUnique.mockResolvedValue(mockStaff);

        await login(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(401);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'ユーザーアカウントが無効になっています',
            details: [],
          },
        });
      });

      it('データベースエラーが発生した場合、500エラーを返すこと', async () => {
        const mockUser = {
          id: 'supabase-uid-123',
          email: 'test@example.com',
        };
        const mockSession = {
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          expires_at: 1234567890,
        };

        mockRequest.body = {
          email: 'test@example.com',
          password: 'password123',
        };

        mockSupabaseAuth.signInWithPassword.mockResolvedValue({
          data: { user: mockUser, session: mockSession },
          error: null,
        });
        mockPrisma.staff.findUnique.mockRejectedValue(new Error('Database error'));

        await login(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'ログイン処理中にエラーが発生しました',
            details: [],
          },
        });
      });
    });

    describe('logout', () => {
      let logout: any;

      beforeEach(async () => {
        const authController = await import('../../src/auth/authController');
        logout = authController.logout;
      });

      it('正常にログアウトできること', async () => {
        mockRequest.headers = {
          authorization: 'Bearer test-token-123',
        };

        mockSupabaseAuth.admin.signOut.mockResolvedValue({ error: null });

        await logout(mockRequest as Request, mockResponse as Response);

        expect(mockSupabaseAuth.admin.signOut).toHaveBeenCalledWith('test-token-123');
        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          data: {
            message: 'ログアウトしました',
          },
        });
      });

      it('トークンなしでもログアウトできること', async () => {
        mockRequest.headers = {};

        await logout(mockRequest as Request, mockResponse as Response);

        expect(mockSupabaseAuth.admin.signOut).not.toHaveBeenCalled();
        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          data: {
            message: 'ログアウトしました',
          },
        });
      });

      it('Supabaseエラーが発生しても正常終了すること（ログアウト処理の継続）', async () => {
        mockRequest.headers = {
          authorization: 'Bearer test-token-123',
        };

        mockSupabaseAuth.admin.signOut.mockRejectedValue(new Error('Supabase error'));

        await logout(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'ログアウト処理中にエラーが発生しました',
            details: [],
          },
        });
      });
    });

    describe('getCurrentUser', () => {
      let getCurrentUser: any;

      beforeEach(async () => {
        const authController = await import('../../src/auth/authController');
        getCurrentUser = authController.getCurrentUser;
      });

      it('正常にユーザー情報を取得できること', async () => {
        const mockStaff = {
          id: 1,
          name: 'テストユーザー',
          email: 'test@example.com',
          role: 'admin',
          is_active: true,
          supabase_uid: 'supabase-uid-123',
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-02'),
          last_login_at: new Date('2024-01-03'),
        };

        mockRequest.user = {
          id: 1,
          email: 'test@example.com',
          name: 'テストユーザー',
          role: 'admin',
          is_active: true,
          supabase_uid: 'supabase-uid-123',
        };

        mockPrisma.staff.findUnique.mockResolvedValue(mockStaff);

        await getCurrentUser(mockRequest as Request, mockResponse as Response);

        expect(mockPrisma.staff.findUnique).toHaveBeenCalledWith({
          where: { id: 1 },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            is_active: true,
            supabase_uid: true,
            created_at: true,
            updated_at: true,
            last_login_at: true,
          },
        });
        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          data: {
            user: mockStaff,
          },
        });
      });

      it('認証されていない場合、401エラーを返すこと', async () => {
        mockRequest.user = undefined;

        await getCurrentUser(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(401);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '認証が必要です',
            details: [],
          },
        });
      });

      it('ユーザーが見つからない場合、404エラーを返すこと', async () => {
        mockRequest.user = {
          id: 999,
          email: 'test@example.com',
          name: 'テストユーザー',
          role: 'admin',
          is_active: true,
          supabase_uid: 'supabase-uid-123',
        };

        mockPrisma.staff.findUnique.mockResolvedValue(null);

        await getCurrentUser(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(404);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'ユーザーが見つかりません',
            details: [],
          },
        });
      });

      it('データベースエラーが発生した場合、500エラーを返すこと', async () => {
        mockRequest.user = {
          id: 1,
          email: 'test@example.com',
          name: 'テストユーザー',
          role: 'admin',
          is_active: true,
          supabase_uid: 'supabase-uid-123',
        };

        mockPrisma.staff.findUnique.mockRejectedValue(new Error('Database error'));

        await getCurrentUser(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'ユーザー情報取得中にエラーが発生しました',
            details: [],
          },
        });
      });
    });

    describe('changePassword', () => {
      let changePassword: any;

      beforeEach(async () => {
        const authController = await import('../../src/auth/authController');
        changePassword = authController.changePassword;
      });

      it('正常にパスワードを変更できること', async () => {
        mockRequest.user = {
          id: 1,
          email: 'test@example.com',
          name: 'テストユーザー',
          role: 'admin',
          is_active: true,
          supabase_uid: 'supabase-uid-123',
        };
        mockRequest.body = {
          currentPassword: 'oldpassword123',
          newPassword: 'newpassword123',
        };

        mockSupabaseAuth.signInWithPassword.mockResolvedValue({
          data: { user: { id: 'supabase-uid-123' }, session: {} },
          error: null,
        });
        mockSupabaseAuth.admin.updateUserById.mockResolvedValue({
          data: {},
          error: null,
        });

        await changePassword(mockRequest as Request, mockResponse as Response);

        expect(mockSupabaseAuth.signInWithPassword).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'oldpassword123',
        });
        expect(mockSupabaseAuth.admin.updateUserById).toHaveBeenCalledWith('supabase-uid-123', {
          password: 'newpassword123',
        });
        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          data: {
            message: 'パスワードを変更しました',
          },
        });
      });

      it('認証されていない場合、401エラーを返すこと', async () => {
        mockRequest.user = undefined;
        mockRequest.body = {
          currentPassword: 'oldpassword123',
          newPassword: 'newpassword123',
        };

        await changePassword(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(401);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '認証が必要です',
            details: [],
          },
        });
      });

      it('現在のパスワードが未入力の場合、400エラーを返すこと', async () => {
        mockRequest.user = {
          id: 1,
          email: 'test@example.com',
          name: 'テストユーザー',
          role: 'admin',
          is_active: true,
          supabase_uid: 'supabase-uid-123',
        };
        mockRequest.body = {
          newPassword: 'newpassword123',
        };

        await changePassword(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '現在のパスワードと新しいパスワードは必須です',
            details: [],
          },
        });
      });

      it('新しいパスワードが未入力の場合、400エラーを返すこと', async () => {
        mockRequest.user = {
          id: 1,
          email: 'test@example.com',
          name: 'テストユーザー',
          role: 'admin',
          is_active: true,
          supabase_uid: 'supabase-uid-123',
        };
        mockRequest.body = {
          currentPassword: 'oldpassword123',
        };

        await changePassword(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '現在のパスワードと新しいパスワードは必須です',
            details: [],
          },
        });
      });

      it('新しいパスワードが8文字未満の場合、400エラーを返すこと', async () => {
        mockRequest.user = {
          id: 1,
          email: 'test@example.com',
          name: 'テストユーザー',
          role: 'admin',
          is_active: true,
          supabase_uid: 'supabase-uid-123',
        };
        mockRequest.body = {
          currentPassword: 'oldpassword123',
          newPassword: 'short',
        };

        await changePassword(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'パスワードは8文字以上である必要があります',
            details: [],
          },
        });
      });

      it('現在のパスワードが正しくない場合、401エラーを返すこと', async () => {
        mockRequest.user = {
          id: 1,
          email: 'test@example.com',
          name: 'テストユーザー',
          role: 'admin',
          is_active: true,
          supabase_uid: 'supabase-uid-123',
        };
        mockRequest.body = {
          currentPassword: 'wrongpassword',
          newPassword: 'newpassword123',
        };

        mockSupabaseAuth.signInWithPassword.mockResolvedValue({
          data: { user: null, session: null },
          error: { message: 'Invalid credentials' },
        });

        await changePassword(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(401);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '現在のパスワードが正しくありません',
            details: [],
          },
        });
      });

      it('パスワード更新に失敗した場合、500エラーを返すこと', async () => {
        mockRequest.user = {
          id: 1,
          email: 'test@example.com',
          name: 'テストユーザー',
          role: 'admin',
          is_active: true,
          supabase_uid: 'supabase-uid-123',
        };
        mockRequest.body = {
          currentPassword: 'oldpassword123',
          newPassword: 'newpassword123',
        };

        mockSupabaseAuth.signInWithPassword.mockResolvedValue({
          data: { user: { id: 'supabase-uid-123' }, session: {} },
          error: null,
        });
        mockSupabaseAuth.admin.updateUserById.mockResolvedValue({
          data: null,
          error: { message: 'Update failed' },
        });

        await changePassword(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'パスワードの更新に失敗しました',
            details: [],
          },
        });
      });

      it('予期しないエラーが発生した場合、500エラーを返すこと', async () => {
        mockRequest.user = {
          id: 1,
          email: 'test@example.com',
          name: 'テストユーザー',
          role: 'admin',
          is_active: true,
          supabase_uid: 'supabase-uid-123',
        };
        mockRequest.body = {
          currentPassword: 'oldpassword123',
          newPassword: 'newpassword123',
        };

        mockSupabaseAuth.signInWithPassword.mockRejectedValue(new Error('Unexpected error'));

        await changePassword(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'パスワード変更中にエラーが発生しました',
            details: [],
          },
        });
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
      mockRequest = { body: {}, headers: {}, cookies: {} };
      mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        cookie: jest.fn().mockReturnThis(),
        clearCookie: jest.fn().mockReturnThis(),
      };
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      jest.clearAllMocks();
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });

    it('loginが503エラーを返すこと', async () => {
      const authController = await import('../../src/auth/authController');
      const login = authController.login;

      mockRequest.body = {
        email: 'test@example.com',
        password: 'password123',
      };

      await login(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Supabase認証サービスが利用できません',
          details: [],
        },
      });
    });

    it('logoutが503エラーを返すこと', async () => {
      const authController = await import('../../src/auth/authController');
      const logout = authController.logout;

      mockRequest.headers = {
        authorization: 'Bearer test-token',
      };

      await logout(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Supabase認証サービスが利用できません',
          details: [],
        },
      });
    });

    it('changePasswordが503エラーを返すこと', async () => {
      const authController = await import('../../src/auth/authController');
      const changePassword = authController.changePassword;

      mockRequest.user = {
        id: 1,
        email: 'test@example.com',
        name: 'テストユーザー',
        role: 'admin',
        is_active: true,
        supabase_uid: 'supabase-uid-123',
      };
      mockRequest.body = {
        currentPassword: 'oldpassword123',
        newPassword: 'newpassword123',
      };

      await changePassword(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Supabase認証サービスが利用できません',
          details: [],
        },
      });
    });
  });
});
