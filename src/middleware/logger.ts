import { Request, Response, NextFunction } from 'express';
import { getRequestLogger } from '../utils/logger';

/**
 * リクエストログミドルウェア
 * すべてのHTTPリクエストを構造化ログとして記録
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();

  // レスポンス完了時にログを出力
  res.on('finish', () => {
    const log = getRequestLogger();
    const duration = Date.now() - startTime;
    const logData = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.socket.remoteAddress,
      user: req.user ? `${req.user.name} (${req.user.email})` : 'anonymous',
    };

    // ステータスコードに応じてログレベルを変更
    if (res.statusCode >= 500) {
      log.error(logData, 'HTTP request completed with server error');
    } else if (res.statusCode >= 400) {
      log.warn(logData, 'HTTP request completed with client error');
    } else {
      log.info(logData, 'HTTP request completed');
    }
  });

  next();
};

/**
 * セキュリティヘッダーミドルウェア
 * セキュリティ関連のHTTPヘッダーを設定
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // X-Content-Type-Options
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // X-Frame-Options
  res.setHeader('X-Frame-Options', 'DENY');

  // X-XSS-Protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Strict-Transport-Security (HTTPSの場合のみ)
  if (req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
};
