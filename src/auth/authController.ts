import { Request, Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import prisma from '../db/prisma';
import { getRequestLogger, logger } from '../utils/logger';

// Cookie設定の定数
const isProduction = process.env['NODE_ENV'] === 'production';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction, // 本番環境ではHTTPS必須
  sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
  path: '/',
};

// アクセストークン用Cookie設定（有効期限: 1時間）
const ACCESS_TOKEN_COOKIE = 'access_token';
const ACCESS_TOKEN_MAX_AGE = 60 * 60 * 1000; // 1時間

// リフレッシュトークン用Cookie設定（有効期限: 7日）
const REFRESH_TOKEN_COOKIE = 'refresh_token';
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7日

/**
 * 認証Cookieを設定するヘルパー関数
 */
const setAuthCookies = (res: Response, accessToken: string, refreshToken: string) => {
  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
    ...COOKIE_OPTIONS,
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    ...COOKIE_OPTIONS,
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });
};

/**
 * 認証Cookieをクリアするヘルパー関数
 */
const clearAuthCookies = (res: Response) => {
  res.clearCookie(ACCESS_TOKEN_COOKIE, { ...COOKIE_OPTIONS });
  res.clearCookie(REFRESH_TOKEN_COOKIE, { ...COOKIE_OPTIONS });
};

// Supabaseクライアントの初期化
const supabaseUrl = process.env['SUPABASE_URL'] || '';
const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'] || '';

if (!supabaseUrl || !supabaseServiceKey) {
  logger.warn('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set in environment variables');
}

let supabase: SupabaseClient | null = null;

// 環境変数が設定されている場合のみクライアントを初期化
if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * ログイン
 * POST /api/v1/auth/login
 */
export const login = async (req: Request, res: Response) => {
  const log = getRequestLogger();
  try {
    if (!supabase) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Supabase認証サービスが利用できません',
          details: [],
        },
      });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'メールアドレスとパスワードは必須です',
          details: [],
        },
      });
    }

    // Supabaseで認証
    log.info({ email }, 'Auth: login attempt');
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      log.warn(
        { email, reason: 'supabase_auth_error', error: error?.message || 'no user returned' },
        'Auth: login failed'
      );
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'メールアドレスまたはパスワードが正しくありません',
          details: [],
        },
      });
    }

    // Staffテーブルでユーザー情報を取得
    const staff = await prisma.staff.findUnique({
      where: {
        supabase_uid: data.user.id,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        is_active: true,
        supabase_uid: true,
      },
    });

    if (!staff) {
      log.warn(
        { email, reason: 'staff_not_found', supabaseUid: data.user.id },
        'Auth: login failed'
      );
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'ユーザーが登録されていません',
          details: [],
        },
      });
    }

    if (!staff.is_active) {
      log.warn({ email, reason: 'user_inactive', staffId: staff.id }, 'Auth: login failed');
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'ユーザーアカウントが無効になっています',
          details: [],
        },
      });
    }

    // last_login_atを更新
    await prisma.staff.update({
      where: { id: staff.id },
      data: { last_login_at: new Date() },
    });

    // HttpOnly Cookieを設定
    if (data.session?.access_token && data.session?.refresh_token) {
      setAuthCookies(res, data.session.access_token, data.session.refresh_token);
    }

    log.info({ email, staffId: staff.id, role: staff.role }, 'Auth: login success');
    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: staff.id,
          email: staff.email,
          name: staff.name,
          role: staff.role,
          supabase_uid: staff.supabase_uid,
        },
        session: {
          // トークンはCookieに設定するため、レスポンスボディには含めない（セキュリティ向上）
          // フロントエンドはexpiresAtのみを使用して有効期限を管理
          expires_at: data.session?.expires_at,
        },
      },
    });
  } catch (error) {
    log.error({ err: error }, 'Auth: login error');
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'ログイン処理中にエラーが発生しました',
        details: [],
      },
    });
  }
};

/**
 * ログアウト
 * POST /api/v1/auth/logout
 */
export const logout = async (req: Request, res: Response) => {
  const log = getRequestLogger();
  try {
    if (!supabase) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Supabase認証サービスが利用できません',
          details: [],
        },
      });
    }

    // Cookieまたはヘッダーからトークンを取得
    const cookieToken = req.cookies?.[ACCESS_TOKEN_COOKIE];
    const authHeader = req.headers.authorization;
    const headerToken = authHeader?.replace('Bearer ', '').trim();
    const token = cookieToken || headerToken;
    const tokenSource = cookieToken ? 'cookie' : headerToken ? 'header' : 'none';

    log.info({ tokenSource }, 'Auth: logout attempt');

    if (token) {
      // Supabaseでログアウト
      await supabase.auth.admin.signOut(token);
    }

    // HttpOnly Cookieをクリア
    clearAuthCookies(res);

    log.info('Auth: logout success');
    return res.status(200).json({
      success: true,
      data: {
        message: 'ログアウトしました',
      },
    });
  } catch (error) {
    log.error({ err: error }, 'Auth: logout error');
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'ログアウト処理中にエラーが発生しました',
        details: [],
      },
    });
  }
};

