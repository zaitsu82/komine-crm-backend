import pino from 'pino';
import { AsyncLocalStorage } from 'async_hooks';

/**
 * アプリケーション全体のロギング基盤
 *
 * - pino による構造化JSONログ
 * - AsyncLocalStorage でリクエストIDを全ログに自動付与
 * - LOG_LEVEL 環境変数でレベル制御 (dev: debug, prod: info)
 * - dev環境: pino-pretty でカラー付き出力
 * - prod環境: JSON構造化ログ（Render/CloudWatch等で検索可能）
 */

const isDev = process.env['NODE_ENV'] !== 'production' && process.env['NODE_ENV'] !== 'test';
const isTest = process.env['NODE_ENV'] === 'test';

const defaultLevel = isTest ? 'silent' : isDev ? 'debug' : 'info';

/**
 * 機密情報マスク対象パス
 */
const redactPaths = [
  'password',
  'newPassword',
  'currentPassword',
  'token',
  'accessToken',
  'refreshToken',
  'req.headers.authorization',
  'req.headers.cookie',
];

/**
 * アプリケーションルートロガー
 * リクエストスコープ外（起動/シャットダウン等）で使用
 */
export const logger = pino({
  level: process.env['LOG_LEVEL'] || defaultLevel,
  redact: {
    paths: redactPaths,
    censor: '[REDACTED]',
  },
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
            ignore: 'pid,hostname',
          },
        },
      }
    : {}),
});

/**
 * リクエストスコープのロガーを格納する AsyncLocalStorage
 */
export const loggerStorage = new AsyncLocalStorage<pino.Logger>();

/**
 * リクエストスコープのロガーを取得
 * AsyncLocalStorage にロガーがない場合はルートロガーにフォールバック
 */
export const getRequestLogger = (): pino.Logger => {
  return loggerStorage.getStore() || logger;
};
