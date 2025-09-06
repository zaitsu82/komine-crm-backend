import { Request, Response, NextFunction } from 'express';

// モックプリズマインスタンスの作成
const mockPrisma = {
  staff: {
    findUnique: jest.fn(),
  },
};

// PrismaClientをモック化
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

// JWT関数をモック化
jest.mock('../../src/utils/jwt');

import { authenticate, optionalAuthenticate } from '../../src/middleware/auth';
import * as jwtUtils from '../../src/utils/jwt';

const mockedJwtUtils = jwtUtils as jest.Mocked<typeof jwtUtils>;

describe('Auth Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;

  const mockUser = {
    id: 1,
    name: 'Test User',
    email: 'test@example.com',
    isActive: true
  };

  const mockDecodedToken = {
    id: 1,
    email: 'test@example.com',
    name: 'Test User'
  };

  beforeEach(() => {
    mockRequest = {
      headers: {},
      user: undefined
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('authenticate', () => {
    it('should authenticate successfully with valid token', async () => {
      mockRequest.headers = {
        authorization: 'Bearer validtoken'
      };

      mockedJwtUtils.extractTokenFromHeader.mockReturnValue('validtoken');
      mockedJwtUtils.verifyToken.mockReturnValue(mockDecodedToken);
      (mockPrisma.staff.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockedJwtUtils.extractTokenFromHeader).toHaveBeenCalledWith('Bearer validtoken');
      expect(mockedJwtUtils.verifyToken).toHaveBeenCalledWith('validtoken');
      expect(mockPrisma.staff.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true
        }
      });
      expect(mockRequest.user).toEqual({
        id: 1,
        email: 'test@example.com',
        name: 'Test User'
      });
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should return 401 when authorization header is missing', async () => {
      mockRequest.headers = {};

      mockedJwtUtils.extractTokenFromHeader.mockImplementation(() => {
        throw new Error('Authorization header is required');
      });

      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '認証ヘッダーが必要です',
          details: []
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when authorization header format is invalid', async () => {
      mockRequest.headers = {
        authorization: 'InvalidFormat token'
      };

      mockedJwtUtils.extractTokenFromHeader.mockImplementation(() => {
        throw new Error('Invalid authorization header format');
      });

      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '認証ヘッダーの形式が正しくありません',
          details: []
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when token is invalid', async () => {
      mockRequest.headers = {
        authorization: 'Bearer invalidtoken'
      };

      mockedJwtUtils.extractTokenFromHeader.mockReturnValue('invalidtoken');
      mockedJwtUtils.verifyToken.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '無効なトークンです',
          details: []
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when user does not exist', async () => {
      mockRequest.headers = {
        authorization: 'Bearer validtoken'
      };

      mockedJwtUtils.extractTokenFromHeader.mockReturnValue('validtoken');
      mockedJwtUtils.verifyToken.mockReturnValue(mockDecodedToken);
      (mockPrisma.staff.findUnique as jest.Mock).mockResolvedValue(null);

      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'ユーザーが存在しないか、無効になっています',
          details: []
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when user is not active', async () => {
      mockRequest.headers = {
        authorization: 'Bearer validtoken'
      };

      const inactiveUser = { ...mockUser, isActive: false };

      mockedJwtUtils.extractTokenFromHeader.mockReturnValue('validtoken');
      mockedJwtUtils.verifyToken.mockReturnValue(mockDecodedToken);
      (mockPrisma.staff.findUnique as jest.Mock).mockResolvedValue(inactiveUser);

      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'ユーザーが存在しないか、無効になっています',
          details: []
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when database query fails', async () => {
      mockRequest.headers = {
        authorization: 'Bearer validtoken'
      };

      mockedJwtUtils.extractTokenFromHeader.mockReturnValue('validtoken');
      mockedJwtUtils.verifyToken.mockReturnValue(mockDecodedToken);
      (mockPrisma.staff.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '認証に失敗しました',
          details: []
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when non-Error is thrown', async () => {
      mockRequest.headers = {
        authorization: 'Bearer validtoken'
      };

      mockedJwtUtils.extractTokenFromHeader.mockImplementation(() => {
        throw 'Some string error';
      });

      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '認証に失敗しました',
          details: []
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuthenticate', () => {
    it('should authenticate successfully with valid token', async () => {
      mockRequest.headers = {
        authorization: 'Bearer validtoken'
      };

      mockedJwtUtils.extractTokenFromHeader.mockReturnValue('validtoken');
      mockedJwtUtils.verifyToken.mockReturnValue(mockDecodedToken);
      (mockPrisma.staff.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await optionalAuthenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toEqual({
        id: 1,
        email: 'test@example.com',
        name: 'Test User'
      });
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should continue without authentication when no auth header', async () => {
      mockRequest.headers = {};

      await optionalAuthenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should continue without authentication when user is not found', async () => {
      mockRequest.headers = {
        authorization: 'Bearer validtoken'
      };

      mockedJwtUtils.extractTokenFromHeader.mockReturnValue('validtoken');
      mockedJwtUtils.verifyToken.mockReturnValue(mockDecodedToken);
      (mockPrisma.staff.findUnique as jest.Mock).mockResolvedValue(null);

      await optionalAuthenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should continue without authentication when user is not active', async () => {
      mockRequest.headers = {
        authorization: 'Bearer validtoken'
      };

      const inactiveUser = { ...mockUser, isActive: false };

      mockedJwtUtils.extractTokenFromHeader.mockReturnValue('validtoken');
      mockedJwtUtils.verifyToken.mockReturnValue(mockDecodedToken);
      (mockPrisma.staff.findUnique as jest.Mock).mockResolvedValue(inactiveUser);

      await optionalAuthenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should continue without authentication when token extraction fails', async () => {
      mockRequest.headers = {
        authorization: 'InvalidFormat token'
      };

      mockedJwtUtils.extractTokenFromHeader.mockImplementation(() => {
        throw new Error('Invalid authorization header format');
      });

      await optionalAuthenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should continue without authentication when token verification fails', async () => {
      mockRequest.headers = {
        authorization: 'Bearer invalidtoken'
      };

      mockedJwtUtils.extractTokenFromHeader.mockReturnValue('invalidtoken');
      mockedJwtUtils.verifyToken.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await optionalAuthenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should continue without authentication when database query fails', async () => {
      mockRequest.headers = {
        authorization: 'Bearer validtoken'
      };

      mockedJwtUtils.extractTokenFromHeader.mockReturnValue('validtoken');
      mockedJwtUtils.verifyToken.mockReturnValue(mockDecodedToken);
      (mockPrisma.staff.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

      await optionalAuthenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });
});