/**
 * 現在のユーザー情報取得
 * GET /api/v1/auth/me
 */
export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '認証が必要です',
          details: [],
        },
      });
    }

    // Staffテーブルから最新情報を取得
    const staff = await prisma.staff.findUnique({
      where: {
        id: req.user.id,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        is_active: true,
        supabase_uid: true,
        created_at: true,
        updated_at: true,
        last_login_at: true,
      },
    });

    if (!staff) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'ユーザーが見つかりません',
          details: [],
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        user: staff,
      },
    });
  } catch (error) {
    getRequestLogger().error({ err: error }, 'Auth: get current user error');
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'ユーザー情報取得中にエラーが発生しました',
        details: [],
      },
    });
  }
};

/**
 * トークンリフレッシュ
 * POST /api/v1/auth/refresh
 */
export const refreshToken = async (req: Request, res: Response) => {
  const log = getRequestLogger();
  try {
    if (!supabase) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Supabase認証サービスが利用できません',
          details: [],
        },
      });
    }

    // Cookieまたはリクエストボディからリフレッシュトークンを取得
    const cookieRefreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
    const bodyRefreshToken = req.body?.refresh_token;
    const refresh_token = cookieRefreshToken || bodyRefreshToken;
    const tokenSource = cookieRefreshToken ? 'cookie' : bodyRefreshToken ? 'body' : 'none';

    log.info({ tokenSource }, 'Auth: token refresh attempt');

    if (!refresh_token) {
      log.warn({ reason: 'no_refresh_token' }, 'Auth: token refresh failed');
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'リフレッシュトークンは必須です',
          details: [],
        },
      });
    }

    // Supabaseでトークンをリフレッシュ
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token,
    });

    if (error || !data.session) {
      log.warn(
        { reason: 'supabase_error', error: error?.message || 'no session returned' },
        'Auth: token refresh failed'
      );
      // リフレッシュ失敗時はCookieをクリア
      clearAuthCookies(res);
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'トークンのリフレッシュに失敗しました。再度ログインしてください。',
          details: [],
        },
      });
    }

    // 新しいトークンでCookieを更新
    setAuthCookies(res, data.session.access_token, data.session.refresh_token);

    log.info({ expiresAt: data.session.expires_at }, 'Auth: token refresh success');
    return res.status(200).json({
      success: true,
      data: {
        session: {
          // トークンはCookieに設定するため、レスポンスボディには含めない
          expires_at: data.session.expires_at,
        },
      },
    });
  } catch (error) {
    log.error({ err: error }, 'Auth: token refresh error');
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'トークンリフレッシュ処理中にエラーが発生しました',
        details: [],
      },
    });
  }
};

/**
 * パスワード変更
 * PUT /api/v1/auth/password
 */
export const changePassword = async (req: Request, res: Response) => {
  const log = getRequestLogger();
  try {
    if (!supabase) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Supabase認証サービスが利用できません',
          details: [],
        },
      });
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '認証が必要です',
          details: [],
        },
      });
    }

    const { currentPassword, newPassword } = req.body;

    log.info({ staffId: req.user.id }, 'Auth: password change attempt');

    if (!currentPassword || !newPassword) {
      log.warn({ staffId: req.user.id, reason: 'missing_fields' }, 'Auth: password change failed');
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '現在のパスワードと新しいパスワードは必須です',
          details: [],
        },
      });
    }

    if (newPassword.length < 8) {
      log.warn(
        { staffId: req.user.id, reason: 'password_too_short' },
        'Auth: password change failed'
      );
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'パスワードは8文字以上である必要があります',
          details: [],
        },
      });
    }

    // 現在のパスワードを検証
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: req.user.email,
      password: currentPassword,
    });

    if (signInError) {
      log.warn(
        { staffId: req.user.id, reason: 'current_password_invalid' },
        'Auth: password change failed'
      );
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '現在のパスワードが正しくありません',
          details: [],
        },
      });
    }

    // Supabaseでパスワード更新
    const { error: updateError } = await supabase.auth.admin.updateUserById(req.user.supabase_uid, {
      password: newPassword,
    });

    if (updateError) {
      log.error(
        { staffId: req.user.id, reason: 'supabase_update_error', error: updateError.message },
        'Auth: password change failed'
      );
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'パスワードの更新に失敗しました',
          details: [],
        },
      });
    }

    log.info({ staffId: req.user.id }, 'Auth: password change success');
    return res.status(200).json({
      success: true,
      data: {
        message: 'パスワードを変更しました',
      },
    });
  } catch (error) {
    log.error({ err: error }, 'Auth: password change error');
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'パスワード変更中にエラーが発生しました',
        details: [],
      },
    });
  }
};

/**
 * プロフィール更新（名前・メールアドレス）
 * PUT /api/v1/auth/profile
 */
