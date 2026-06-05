import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import hpp from 'hpp';
import { CorsOptions } from 'cors';
import { logger } from '../utils/logger';

// 開発環境で許可するオリジンパターン
// - localhost/127.0.0.1 の任意のポート
// - ローカルネットワーク (192.168.x.x, 10.x.x.x)
const DEV_ORIGIN_PATTERN =
  /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?$/;

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
        return callback(null, true);
      }

      // 開発環境: localhost/127.0.0.1 を許可（ブラウザの表記ゆれ対策）
      if (process.env['NODE_ENV'] === 'development' && DEV_ORIGIN_PATTERN.test(origin)) {
        return callback(null, true);
      }

      logger.warn({ origin }, 'CORS blocked: origin not in allowed list');
      callback(new Error('CORS policy violation: Origin not allowed'));
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
  const isTest = process.env['NODE_ENV'] === 'test' || process.env['E2E_TEST'] === 'true';
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15分
    max: isTest ? 10000 : 100, // テスト環境では実質無制限
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
    // ボディパーサより前に適用するため（#226）、/health は明示的に除外する
    // （Render等のヘルスチェックが429で失敗するのを防止）
    skip: (req) => req.path === '/health',
    // デフォルトのkeyGeneratorを使用（IPv6対応済み）
  });
};

/**
 * 認証エンドポイント用の厳格なRate Limiting
 * ブルートフォース攻撃対策
 */
export const createAuthRateLimiter = () => {
  const isTest = process.env['NODE_ENV'] === 'test' || process.env['E2E_TEST'] === 'true';
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15分
    max: isTest ? 10000 : 5, // テスト環境では実質無制限
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
 * パスワードリセットリクエスト用のRate Limiting
 * メール列挙攻撃対策として厳格に制限
 */
export const createForgotPasswordRateLimiter = () => {
  const isTest = process.env['NODE_ENV'] === 'test' || process.env['E2E_TEST'] === 'true';
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15分
    max: isTest ? 10000 : 3, // テスト環境では実質無制限
    message: {
      success: false,
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'パスワードリセットの試行回数が多すぎます。15分後に再試行してください。',
        details: [],
      },
    },
    standardHeaders: true,
    legacyHeaders: false,
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
 *
 * 注意: req.body を検査するためボディパーサより後に適用すること（#219）。
 * 本APIは JSON 主体のため実効はほぼ query 側だが、urlencoded ボディの
 * 重複パラメータ除去もパーサ後配置で機能する。
 */
export const hppProtection = hpp();

/**
 * 入力サニタイゼーションミドルウェア
 *
 * 方針変更（#218）: 旧実装は全入力文字列を HTML エスケープ（& < > " ' /）して
 * DB に永続化していたため、顧客名・住所・口座名義等の元データを破壊し、
 * ゆうちょ振替CSVの名義不正や帳票出力時の二重エスケープ（&amp;amp;）を
 * 引き起こしていた。XSS 対策は出力時エスケープ（React の既定エスケープ＋
 * documentService.escapeHtml）に一本化し、入力側は保存値を変えない無害化
 * （制御文字の除去）のみに限定する。
 */
export const sanitizeInput = (req: Request, _res: Response, next: NextFunction) => {
  // リクエストボディのサニタイゼーション
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  // クエリパラメータのサニタイゼーション（Express v5: req.query is a getter）
  if (req.query) {
    const sanitized = sanitizeObject(req.query);
    Object.defineProperty(req, 'query', { value: sanitized, writable: true });
  }

  next();
};

/**
 * オブジェクト内の文字列を再帰的にサニタイゼーション
 */
const sanitizeObject = (obj: unknown): unknown => {
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item));
  }

  if (obj !== null && typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    const source = obj as Record<string, unknown>;
    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        sanitized[key] = sanitizeObject(source[key]);
      }
    }
    return sanitized;
  }

  return obj;
};

/**
 * 文字列のサニタイゼーション
 *
 * 保存値を変えない無害化のみ行う（#218）:
 * - C0/C1 制御文字（タブ・改行・復帰を除く）の除去
 * HTML エスケープは行わない（出力時エスケープに一本化。入力時に行うと
 * DB 保存値が破壊され、CSV/帳票出力の名義不正・二重エスケープの実害が出る）。
 */
const sanitizeString = (str: string): string => {
  if (typeof str !== 'string') {
    return str;
  }

  // eslint-disable-next-line no-control-regex
  return str.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '');
};
