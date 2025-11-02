import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';

/**
 * グローバルエラーハンドラー
 * すべてのエラーをキャッチして統一されたレスポンス形式で返す
 */
export const errorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('Error occurred:', {
    message: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
  });

  // Prismaエラーの処理
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return handlePrismaError(error, res);
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'データベースバリデーションエラー',
        details: [{ message: error.message }],
      },
    });
  }

  // カスタムエラーの処理
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: error.message || 'バリデーションエラーが発生しました',
        details: error.details || [],
      },
    });
  }

  if (error.name === 'UnauthorizedError') {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: error.message || '認証が必要です',
        details: [],
      },
    });
  }

  if (error.name === 'ForbiddenError') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: error.message || '権限が不足しています',
        details: [],
      },
    });
  }

  if (error.name === 'NotFoundError') {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: error.message || 'リソースが見つかりません',
        details: [],
      },
    });
  }

  if (error.name === 'ConflictError') {
    return res.status(409).json({
      success: false,
      error: {
        code: 'CONFLICT',
        message: error.message || '競合が発生しました',
        details: error.details || [],
      },
    });
  }

  // デフォルトのエラーレスポンス
  return res.status(error.status || 500).json({
    success: false,
    error: {
      code: error.code || 'INTERNAL_SERVER_ERROR',
      message: error.message || '内部サーバーエラーが発生しました',
      details: [],
    },
  });
};

/**
 * Prismaエラーハンドラー
 */
const handlePrismaError = (error: Prisma.PrismaClientKnownRequestError, res: Response) => {
  switch (error.code) {
    case 'P2002':
      // Unique constraint violation
      const target = error.meta?.target as string[];
      return res.status(409).json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: '重複するデータが存在します',
          details: [
            {
              field: target?.join(', '),
              message: `${target?.join(', ')} は既に使用されています`,
            },
          ],
        },
      });

    case 'P2025':
      // Record not found
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'レコードが見つかりません',
          details: [],
        },
      });

    case 'P2003':
      // Foreign key constraint violation
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '関連するデータが存在しません',
          details: [{ message: error.message }],
        },
      });

    case 'P2014':
      // Relation violation
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'リレーションの制約違反',
          details: [{ message: error.message }],
        },
      });

    default:
      return res.status(500).json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'データベースエラーが発生しました',
          details: [{ message: error.message }],
        },
      });
  }
};

/**
 * 404エラーハンドラー
 * ルートが見つからない場合に実行される
 */
export const notFoundHandler = (req: Request, res: Response) => {
  return res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `ルート ${req.method} ${req.path} が見つかりません`,
      details: [],
    },
  });
};

/**
 * カスタムエラークラス
 */
export class ValidationError extends Error {
  details: any[];

  constructor(message: string, details: any[] = []) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

export class UnauthorizedError extends Error {
  constructor(message: string = '認証が必要です') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  constructor(message: string = '権限が不足しています') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string = 'リソースが見つかりません') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  details: any[];

  constructor(message: string, details: any[] = []) {
    super(message);
    this.name = 'ConflictError';
    this.details = details;
  }
}
