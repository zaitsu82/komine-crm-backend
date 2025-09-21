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
    create: jest.fn(),
  },
};

// PrismaClientをモック化
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

// 依存関数のモック
jest.mock('../../src/utils/password', () => ({
  comparePassword: jest.fn(),
  hashPassword: jest.fn(),
}));

jest.mock('../../src/utils/jwt', () => ({
  generateToken: jest.fn(),
}));

jest.mock('../../src/middleware/permission', () => ({
  checkResourceAction: jest.fn(),
  ROLES: {
    VIEWER: 'viewer',
    OPERATOR: 'operator',
    MANAGER: 'manager',
    ADMIN: 'admin',
  },
}));

import {
  login,
  getCurrentUser,
  register,
  logout,
  updatePassword,
  getPermissions,
  checkPermission,
  canResourceAction
} from '../../src/auth/authController';
import * as passwordUtils from '../../src/utils/password';
import * as jwtUtils from '../../src/utils/jwt';
import * as permissionUtils from '../../src/middleware/permission';

const mockPasswordUtils = passwordUtils as jest.Mocked<typeof passwordUtils>;
const mockJwtUtils = jwtUtils as jest.Mocked<typeof jwtUtils>;
const mockPermissionUtils = permissionUtils as jest.Mocked<typeof permissionUtils>;

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
      user: undefined,
      params: {}
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
      (mockPrisma.staff.update as jest.Mock).mockResolvedValue({ ...mockStaff, last_login_at: new Date() });
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
      expect(mockPrisma.staff.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { last_login_at: expect.any(Date) }
      });
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

    it('should return internal error when last_login_at update fails', async () => {
      mockRequest.body = {
        email: 'test@example.com',
        password: 'password123'
      };

      (mockPrisma.staff.findFirst as jest.Mock).mockResolvedValue(mockStaff);
      mockPasswordUtils.comparePassword.mockResolvedValue(true);
      (mockPrisma.staff.update as jest.Mock).mockRejectedValue(new Error('Update error'));

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

  describe('register', () => {
    it('should register successfully with valid data', async () => {
      mockRequest.body = {
        name: 'New User',
        email: 'newuser@example.com',
        password: 'password123',
        role: 'viewer'
      };

      const mockNewStaff = {
        id: 2,
        name: 'New User',
        email: 'newuser@example.com',
        role: 'viewer',
        is_active: true,
        created_at: new Date()
      };

      const mockToken = 'new-jwt-token-123';

      (mockPrisma.staff.findFirst as jest.Mock).mockResolvedValue(null);
      mockPasswordUtils.hashPassword.mockResolvedValue('hashedPassword123');
      (mockPrisma.staff.create as jest.Mock).mockResolvedValue(mockNewStaff);
      mockJwtUtils.generateToken.mockReturnValue(mockToken);

      await register(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockPrisma.staff.findFirst).toHaveBeenCalledWith({
        where: { email: 'newuser@example.com' }
      });
      expect(mockPasswordUtils.hashPassword).toHaveBeenCalledWith('password123');
      expect(mockPrisma.staff.create).toHaveBeenCalledWith({
        data: {
          name: 'New User',
          email: 'newuser@example.com',
          password: 'hashedPassword123',
          role: 'viewer',
          is_active: true
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          is_active: true,
          created_at: true
        }
      });
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          token: mockToken,
          user: {
            id: 2,
            name: 'New User',
            email: 'newuser@example.com',
            role: 'viewer',
            is_active: true
          },
          message: 'ユーザー登録が正常に完了しました'
        }
      });
    });

    it('should return validation error when name is missing', async () => {
      mockRequest.body = {
        email: 'test@example.com',
        password: 'password123'
      };

      await register(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '名前、メールアドレス、パスワードは必須です',
          details: [
            { field: 'name', message: '名前は必須です' }
          ]
        }
      });
      expect(mockPrisma.staff.findFirst).not.toHaveBeenCalled();
    });

    it('should return validation error when email is missing', async () => {
      mockRequest.body = {
        name: 'Test User',
        password: 'password123'
      };

      await register(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '名前、メールアドレス、パスワードは必須です',
          details: [
            { field: 'email', message: 'メールアドレスは必須です' }
          ]
        }
      });
    });

    it('should return validation error when password is missing', async () => {
      mockRequest.body = {
        name: 'Test User',
        email: 'test@example.com'
      };

      await register(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '名前、メールアドレス、パスワードは必須です',
          details: [
            { field: 'password', message: 'パスワードは必須です' }
          ]
        }
      });
    });

    it('should return validation error when all required fields are missing', async () => {
      mockRequest.body = {};

      await register(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '名前、メールアドレス、パスワードは必須です',
          details: [
            { field: 'name', message: '名前は必須です' },
            { field: 'email', message: 'メールアドレスは必須です' },
            { field: 'password', message: 'パスワードは必須です' }
          ]
        }
      });
    });

    it('should return validation error for invalid email format', async () => {
      mockRequest.body = {
        name: 'Test User',
        email: 'invalid-email',
        password: 'password123'
      };

      await register(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '有効なメールアドレスを入力してください',
          details: [
            { field: 'email', message: '有効なメールアドレスを入力してください' }
          ]
        }
      });
    });

    it('should return validation error for short password', async () => {
      mockRequest.body = {
        name: 'Test User',
        email: 'test@example.com',
        password: '123'
      };

      await register(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'パスワードは8文字以上で入力してください',
          details: [
            { field: 'password', message: 'パスワードは8文字以上で入力してください' }
          ]
        }
      });
    });

    it('should return conflict error when email already exists', async () => {
      mockRequest.body = {
        name: 'Test User',
        email: 'existing@example.com',
        password: 'password123'
      };

      (mockPrisma.staff.findFirst as jest.Mock).mockResolvedValue(mockStaff);

      await register(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(409);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'このメールアドレスは既に登録されています',
          details: [
            { field: 'email', message: 'このメールアドレスは既に登録されています' }
          ]
        }
      });
    });

    it('should return validation error for invalid role', async () => {
      mockRequest.body = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        role: 'invalid_role'
      };

      (mockPrisma.staff.findFirst as jest.Mock).mockResolvedValue(null);

      await register(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '無効なロールです',
          details: [
            { field: 'role', message: '有効なロール（viewer, operator, manager, admin）を指定してください' }
          ]
        }
      });
    });

    it('should default to viewer role when role is not specified', async () => {
      mockRequest.body = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
        // role not specified
      };

      const mockNewStaff = {
        id: 2,
        name: 'Test User',
        email: 'test@example.com',
        role: 'viewer',
        is_active: true,
        created_at: new Date()
      };

      (mockPrisma.staff.findFirst as jest.Mock).mockResolvedValue(null);
      mockPasswordUtils.hashPassword.mockResolvedValue('hashedPassword123');
      (mockPrisma.staff.create as jest.Mock).mockResolvedValue(mockNewStaff);
      mockJwtUtils.generateToken.mockReturnValue('token123');

      await register(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockPrisma.staff.create).toHaveBeenCalledWith({
        data: {
          name: 'Test User',
          email: 'test@example.com',
          password: 'hashedPassword123',
          role: 'viewer',
          is_active: true
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          is_active: true,
          created_at: true
        }
      });
    });

    it('should handle database error during register', async () => {
      mockRequest.body = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      };

      (mockPrisma.staff.findFirst as jest.Mock).mockRejectedValue(new Error('Database error'));

      await register(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラーが発生しました',
          details: []
        }
      });
      expect(console.error).toHaveBeenCalledWith('Register error:', expect.any(Error));
    });

    it('should handle password hashing error', async () => {
      mockRequest.body = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      };

      (mockPrisma.staff.findFirst as jest.Mock).mockResolvedValue(null);
      mockPasswordUtils.hashPassword.mockRejectedValue(new Error('Hashing error'));

      await register(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラーが発生しました',
          details: []
        }
      });
      expect(console.error).toHaveBeenCalledWith('Register error:', expect.any(Error));
    });

    it('should handle user creation error', async () => {
      mockRequest.body = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      };

      (mockPrisma.staff.findFirst as jest.Mock).mockResolvedValue(null);
      mockPasswordUtils.hashPassword.mockResolvedValue('hashedPassword123');
      (mockPrisma.staff.create as jest.Mock).mockRejectedValue(new Error('Creation error'));

      await register(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラーが発生しました',
          details: []
        }
      });
      expect(console.error).toHaveBeenCalledWith('Register error:', expect.any(Error));
    });

    it('should handle token generation error during register', async () => {
      mockRequest.body = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      };

      const mockNewStaff = {
        id: 2,
        name: 'Test User',
        email: 'test@example.com',
        role: 'viewer',
        is_active: true,
        created_at: new Date()
      };

      (mockPrisma.staff.findFirst as jest.Mock).mockResolvedValue(null);
      mockPasswordUtils.hashPassword.mockResolvedValue('hashedPassword123');
      (mockPrisma.staff.create as jest.Mock).mockResolvedValue(mockNewStaff);
      mockJwtUtils.generateToken.mockImplementation(() => {
        throw new Error('Token generation error');
      });

      await register(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラーが発生しました',
          details: []
        }
      });
      expect(console.error).toHaveBeenCalledWith('Register error:', expect.any(Error));
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      await logout(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          message: 'ログアウトが正常に完了しました'
        }
      });
    });
  });

  describe('updatePassword', () => {
    beforeEach(() => {
      mockRequest.user = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin',
        is_active: true
      };
    });

    it('should update password successfully', async () => {
      mockRequest.body = {
        currentPassword: 'oldpassword123',
        newPassword: 'newpassword123'
      };

      (mockPrisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);
      mockPasswordUtils.comparePassword.mockResolvedValue(true);
      mockPasswordUtils.hashPassword.mockResolvedValue('newHashedPassword123');
      (mockPrisma.staff.update as jest.Mock).mockResolvedValue({ ...mockStaff });

      await updatePassword(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockPrisma.staff.findUnique).toHaveBeenCalledWith({
        where: { id: 1 }
      });
      expect(mockPasswordUtils.comparePassword).toHaveBeenCalledWith('oldpassword123', 'hashedPassword123');
      expect(mockPasswordUtils.hashPassword).toHaveBeenCalledWith('newpassword123');
      expect(mockPrisma.staff.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { password: 'newHashedPassword123' }
      });
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          message: 'パスワードが正常に更新されました'
        }
      });
    });

    it('should return unauthorized when user is not authenticated', async () => {
      mockRequest.user = undefined;

      await updatePassword(mockRequest as AuthRequest, mockResponse as Response);

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

    it('should return validation error when currentPassword is missing', async () => {
      mockRequest.body = {
        newPassword: 'newpassword123'
      };

      await updatePassword(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '現在のパスワードと新しいパスワードは必須です',
          details: [
            { field: 'currentPassword', message: '現在のパスワードは必須です' }
          ]
        }
      });
    });

    it('should return validation error when newPassword is missing', async () => {
      mockRequest.body = {
        currentPassword: 'oldpassword123'
      };

      await updatePassword(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '現在のパスワードと新しいパスワードは必須です',
          details: [
            { field: 'newPassword', message: '新しいパスワードは必須です' }
          ]
        }
      });
    });

    it('should return validation error when both passwords are missing', async () => {
      mockRequest.body = {};

      await updatePassword(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '現在のパスワードと新しいパスワードは必須です',
          details: [
            { field: 'currentPassword', message: '現在のパスワードは必須です' },
            { field: 'newPassword', message: '新しいパスワードは必須です' }
          ]
        }
      });
    });

    it('should return validation error when new password is too short', async () => {
      mockRequest.body = {
        currentPassword: 'oldpassword123',
        newPassword: '123'
      };

      await updatePassword(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'パスワードは8文字以上で入力してください',
          details: [
            { field: 'newPassword', message: 'パスワードは8文字以上で入力してください' }
          ]
        }
      });
    });

    it('should return not found when user does not exist', async () => {
      mockRequest.body = {
        currentPassword: 'oldpassword123',
        newPassword: 'newpassword123'
      };

      (mockPrisma.staff.findUnique as jest.Mock).mockResolvedValue(null);

      await updatePassword(mockRequest as AuthRequest, mockResponse as Response);

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

    it('should return validation error when current password is incorrect', async () => {
      mockRequest.body = {
        currentPassword: 'wrongpassword',
        newPassword: 'newpassword123'
      };

      (mockPrisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);
      mockPasswordUtils.comparePassword.mockResolvedValue(false);

      await updatePassword(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '現在のパスワードが正しくありません',
          details: [
            { field: 'currentPassword', message: '現在のパスワードが正しくありません' }
          ]
        }
      });
    });

    it('should handle database error during password update', async () => {
      mockRequest.body = {
        currentPassword: 'oldpassword123',
        newPassword: 'newpassword123'
      };

      (mockPrisma.staff.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

      await updatePassword(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラーが発生しました',
          details: []
        }
      });
      expect(console.error).toHaveBeenCalledWith('Update password error:', expect.any(Error));
    });

    it('should handle password comparison error', async () => {
      mockRequest.body = {
        currentPassword: 'oldpassword123',
        newPassword: 'newpassword123'
      };

      (mockPrisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);
      mockPasswordUtils.comparePassword.mockRejectedValue(new Error('Comparison error'));

      await updatePassword(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラーが発生しました',
          details: []
        }
      });
      expect(console.error).toHaveBeenCalledWith('Update password error:', expect.any(Error));
    });

    it('should handle password hashing error during update', async () => {
      mockRequest.body = {
        currentPassword: 'oldpassword123',
        newPassword: 'newpassword123'
      };

      (mockPrisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);
      mockPasswordUtils.comparePassword.mockResolvedValue(true);
      mockPasswordUtils.hashPassword.mockRejectedValue(new Error('Hashing error'));

      await updatePassword(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラーが発生しました',
          details: []
        }
      });
      expect(console.error).toHaveBeenCalledWith('Update password error:', expect.any(Error));
    });

    it('should handle database update error', async () => {
      mockRequest.body = {
        currentPassword: 'oldpassword123',
        newPassword: 'newpassword123'
      };

      (mockPrisma.staff.findUnique as jest.Mock).mockResolvedValue(mockStaff);
      mockPasswordUtils.comparePassword.mockResolvedValue(true);
      mockPasswordUtils.hashPassword.mockResolvedValue('newHashedPassword123');
      (mockPrisma.staff.update as jest.Mock).mockRejectedValue(new Error('Update error'));

      await updatePassword(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラーが発生しました',
          details: []
        }
      });
      expect(console.error).toHaveBeenCalledWith('Update password error:', expect.any(Error));
    });
  });

  describe('getPermissions', () => {
    beforeEach(() => {
      mockRequest.user = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin',
        is_active: true
      };
    });

    it('should return permissions successfully for admin user', async () => {
      mockPermissionUtils.checkResourceAction.mockImplementation((role: string, resource: string, action: string) => {
        return role === 'admin'; // admin has all permissions
      });

      await getPermissions(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          user: {
            id: 1,
            name: 'Test User',
            email: 'test@example.com',
            role: 'admin'
          },
          permissions: {
            gravestone: ['read', 'create', 'update', 'delete'],
            contractor: ['read', 'create', 'update', 'delete', 'transfer'],
            applicant: ['read', 'create', 'update', 'delete'],
            master: ['read', 'create', 'update', 'delete'],
            user: ['read', 'manage'],
            system: ['admin']
          }
        }
      });
    });

    it('should return permissions successfully for viewer user', async () => {
      mockRequest.user = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'viewer',
        is_active: true
      };

      mockPermissionUtils.checkResourceAction.mockImplementation((role: string, resource: string, action: string) => {
        return role === 'viewer' && action === 'read'; // viewer can only read
      });

      await getPermissions(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          user: {
            id: 1,
            name: 'Test User',
            email: 'test@example.com',
            role: 'viewer'
          },
          permissions: {
            gravestone: ['read'],
            contractor: ['read'],
            applicant: ['read'],
            master: ['read'],
            user: ['read'],
            system: []
          }
        }
      });
    });

    it('should return unauthorized when user is not authenticated', async () => {
      mockRequest.user = undefined;

      await getPermissions(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '認証が必要です',
          details: []
        }
      });
    });

    it('should handle error during permission check', async () => {
      mockPermissionUtils.checkResourceAction.mockImplementation(() => {
        throw new Error('Permission check error');
      });

      await getPermissions(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラーが発生しました',
          details: []
        }
      });
      expect(console.error).toHaveBeenCalledWith('Get permissions error:', expect.any(Error));
    });
  });

  describe('checkPermission', () => {
    beforeEach(() => {
      mockRequest.user = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin',
        is_active: true
      };
    });

    it('should return allowed when user has permission', async () => {
      mockRequest.body = {
        resource: 'gravestone',
        action: 'read'
      };

      mockPermissionUtils.checkResourceAction.mockReturnValue(true);

      await checkPermission(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockPermissionUtils.checkResourceAction).toHaveBeenCalledWith('admin', 'gravestone', 'read');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          allowed: true,
          reason: null,
          required_role: null,
          user_role: 'admin'
        }
      });
    });

    it('should return not allowed when user lacks permission', async () => {
      mockRequest.body = {
        resource: 'system',
        action: 'admin'
      };

      mockRequest.user!.role = 'viewer';
      mockPermissionUtils.checkResourceAction.mockReturnValue(false);

      await checkPermission(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockPermissionUtils.checkResourceAction).toHaveBeenCalledWith('viewer', 'system', 'admin');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          allowed: false,
          reason: '権限が不足しています',
          required_role: 'より高い権限が必要です',
          user_role: 'viewer'
        }
      });
    });

    it('should return unauthorized when user is not authenticated', async () => {
      mockRequest.user = undefined;
      mockRequest.body = {
        resource: 'gravestone',
        action: 'read'
      };

      await checkPermission(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '認証が必要です',
          details: []
        }
      });
    });

    it('should return validation error when resource is missing', async () => {
      mockRequest.body = {
        action: 'read'
      };

      await checkPermission(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'リソースとアクションは必須です',
          details: [
            { field: 'resource', message: 'リソースは必須です' }
          ]
        }
      });
    });

    it('should return validation error when action is missing', async () => {
      mockRequest.body = {
        resource: 'gravestone'
      };

      await checkPermission(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'リソースとアクションは必須です',
          details: [
            { field: 'action', message: 'アクションは必須です' }
          ]
        }
      });
    });

    it('should return validation error when both resource and action are missing', async () => {
      mockRequest.body = {};

      await checkPermission(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'リソースとアクションは必須です',
          details: [
            { field: 'resource', message: 'リソースは必須です' },
            { field: 'action', message: 'アクションは必須です' }
          ]
        }
      });
    });

    it('should handle error during permission check', async () => {
      mockRequest.body = {
        resource: 'gravestone',
        action: 'read'
      };

      mockPermissionUtils.checkResourceAction.mockImplementation(() => {
        throw new Error('Permission check error');
      });

      await checkPermission(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラーが発生しました',
          details: []
        }
      });
      expect(console.error).toHaveBeenCalledWith('Check permission error:', expect.any(Error));
    });
  });

  describe('canResourceAction', () => {
    beforeEach(() => {
      mockRequest.user = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin',
        is_active: true
      };
    });

    it('should return allowed when user has permission via params', async () => {
      mockRequest.params = {
        resource: 'gravestone',
        action: 'read'
      };

      mockPermissionUtils.checkResourceAction.mockReturnValue(true);

      await canResourceAction(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockPermissionUtils.checkResourceAction).toHaveBeenCalledWith('admin', 'gravestone', 'read');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          allowed: true,
          reason: null,
          required_role: null,
          user_role: 'admin'
        }
      });
    });

    it('should return not allowed when user lacks permission via params', async () => {
      mockRequest.params = {
        resource: 'system',
        action: 'admin'
      };

      mockRequest.user!.role = 'viewer';
      mockPermissionUtils.checkResourceAction.mockReturnValue(false);

      await canResourceAction(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockPermissionUtils.checkResourceAction).toHaveBeenCalledWith('viewer', 'system', 'admin');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          allowed: false,
          reason: '権限が不足しています',
          required_role: 'より高い権限が必要です',
          user_role: 'viewer'
        }
      });
    });

    it('should return unauthorized when user is not authenticated', async () => {
      mockRequest.user = undefined;
      mockRequest.params = {
        resource: 'gravestone',
        action: 'read'
      };

      await canResourceAction(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '認証が必要です',
          details: []
        }
      });
    });

    it('should handle error during permission check', async () => {
      mockRequest.params = {
        resource: 'gravestone',
        action: 'read'
      };

      mockPermissionUtils.checkResourceAction.mockImplementation(() => {
        throw new Error('Permission check error');
      });

      await canResourceAction(mockRequest as AuthRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラーが発生しました',
          details: []
        }
      });
      expect(console.error).toHaveBeenCalledWith('Can resource action error:', expect.any(Error));
    });
  });
});