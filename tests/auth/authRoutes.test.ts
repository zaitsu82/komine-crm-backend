import request from 'supertest';
import express, { Express } from 'express';

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

// コントローラーのモック
const mockLogin = jest.fn();
const mockLogout = jest.fn();
const mockGetCurrentUser = jest.fn();
const mockChangePassword = jest.fn();

jest.mock('../../src/auth/authController', () => ({
  login: (req: any, res: any) => mockLogin(req, res),
  logout: (req: any, res: any) => mockLogout(req, res),
  getCurrentUser: (req: any, res: any) => mockGetCurrentUser(req, res),
  changePassword: (req: any, res: any) => mockChangePassword(req, res),
}));

// Authenticateミドルウェアのモック
const mockAuthenticate = jest.fn((req, res, next) => next());

jest.mock('../../src/middleware/auth', () => ({
  authenticate: (req: any, res: any, next: any) => mockAuthenticate(req, res, next),
}));

// Validationミドルウェアのモック
jest.mock('../../src/middleware/validation', () => {
  const actual = jest.requireActual('../../src/middleware/validation');
  return {
    ...actual,
    validate: jest.fn(() => (req: any, res: any, next: any) => next()),
  };
});

// Securityミドルウェアのモック
jest.mock('../../src/middleware/security', () => ({
  createAuthRateLimiter: jest.fn(() => (req: any, res: any, next: any) => next()),
}));

// Supabaseモック
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      signInWithPassword: jest.fn(),
      getUser: jest.fn(),
      admin: {
        signOut: jest.fn(),
        updateUserById: jest.fn(),
      },
    },
  })),
}));

// Prismaモック
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    staff: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  })),
}));

describe('Auth Routes', () => {
  let app: Express;

  beforeAll(() => {
    // 環境変数を設定
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    // Expressアプリを作成
    app = express();
    app.use(express.json());

    // ルートをインポート（毎回新しいインスタンスを使用）
    const authRoutes = (await import('../../src/auth/authRoutes')).default;
    app.use('/api/v1/auth', authRoutes);
  });

  describe('POST /api/v1/auth/login', () => {
    it('ログインエンドポイントが正しく動作すること', async () => {
      mockLogin.mockImplementation((req, res) => {
        res.status(200).json({ success: true, data: { message: 'ログイン成功' } });
      });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(mockLogin).toHaveBeenCalled();
      expect(mockAuthenticate).not.toHaveBeenCalled(); // ログインは認証不要
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: { message: 'ログイン成功' },
      });
    });

    it('認証ミドルウェアが呼ばれないこと', async () => {
      mockLogin.mockImplementation((req, res) => {
        res.status(200).json({ success: true });
      });

      await request(app).post('/api/v1/auth/login').send({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(mockAuthenticate).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('ログアウトエンドポイントが正しく動作すること', async () => {
      mockLogout.mockImplementation((req, res) => {
        res.status(200).json({ success: true, data: { message: 'ログアウト成功' } });
      });

      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', 'Bearer test-token');

      expect(mockAuthenticate).toHaveBeenCalled(); // ログアウトは認証必要
      expect(mockLogout).toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: { message: 'ログアウト成功' },
      });
    });

    it('認証ミドルウェアが呼ばれること', async () => {
      mockLogout.mockImplementation((req, res) => {
        res.status(200).json({ success: true });
      });

      await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', 'Bearer test-token');

      expect(mockAuthenticate).toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('現在のユーザー情報取得エンドポイントが正しく動作すること', async () => {
      mockGetCurrentUser.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: {
            user: {
              id: 1,
              email: 'test@example.com',
              name: 'テストユーザー',
              role: 'admin',
            },
          },
        });
      });

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer test-token');

      expect(mockAuthenticate).toHaveBeenCalled(); // 認証必要
      expect(mockGetCurrentUser).toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
    });

    it('認証ミドルウェアが呼ばれること', async () => {
      mockGetCurrentUser.mockImplementation((req, res) => {
        res.status(200).json({ success: true });
      });

      await request(app).get('/api/v1/auth/me').set('Authorization', 'Bearer test-token');

      expect(mockAuthenticate).toHaveBeenCalled();
    });
  });

  describe('PUT /api/v1/auth/password', () => {
    it('パスワード変更エンドポイントが正しく動作すること', async () => {
      mockChangePassword.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: { message: 'パスワードを変更しました' },
        });
      });

      const response = await request(app)
        .put('/api/v1/auth/password')
        .set('Authorization', 'Bearer test-token')
        .send({
          currentPassword: 'oldpassword123',
          newPassword: 'newpassword123',
        });

      expect(mockAuthenticate).toHaveBeenCalled(); // 認証必要
      expect(mockChangePassword).toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: { message: 'パスワードを変更しました' },
      });
    });

    it('認証ミドルウェアが呼ばれること', async () => {
      mockChangePassword.mockImplementation((req, res) => {
        res.status(200).json({ success: true });
      });

      await request(app)
        .put('/api/v1/auth/password')
        .set('Authorization', 'Bearer test-token')
        .send({
          currentPassword: 'oldpassword123',
          newPassword: 'newpassword123',
        });

      expect(mockAuthenticate).toHaveBeenCalled();
    });
  });

  describe('ルーティングのエラーハンドリング', () => {
    it('存在しないルートに対して404を返すこと', async () => {
      const response = await request(app).get('/api/v1/auth/nonexistent');

      expect(response.status).toBe(404);
    });
  });
});
