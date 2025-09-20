import { Request, Response } from 'express';

// ユーザー情報を含むRequest型の拡張
interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    name: string;
    role: string;
    is_active: boolean;
  };
}

// モックプリズマインスタンスの作成
const mockPrisma = {
  staff: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

// PrismaClientをモック化
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

// 依存関数のモック
jest.mock('../../src/utils/password', () => ({
  comparePassword: jest.fn(),
}));

jest.mock('../../src/utils/jwt', () => ({
  generateToken: jest.fn(),
}));

import { login, getCurrentUser } from '../../src/auth/authController';
import * as passwordUtils from '../../src/utils/password';
import * as jwtUtils from '../../src/utils/jwt';

const mockPasswordUtils = passwordUtils as jest.Mocked<typeof passwordUtils>;
const mockJwtUtils = jwtUtils as jest.Mocked<typeof jwtUtils>;

describe('Auth Controller', () => {
  let mockRequest: Partial<AuthRequest>;
  let mockResponse: Partial<Response>;

  const mockStaff = {
    id: 1,
    name: 'Test User',
    email: 'test@example.com',
    password: 'hashedPassword123',
    role: 'admin',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
    last_login_at: new Date()
  };

  beforeEach(() => {
    mockRequest = {
      body: {},
      user: undefined
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    jest.clearAllMocks();

    // console.errorをモック化してログ出力を抑制
    jest.spyOn(console, 'error').mockImplementation(() => { });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      mockRequest.body = {
        email: 'test@example.com',
        password: 'password123'
      };

      const mockToken = 'jwt-token-123';

      (mockPrisma.staff.findFirst as jest.Mock).mockResolvedValue(mockStaff);
      mockPasswordUtils.comparePassword.mockResolvedValue(true);
      mockJwtUtils.generateToken.mockReturnValue(mockToken);

      await login(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockPrisma.staff.findFirst).toHaveBeenCalledWith({
        where: {
          email: 'test@example.com',
          is_active: true
        }
      });
      expect(mockPasswordUtils.comparePassword).toHaveBeenCalledWith('password123', 'hashedPassword123');
      expect(mockJwtUtils.generateToken).toHaveBeenCalledWith({
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin'
      });
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          token: mockToken,
          user: {
            id: 1,
            name: 'Test User',
            email: 'test@example.com',
            role: 'admin',
            is_active: true
          },
          message: 'ログインが正常に完了しました'
        }
      });
    });

    it('should return validation error when email is missing', async () => {
      mockRequest.body = {
        password: 'password123'
      };

      await login(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'メールアドレスとパスワードは必須です',
          details: [
            { field: 'email', message: 'メールアドレスは必須です' }
          ]
        }
      });
      expect(mockPrisma.staff.findFirst).not.toHaveBeenCalled();
    });

    it('should return validation error when password is missing', async () => {
      mockRequest.body = {
        email: 'test@example.com'
      };

      await login(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'メールアドレスとパスワードは必須です',
          details: [
            { field: 'password', message: 'パスワードは必須です' }
          ]
        }
      });
      expect(mockPrisma.staff.findFirst).not.toHaveBeenCalled();
    });

    it('should return validation error when both email and password are missing', async () => {
      mockRequest.body = {};

      await login(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'メールアドレスとパスワードは必須です',
          details: [
            { field: 'email', message: 'メールアドレスは必須です' },
            { field: 'password', message: 'パスワードは必須です' }
          ]
        }
      });
      expect(mockPrisma.staff.findFirst).not.toHaveBeenCalled();
    });

    it('should return unauthorized when user not found', async () => {
      mockRequest.body = {
        email: 'nonexistent@example.com',
        password: 'password123'
      };

      (mockPrisma.staff.findFirst as jest.Mock).mockResolvedValue(null);

      await login(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'メールアドレスまたはパスワードが正しくありません',
          details: []
        }
      });
      expect(mockPasswordUtils.comparePassword).not.toHaveBeenCalled();
    });

    it('should return unauthorized when password is incorrect', async () => {
      mockRequest.body = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      (mockPrisma.staff.findFirst as jest.Mock).mockResolvedValue(mockStaff);
      mockPasswordUtils.comparePassword.mockResolvedValue(false);

      await login(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'メールアドレスまたはパスワードが正しくありません',
          details: []
        }
      });
      expect(mockJwtUtils.generateToken).not.toHaveBeenCalled();
    });

    it('should return internal error when database query fails', async () => {
      mockRequest.body = {
        email: 'test@example.com',
        password: 'password123'
      };

      (mockPrisma.staff.findFirst as jest.Mock).mockRejectedValue(new Error('Database error'));

      await login(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラーが発生しました',
          details: []
        }
      });
      expect(console.error).toHaveBeenCalledWith('Login error:', expect.any(Error));
    });

    it('should return internal error when password comparison fails', async () => {
      mockRequest.body = {
        email: 'test@example.com',
        password: 'password123'
      };

      (mockPrisma.staff.findFirst as jest.Mock).mockResolvedValue(mockStaff);
      mockPasswordUtils.comparePassword.mockRejectedValue(new Error('Password comparison error'));

      await login(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラーが発生しました',
          details: []
        }
      });
      expect(console.error).toHaveBeenCalledWith('Login error:', expect.any(Error));
    });

    it('should return internal error when token generation fails', async () => {
      mockRequest.body = {
        email: 'test@example.com',
        password: 'password123'
      };

      (mockPrisma.staff.findFirst as jest.Mock).mockResolvedValue(mockStaff);
      mockPasswordUtils.comparePassword.mockResolvedValue(true);
      mockJwtUtils.generateToken.mockImplementation(() => {
        throw new Error('Token generation error');
      });

      await login(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラーが発生しました',
          details: []
        }
      });
      expect(console.error).toHaveBeenCalledWith('Login error:', expect.any(Error));
    });
  });

  describe('getCurrentUser', () => {
    it('should return current user successfully', async () => {
      mockRequest.user = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin',
        is_active: true
      };

      const userResponse = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        role: 'admin',
        is_active: true,
        last_login_at: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      };

      (mockPrisma.staff.findUnique as jest.Mock).mockResolvedValue(userResponse);

      await getCurrentUser(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockPrisma.staff.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          is_active: true,
          last_login_at: true,
          created_at: true,
          updated_at: true
        }
      });
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          user: userResponse
        }
      });
    });

    it('should return unauthorized when user is not authenticated', async () => {
      mockRequest.user = undefined;

      await getCurrentUser(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '認証が必要です',
          details: []
        }
      });
      expect(mockPrisma.staff.findUnique).not.toHaveBeenCalled();
    });

    it('should return not found when user does not exist in database', async () => {
      mockRequest.user = {
        id: 999,
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin',
        is_active: true
      };

      (mockPrisma.staff.findUnique as jest.Mock).mockResolvedValue(null);

      await getCurrentUser(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'ユーザーが見つかりません',
          details: []
        }
      });
    });

    it('should return not found when user is inactive', async () => {
      mockRequest.user = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin',
        is_active: true
      };

      const inactiveUser = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        role: 'admin',
        is_active: false,
        last_login_at: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      };

      (mockPrisma.staff.findUnique as jest.Mock).mockResolvedValue(inactiveUser);

      await getCurrentUser(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'ユーザーが見つかりません',
          details: []
        }
      });
    });

    it('should return internal error when database query fails', async () => {
      // userオブジェクトをmockRequestに直接設定
      mockRequest.user = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin',
        is_active: true
      };

      (mockPrisma.staff.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

      await getCurrentUser(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラーが発生しました',
          details: []
        }
      });
      expect(console.error).toHaveBeenCalledWith('Get current user error:', expect.any(Error));
    });
  });
});