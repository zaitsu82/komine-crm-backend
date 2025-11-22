import { Request, Response, NextFunction } from 'express';
// Import actual Prisma error classes, not mocked ones
const { Prisma } = jest.requireActual('@prisma/client');
import {
  errorHandler,
  notFoundHandler,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from '../../src/middleware/errorHandler';

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

// Don't mock @prisma/client for this test file
jest.unmock('@prisma/client');

// Mock Sentry
jest.mock('@sentry/node', () => ({
  withScope: jest.fn((callback) => {
    const mockScope = {
      setUser: jest.fn(),
      setContext: jest.fn(),
      setLevel: jest.fn(),
      setTag: jest.fn(),
    };
    callback(mockScope);
  }),
  captureException: jest.fn(),
}));

describe('Error Handler Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    mockRequest = {
      path: '/test',
      method: 'GET',
      url: '/test',
      query: {},
      get: jest.fn((header: string): string | string[] | undefined => {
        if (header === 'user-agent') return 'test-agent';
        if (header === 'content-type') return 'application/json';
        if (header === 'set-cookie') return [];
        return undefined;
      }) as any,
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('errorHandler', () => {
    describe('Prismaエラー処理', () => {
      it('P2002（重複エラー）を正しく処理すること', () => {
        const error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '5.0.0',
          meta: { target: ['email'] },
        });

        errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockResponse.status).toHaveBeenCalledWith(409);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'CONFLICT',
            message: '重複するデータが存在します',
            details: [
              {
                field: 'email',
                message: 'email は既に使用されています',
              },
            ],
          },
        });
      });

      it('P2025（レコードが見つからない）を正しく処理すること', () => {
        const error = new Prisma.PrismaClientKnownRequestError('Record not found', {
          code: 'P2025',
          clientVersion: '5.0.0',
        });

        errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockResponse.status).toHaveBeenCalledWith(404);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'レコードが見つかりません',
            details: [],
          },
        });
      });

      it('P2003（外部キー制約違反）を正しく処理すること', () => {
        const error = new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
          code: 'P2003',
          clientVersion: '5.0.0',
        });

        errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '関連するデータが存在しません',
            details: [{ message: error.message }],
          },
        });
      });

      it('P2014（リレーション制約違反）を正しく処理すること', () => {
        const error = new Prisma.PrismaClientKnownRequestError('Relation violation', {
          code: 'P2014',
          clientVersion: '5.0.0',
        });

        errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'リレーションの制約違反',
            details: [{ message: error.message }],
          },
        });
      });

      it('その他のPrismaエラーを正しく処理すること', () => {
        const error = new Prisma.PrismaClientKnownRequestError('Unknown error', {
          code: 'P9999',
          clientVersion: '5.0.0',
        });

        errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'データベースエラーが発生しました',
            details: [{ message: error.message }],
          },
        });
      });

      it('PrismaClientValidationErrorを正しく処理すること', () => {
        const error = new Prisma.PrismaClientValidationError('Validation failed', {
          clientVersion: '5.0.0',
        });

        errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'データベースバリデーションエラー',
            details: [{ message: error.message }],
          },
        });
      });
    });

    describe('カスタムエラー処理', () => {
      it('ValidationErrorを正しく処理すること', () => {
        const error = new ValidationError('バリデーションエラー', [
          { field: 'email', message: '無効なメールアドレス' },
        ]);

        errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'バリデーションエラー',
            details: [{ field: 'email', message: '無効なメールアドレス' }],
          },
        });
      });

      it('UnauthorizedErrorを正しく処理すること', () => {
        const error = new UnauthorizedError('認証が必要です');

        errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

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

      it('ForbiddenErrorを正しく処理すること', () => {
        const error = new ForbiddenError('権限が不足しています');

        errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockResponse.status).toHaveBeenCalledWith(403);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: '権限が不足しています',
            details: [],
          },
        });
      });

      it('NotFoundErrorを正しく処理すること', () => {
        const error = new NotFoundError('リソースが見つかりません');

        errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockResponse.status).toHaveBeenCalledWith(404);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'リソースが見つかりません',
            details: [],
          },
        });
      });

      it('ConflictErrorを正しく処理すること', () => {
        const error = new ConflictError('競合が発生しました', [
          { field: 'id', message: '既に存在します' },
        ]);

        errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockResponse.status).toHaveBeenCalledWith(409);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'CONFLICT',
            message: '競合が発生しました',
            details: [{ field: 'id', message: '既に存在します' }],
          },
        });
      });

      it('ValidationErrorのデフォルトメッセージを使用すること', () => {
        const error: any = { name: 'ValidationError' };

        errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'バリデーションエラーが発生しました',
            details: [],
          },
        });
      });

      it('UnauthorizedErrorのデフォルトメッセージを使用すること', () => {
        const error: any = { name: 'UnauthorizedError' };

        errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

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

      it('ForbiddenErrorのデフォルトメッセージを使用すること', () => {
        const error: any = { name: 'ForbiddenError' };

        errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockResponse.status).toHaveBeenCalledWith(403);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: '権限が不足しています',
            details: [],
          },
        });
      });

      it('NotFoundErrorのデフォルトメッセージを使用すること', () => {
        const error: any = { name: 'NotFoundError' };

        errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockResponse.status).toHaveBeenCalledWith(404);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'リソースが見つかりません',
            details: [],
          },
        });
      });

      it('ConflictErrorのデフォルトメッセージを使用すること', () => {
        const error: any = { name: 'ConflictError' };

        errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockResponse.status).toHaveBeenCalledWith(409);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'CONFLICT',
            message: '競合が発生しました',
            details: [],
          },
        });
      });
    });

    describe('デフォルトエラー処理', () => {
      it('一般的なエラーを正しく処理すること', () => {
        const error = new Error('予期しないエラー');

        errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: '予期しないエラー',
            details: [],
          },
        });
      });

      it('カスタムステータスコードを持つエラーを正しく処理すること', () => {
        const error: any = new Error('カスタムエラー');
        error.status = 418;
        error.code = 'TEAPOT';

        errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockResponse.status).toHaveBeenCalledWith(418);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'TEAPOT',
            message: 'カスタムエラー',
            details: [],
          },
        });
      });

      it('エラーをコンソールに記録すること', () => {
        const error = new Error('テストエラー');

        errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Error occurred:',
          expect.objectContaining({
            message: 'テストエラー',
            path: '/test',
            method: 'GET',
          })
        );
      });

      it('メッセージのないエラーでデフォルトメッセージを使用すること', () => {
        const error: any = {};

        errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: '内部サーバーエラーが発生しました',
            details: [],
          },
        });
      });
    });
  });

  describe('notFoundHandler', () => {
    it('404レスポンスを返すこと', () => {
      const testRequest: any = {
        method: 'POST',
        path: '/api/nonexistent',
      };

      notFoundHandler(testRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'ルート POST /api/nonexistent が見つかりません',
          details: [],
        },
      });
    });
  });

  describe('カスタムエラークラス', () => {
    it('ValidationErrorがdetailsを持つこと', () => {
      const details = [{ field: 'name', message: '必須です' }];
      const error = new ValidationError('テストエラー', details);

      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('テストエラー');
      expect(error.details).toEqual(details);
    });

    it('ValidationErrorがdetailsなしで作成できること', () => {
      const error = new ValidationError('テストエラー');

      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('テストエラー');
      expect(error.details).toEqual([]);
    });

    it('UnauthorizedErrorがデフォルトメッセージを持つこと', () => {
      const error = new UnauthorizedError();

      expect(error.name).toBe('UnauthorizedError');
      expect(error.message).toBe('認証が必要です');
    });

    it('UnauthorizedErrorがカスタムメッセージを持つこと', () => {
      const error = new UnauthorizedError('カスタムメッセージ');

      expect(error.name).toBe('UnauthorizedError');
      expect(error.message).toBe('カスタムメッセージ');
    });

    it('ForbiddenErrorがデフォルトメッセージを持つこと', () => {
      const error = new ForbiddenError();

      expect(error.name).toBe('ForbiddenError');
      expect(error.message).toBe('権限が不足しています');
    });

    it('ForbiddenErrorがカスタムメッセージを持つこと', () => {
      const error = new ForbiddenError('カスタムメッセージ');

      expect(error.name).toBe('ForbiddenError');
      expect(error.message).toBe('カスタムメッセージ');
    });

    it('NotFoundErrorがデフォルトメッセージを持つこと', () => {
      const error = new NotFoundError();

      expect(error.name).toBe('NotFoundError');
      expect(error.message).toBe('リソースが見つかりません');
    });

    it('NotFoundErrorがカスタムメッセージを持つこと', () => {
      const error = new NotFoundError('カスタムメッセージ');

      expect(error.name).toBe('NotFoundError');
      expect(error.message).toBe('カスタムメッセージ');
    });

    it('ConflictErrorがdetailsを持つこと', () => {
      const details = [{ field: 'id', message: '既に存在します' }];
      const error = new ConflictError('テストエラー', details);

      expect(error.name).toBe('ConflictError');
      expect(error.message).toBe('テストエラー');
      expect(error.details).toEqual(details);
    });

    it('ConflictErrorがdetailsなしで作成できること', () => {
      const error = new ConflictError('テストエラー');

      expect(error.name).toBe('ConflictError');
      expect(error.message).toBe('テストエラー');
      expect(error.details).toEqual([]);
    });
  });
});
