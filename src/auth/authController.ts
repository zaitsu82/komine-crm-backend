import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const prisma = new PrismaClient();

// Supabaseクライアントの初期化
const supabaseUrl = process.env['SUPABASE_URL'] || '';
const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'] || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('⚠️  SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set in environment variables');
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
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
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
          access_token: data.session?.access_token,
          refresh_token: data.session?.refresh_token,
          expires_at: data.session?.expires_at,
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
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

    // Authorizationヘッダーからトークンを取得
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '').trim();

    if (token) {
      // Supabaseでログアウト
      await supabase.auth.admin.signOut(token);
    }

    return res.status(200).json({
      success: true,
      data: {
        message: 'ログアウトしました',
      },
    });
  } catch (error) {
    console.error('Logout error:', error);
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
    console.error('Get current user error:', error);
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

    const { refresh_token } = req.body;

    if (!refresh_token) {
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
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'トークンのリフレッシュに失敗しました。再度ログインしてください。',
          details: [],
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
        },
      },
    });
  } catch (error) {
    console.error('Token refresh error:', error);
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

    if (!currentPassword || !newPassword) {
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
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'パスワードの更新に失敗しました',
          details: [],
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        message: 'パスワードを変更しました',
      },
    });
  } catch (error) {
    console.error('Change password error:', error);
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
