import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger, loggerStorage } from '../utils/logger';

/**
 * リクエストIDミドルウェア
 *
 * - リクエストごとにUUIDを生成
 * - AsyncLocalStorage にリクエストスコープの child logger を格納
 * - レスポンスヘッダー X-Request-Id に出力
 */
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();

  res.setHeader('X-Request-Id', requestId);

  const childLogger = logger.child({ requestId });

  loggerStorage.run(childLogger, () => {
    next();
  });
};
