import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

/**
 * Sentry初期化
 * エラートラッキングとパフォーマンスモニタリングを設定
 */
export const initializeSentry = (): void => {
  const dsn = process.env['SENTRY_DSN'];

  // DSNが設定されていない場合は初期化しない（開発環境など）
  if (!dsn) {
    console.log('Sentry DSN not configured. Skipping Sentry initialization.');
    return;
  }

  const environment = process.env['SENTRY_ENVIRONMENT'] || process.env['NODE_ENV'] || 'development';
  const tracesSampleRate = parseFloat(process.env['SENTRY_TRACES_SAMPLE_RATE'] || '1.0');

  Sentry.init({
    dsn,
    environment,

    // パフォーマンストレーシング設定
    tracesSampleRate,

    // Express統合とプロファイリング統合
    integrations: [Sentry.expressIntegration(), nodeProfilingIntegration()],

    // プロファイリングのサンプリングレート
    profilesSampleRate: 1.0,

    // リリースバージョン（package.jsonから取得）
    release: process.env['npm_package_version'] || 'unknown',

    // エラー送信前のフック（機密情報のフィルタリング）
    beforeSend(event) {
      // 開発環境ではSentryに送信しない（ログのみ）
      if (environment === 'development') {
        console.log('Sentry event (not sent in development):', event);
        return null;
      }

      // パスワードなどの機密情報をフィルタリング
      if (event.request?.data) {
        const data = event.request.data;
        if (typeof data === 'object') {
          // パスワードフィールドをマスク
          if ('password' in data) {
            data.password = '[FILTERED]';
          }
          if ('newPassword' in data) {
            data.newPassword = '[FILTERED]';
          }
          if ('currentPassword' in data) {
            data.currentPassword = '[FILTERED]';
          }
        }
      }

      return event;
    },
  });

  console.log(
    `Sentry initialized (environment: ${environment}, tracesSampleRate: ${tracesSampleRate})`
  );
};

/**
 * ユーザー情報をSentryコンテキストに設定
 */
export const setSentryUser = (user: {
  id: number;
  email: string;
  name: string;
  role: string;
}): void => {
  Sentry.setUser({
    id: user.id.toString(),
    email: user.email,
    username: user.name,
    role: user.role,
  });
};

/**
 * Sentryユーザーコンテキストをクリア
 */
export const clearSentryUser = (): void => {
  Sentry.setUser(null);
};

/**
 * カスタムタグを追加
 */
export const setSentryTag = (key: string, value: string): void => {
  Sentry.setTag(key, value);
};

/**
 * カスタムコンテキストを追加
 */
export const setSentryContext = (name: string, context: Record<string, any>): void => {
  Sentry.setContext(name, context);
};

/**
 * 手動でエラーをキャプチャ
 */
export const captureException = (error: Error, context?: Record<string, any>): void => {
  if (context) {
    Sentry.withScope((scope) => {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
};

/**
 * 手動でメッセージをキャプチャ
 */
export const captureMessage = (message: string, level: Sentry.SeverityLevel = 'info'): void => {
  Sentry.captureMessage(message, level);
};

export default Sentry;
