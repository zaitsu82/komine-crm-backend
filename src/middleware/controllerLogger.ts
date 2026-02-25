/**
 * AOP風コントローラーロギングユーティリティ
 *
 * コントローラー関数をラップし、以下を自動ログ出力する:
 * - 開始: モジュール名、アクション名、HTTPメソッド、パス、ユーザー情報、リクエストボディのキー一覧
 * - 終了（成功）: ステータスコード、処理時間、success=true
 * - 終了（失敗）: ステータスコード、処理時間、success=false、エラーコード
 * - エラー（例外）: 処理時間、エラーメッセージ
 *
 * ルートファイルでの使用例:
 *   router.get('/', authenticate, withLogging('Plots', 'getPlots', getPlots));
 */

import { Request, Response, NextFunction } from 'express';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ControllerFn = (req: Request, res: Response, next: NextFunction) => any;

/**
 * コントローラーを自動ロギングでラップする高階関数。
 * (req, res, next) と (req, res) の両方のコントローラーパターンに対応。
 */
export const withLogging = (
  module: string,
  action: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fn: ControllerFn | ((req: Request, res: Response) => any)
): ControllerFn => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    const method = req.method;
    const path = req.originalUrl || req.path;
    const user = req.user ? `staff_id=${req.user.id}, role=${req.user.role}` : 'anonymous';
    const bodyKeys =
      req.body && typeof req.body === 'object' ? Object.keys(req.body).join(',') : '';

    console.info(
      `[${module}] ${action} START: ${method} ${path}, user={${user}}, body_keys=[${bodyKeys}]`
    );

    // res.json()をインターセプトしてレスポンス情報をキャプチャ
    const originalJson = res.json.bind(res);
    let logged = false;

    res.json = function (body: any) {
      if (!logged) {
        logged = true;
        const duration = Date.now() - startTime;
        const status = res.statusCode;
        const success = body?.success !== undefined ? body.success : status < 400;

        if (success) {
          console.info(
            `[${module}] ${action} END: status=${status}, duration=${duration}ms, success=true`
          );
        } else {
          const errorCode = body?.error?.code || 'UNKNOWN';
          console.warn(
            `[${module}] ${action} END: status=${status}, duration=${duration}ms, success=false, error_code=${errorCode}`
          );
        }
      }
      return originalJson(body);
    } as typeof res.json;

    // next()をラップしてエラーパッシングをキャプチャ
    const wrappedNext: NextFunction = (err?: any) => {
      if (err && !logged) {
        logged = true;
        const duration = Date.now() - startTime;
        console.error(
          `[${module}] ${action} ERROR: duration=${duration}ms, error=${err instanceof Error ? err.message : String(err)}`
        );
      }
      next(err);
    };

    try {
      await (fn as ControllerFn)(req, res, wrappedNext);
    } catch (error) {
      if (!logged) {
        logged = true;
        const duration = Date.now() - startTime;
        console.error(
          `[${module}] ${action} ERROR: duration=${duration}ms, error=${error instanceof Error ? error.message : String(error)}`
        );
      }
      next(error);
    }
  };
};
