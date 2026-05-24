import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import * as Sentry from '@sentry/node';
import { getRequestLogger } from '../utils/logger';

/**
 * グローバルエラーハンドラー
 * すべてのエラーをキャッチして統一されたレスポンス形式で返す
 */
export const errorHandler = (error: any, req: Request, res: Response, _next: NextFunction) => {
  const log = getRequestLogger();
  log.error(
    {
      err: error,
      path: req.path,
      method: req.method,
      query: req.query,
      ...(error instanceof Prisma.PrismaClientKnownRequestError
        ? { prismaCode: error.code, prismaMeta: error.meta }
        : {}),
    },
    'Unhandled error'
  );

  // Sentryにエラーを送信（ユーザー情報とリクエスト情報を含む）
  Sentry.withScope((scope) => {
    // ユーザー情報の追加（認証済みの場合）
    if (req.user) {
      scope.setUser({
        id: req.user.id.toString(),
        email: req.user.email,
        username: req.user.name,
        role: req.user.role,
      });
    }

    // リクエスト情報の追加
    scope.setContext('request', {
      method: req.method,
      url: req.url,
      path: req.path,
      query: req.query,
      headers: {
        'user-agent': req.get('user-agent'),
        'content-type': req.get('content-type'),
      },
    });

    // エラータイプに応じたレベル設定
    if (error.name === 'ValidationError' || error.name === 'NotFoundError') {
      scope.setLevel('warning');
    } else if (error.status && error.status < 500) {
      scope.setLevel('info');
    } else {
      scope.setLevel('error');
    }

    // エラーコードのタグ追加
    if (error.code) {
      scope.setTag('error_code', error.code);
    }

    // Prismaエラーコードのタグ追加
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      scope.setTag('prisma_code', error.code);
    }

    Sentry.captureException(error);
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
 * P2002 (unique 制約違反) の field 名を抽出する。
 * Prisma v6 までは meta.target に入っていたが、v7 + @prisma/adapter-pg では
 * meta.driverAdapterError.cause.constraint.fields に入る。どちらも取れない
 * 場合は error.message ("Unique constraint failed on the fields: (`xxx`)")
 * を正規表現でパースしてフォールバックする。
 */
const extractP2002Fields = (error: Prisma.PrismaClientKnownRequestError): string[] => {
  const meta = error.meta as Record<string, unknown> | undefined;

  const target = meta?.['target'];
  if (Array.isArray(target)) return target.filter((f): f is string => typeof f === 'string');
  if (typeof target === 'string')
    return target
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

  const driverAdapterError = meta?.['driverAdapterError'] as
    | { cause?: { constraint?: { fields?: unknown } } }
    | undefined;
  const adapterFields = driverAdapterError?.cause?.constraint?.fields;
  if (Array.isArray(adapterFields)) {
    const fields = adapterFields.filter((f): f is string => typeof f === 'string');
    if (fields.length > 0) return fields;
  }

  const match = error.message.match(/fields:\s*\(([^)]+)\)/);
  if (match) {
    return match[1]
      .split(',')
      .map((s) => s.trim().replace(/^`|`$/g, ''))
      .filter(Boolean);
  }

  return [];
};

const FIELD_LABEL_MAP: Record<string, string> = {
  plot_number: '区画番号',
  email: 'メールアドレス',
  supabase_uid: 'Supabaseユーザー',
  contract_plot_id: '契約区画',
  customer_id: '顧客',
  code: 'コード',
};

const toFieldLabel = (field: string): string => FIELD_LABEL_MAP[field] ?? field;

/**
 * Prismaエラーハンドラー
 */
const handlePrismaError = (error: Prisma.PrismaClientKnownRequestError, res: Response) => {
  switch (error.code) {
    case 'P2002': {
      const fields = extractP2002Fields(error);
      const fieldKey = fields.join(', ');
      const fieldLabel = fields.length > 0 ? fields.map(toFieldLabel).join(', ') : 'データ';
      return res.status(409).json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: '重複するデータが存在します',
          details: [
            {
              field: fieldKey || undefined,
              message: `${fieldLabel} は既に使用されています`,
            },
          ],
        },
      });
    }

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
