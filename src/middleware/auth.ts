import { Request, Response, NextFunction } from 'express';
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

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        name: string;
        role: string;
        is_active: boolean;
        supabase_uid: string;
      };
    }
  }
}

/**
 * Supabase認証ミドルウェア
 * リクエストヘッダーのJWTトークンを検証し、Staffテーブルのユーザー情報を取得
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
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

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '認証ヘッダーが必要です',
          details: [],
        },
      });
    }

    // "Bearer <token>" 形式からトークンを抽出
    const token = authHeader.replace('Bearer ', '').trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '認証トークンが必要です',
          details: [],
        },
      });
    }

    // Supabaseでトークンを検証
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '無効なトークンです',
          details: [],
        },
      });
    }

    // Supabase UIDでStaffテーブルを検索
    const staff = await prisma.staff.findUnique({
      where: {
        supabase_uid: user.id,
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

    // リクエストオブジェクトにユーザー情報を設定
    req.user = {
      id: staff.id,
      email: staff.email,
      name: staff.name,
      role: staff.role,
      is_active: staff.is_active,
      supabase_uid: staff.supabase_uid!,
    };

    // last_login_atを更新
    await prisma.staff.update({
      where: { id: staff.id },
      data: { last_login_at: new Date() },
    });

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: '認証に失敗しました',
        details: [],
      },
    });
  }
};

/**
 * オプショナル認証ミドルウェア
 * トークンがある場合のみ認証を試みる（エラーでも次に進む）
 */
export const optionalAuthenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    if (!supabase) {
      return next();
    }

    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return next();
    }

    const token = authHeader.replace('Bearer ', '').trim();

    if (!token) {
      return next();
    }

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return next();
    }

    const staff = await prisma.staff.findUnique({
      where: {
        supabase_uid: user.id,
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

    if (staff && staff.is_active) {
      req.user = {
        id: staff.id,
        email: staff.email,
        name: staff.name,
        role: staff.role,
        is_active: staff.is_active,
        supabase_uid: staff.supabase_uid!,
      };
    }

    next();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_error) {
    // オプショナル認証の場合、エラーでも次に進む
    next();
  }
};
