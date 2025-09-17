import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { verifyToken, extractTokenFromHeader } from '../utils/jwt';

const prisma = new PrismaClient();

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        name: string;
        role: string;
        is_active: boolean;
      };
    }
  }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Authorizationヘッダーからトークンを取得
    const token = extractTokenFromHeader(req.headers.authorization);

    // トークンを検証
    const decoded = verifyToken(token);

    // ユーザーが存在し、アクティブかチェック
    const staff = await prisma.staff.findUnique({
      where: {
        id: decoded.id,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        is_active: true,
      },
    });

    if (!staff || !staff.is_active) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'ユーザーが存在しないか、無効になっています',
          details: [],
        },
      });
    }

    // リクエストオブジェクトにユーザー情報を設定
    req.user = {
      id: staff.id,
      email: staff.email!,
      name: staff.name,
      role: staff.role,
      is_active: staff.is_active,
    };

    next();
  } catch (error) {
    let errorMessage = '認証に失敗しました';

    if (error instanceof Error) {
      if (error.message === 'Authorization header is required') {
        errorMessage = '認証ヘッダーが必要です';
      } else if (error.message === 'Invalid authorization header format') {
        errorMessage = '認証ヘッダーの形式が正しくありません';
      } else if (error.message === 'Invalid token') {
        errorMessage = '無効なトークンです';
      }
    }

    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: errorMessage,
        details: [],
      },
    });
  }
};

// オプショナル認証ミドルウェア（トークンがある場合のみ認証）
export const optionalAuthenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      // トークンがない場合はそのまま次へ
      return next();
    }

    const token = extractTokenFromHeader(authHeader);
    const decoded = verifyToken(token);

    const staff = await prisma.staff.findUnique({
      where: {
        id: decoded.id,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        is_active: true,
      },
    });

    if (staff && staff.is_active) {
      req.user = {
        id: staff.id,
        email: staff.email!,
        name: staff.name,
        role: staff.role,
        is_active: staff.is_active,
      };
    }

    next();
  } catch (error) {
    // オプショナル認証の場合、エラーでも次に進む
    next();
  }
};