export const updateProfile = async (req: Request, res: Response) => {
  const log = getRequestLogger();
  try {
    if (!supabase) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Supabase認証サービスが利用できません',
          details: [],
        },
      });
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '認証が必要です',
          details: [],
        },
      });
    }

    const { name, email } = req.body;

    log.info(
      { staffId: req.user.id, hasName: name !== undefined, hasEmail: email !== undefined },
      'Auth: profile update attempt'
    );

    // メールアドレス変更時: 他ユーザーとの重複チェック
    if (email && email !== req.user.email) {
      const existingStaff = await prisma.staff.findFirst({
        where: {
          email,
          id: { not: req.user.id },
        },
      });

      if (existingStaff) {
        log.warn({ staffId: req.user.id, reason: 'email_conflict' }, 'Auth: profile update failed');
        return res.status(409).json({
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'このメールアドレスは既に使用されています',
            details: [],
          },
        });
      }

      // Supabaseのメールアドレスを更新
      const { error: supabaseError } = await supabase.auth.admin.updateUserById(
        req.user.supabase_uid,
        { email }
      );

      if (supabaseError) {
        log.error(
          {
            staffId: req.user.id,
            reason: 'supabase_email_update_error',
            error: supabaseError.message,
          },
          'Auth: profile update failed'
        );
        return res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'メールアドレスの更新に失敗しました',
            details: [],
          },
        });
      }
    }

    // Staffテーブルを更新
    const updateData: { name?: string; email?: string } = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;

    const updatedStaff = await prisma.staff.update({
      where: { id: req.user.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        is_active: true,
        supabase_uid: true,
      },
    });

    log.info({ staffId: req.user.id }, 'Auth: profile update success');
    return res.status(200).json({
      success: true,
      data: {
        user: updatedStaff,
      },
    });
  } catch (error) {
    log.error({ err: error }, 'Auth: profile update error');
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'プロフィール更新中にエラーが発生しました',
        details: [],
      },
    });
  }
};

/**
 * パスワードリセットメール送信
 * POST /api/v1/auth/forgot-password
 */
export const forgotPassword = async (req: Request, res: Response) => {
  const log = getRequestLogger();
  try {
    if (!supabase) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Supabase認証サービスが利用できません',
          details: [],
        },
      });
    }

    const { email } = req.body;

    log.info({ email }, 'Auth: password reset request');

    const frontendUrl = process.env['FRONTEND_URL'] || 'http://localhost:3000';
    const redirectTo = `${frontendUrl}/reset-password`;

    // Supabaseでパスワードリセットメール送信
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      // エラーが発生してもセキュリティ上同一レスポンスを返す
      log.warn({ email, error: error.message }, 'Auth: password reset email failed');
    } else {
      log.info({ email }, 'Auth: password reset email sent');
    }

    // メールアドレスの存在有無に関わらず同一レスポンス（メール列挙攻撃対策）
    return res.status(200).json({
      success: true,
      data: {
        message: 'パスワードリセット用のメールを送信しました。メールをご確認ください。',
      },
    });
  } catch (error) {
    log.error({ err: error }, 'Auth: forgot password error');
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'パスワードリセット処理中にエラーが発生しました',
        details: [],
      },
    });
  }
};

/**
 * パスワードリセット（新パスワード設定）
 * POST /api/v1/auth/reset-password
 * 招待メールからの初回パスワード設定、パスワードリセット両方に対応
 */
export const resetPassword = async (req: Request, res: Response) => {
  const log = getRequestLogger();
  try {
    if (!supabase) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Supabase認証サービスが利用できません',
          details: [],
        },
      });
    }

    const { code, newPassword } = req.body;

    log.info('Auth: password reset attempt via code');

    // Supabaseのコードをセッションに交換してユーザーを特定
    const { data: sessionData, error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError || !sessionData?.user) {
      log.warn(
        { reason: 'invalid_code', error: exchangeError?.message || 'no user returned' },
        'Auth: password reset failed'
      );
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: '認証コードが無効または期限切れです。再度パスワードリセットをお試しください。',
          details: [],
        },
      });
    }

    // Admin APIでパスワードを更新
    const { error: updateError } = await supabase.auth.admin.updateUserById(sessionData.user.id, {
      password: newPassword,
    });

    if (updateError) {
      log.error(
        { userId: sessionData.user.id, reason: 'update_error', error: updateError.message },
        'Auth: password reset failed'
      );
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'パスワードの更新に失敗しました',
          details: [],
        },
      });
    }

    log.info({ userId: sessionData.user.id }, 'Auth: password reset success');
    return res.status(200).json({
      success: true,
      data: {
        message: 'パスワードを設定しました。ログインしてください。',
      },
    });
  } catch (error) {
    log.error({ err: error }, 'Auth: reset password error');
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'パスワードリセット処理中にエラーが発生しました',
        details: [],
      },
    });
  }
};
