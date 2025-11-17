import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import hpp from 'hpp';
import { CorsOptions } from 'cors';

/**
 * CORS設定
 * 環境変数からオリジンを読み込み、厳格なCORS制御を実装
 */
export const getCorsOptions = (): CorsOptions => {
  const allowedOrigins = process.env['ALLOWED_ORIGINS']
    ? process.env['ALLOWED_ORIGINS'].split(',').map((origin) => origin.trim())
    : [];

  // 開発環境では全許可、本番環境では環境変数で指定されたオリジンのみ許可
  if (process.env['NODE_ENV'] === 'development' && allowedOrigins.length === 0) {
    return {
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposedHeaders: ['Content-Range', 'X-Content-Range'],
      maxAge: 86400, // 24時間
    };
  }

  return {
    origin: (origin, callback) => {
      // オリジンが指定されていない場合（サーバー間通信など）は許可
      if (!origin) {
        return callback(null, true);
      }

      // 許可リストに含まれているか確認
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`CORS blocked: ${origin} is not in the allowed origins list`);
        callback(new Error('CORS policy violation: Origin not allowed'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 86400, // 24時間
  };
};

/**
 * Rate Limiting設定
 * DDoS攻撃対策として、IPアドレスごとのリクエスト数を制限
 */
export const createRateLimiter = () => {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15分
    max: 100, // 15分間に100リクエストまで
    message: {
      success: false,
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'リクエストが多すぎます。しばらく待ってから再試行してください。',
        details: [],
      },
    },
    standardHeaders: true, // `RateLimit-*` ヘッダーを返す
    legacyHeaders: false, // `X-RateLimit-*` ヘッダーを無効化
    // デフォルトのkeyGeneratorを使用（IPv6対応済み）
  });
};

/**
 * 認証エンドポイント用の厳格なRate Limiting
 * ブルートフォース攻撃対策
 */
export const createAuthRateLimiter = () => {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15分
    max: 5, // 15分間に5リクエストまで
    message: {
      success: false,
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: '認証試行回数が多すぎます。15分後に再試行してください。',
        details: [],
      },
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // 成功したリクエストはカウントしない
    // デフォルトのkeyGeneratorを使用（IPv6対応済み）
  });
};

/**
 * Helmet設定
 * セキュリティヘッダーを設定してXSS、クリックジャッキング等を防止
 */
export const getHelmetOptions = () => {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: 'same-site' },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: {
      maxAge: 31536000, // 1年
      includeSubDomains: true,
      preload: true,
    },
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true,
  });
};

/**
 * HTTP Parameter Pollution (HPP) 対策
 * 重複したクエリパラメータやボディパラメータを防止
 */
export const hppProtection = hpp();

/**
 * 入力サニタイゼーションミドルウェア
 * XSS攻撃を防ぐため、危険な文字をエスケープ
 */
export const sanitizeInput = (req: Request, _res: Response, next: NextFunction) => {
  // リクエストボディのサニタイゼーション
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  // クエリパラメータのサニタイゼーション
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  next();
};

/**
 * オブジェクト内の文字列を再帰的にサニタイゼーション
 */
const sanitizeObject = (obj: any): any => {
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item));
  }

  if (obj !== null && typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }

  return obj;
};

/**
 * 文字列のサニタイゼーション
 * XSS攻撃に使用される可能性のある文字をエスケープ
 */
const sanitizeString = (str: string): string => {
  if (typeof str !== 'string') {
    return str;
  }

  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};
