import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { comparePassword } from '../utils/password';
import { generateToken } from '../utils/jwt';

const prisma = new PrismaClient();

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // 入力値検証
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'メールアドレスとパスワードは必須です',
          details: [
            !email && { field: 'email', message: 'メールアドレスは必須です' },
            !password && { field: 'password', message: 'パスワードは必須です' },
          ].filter(Boolean),
        },
      });
    }

    // ユーザー検索
    const staff = await prisma.staff.findFirst({
      where: {
        email: email,
        isActive: true,
      },
    });

    if (!staff) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'メールアドレスまたはパスワードが正しくありません',
          details: [],
        },
      });
    }

    // パスワード確認
    const isPasswordValid = await comparePassword(password, staff.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'メールアドレスまたはパスワードが正しくありません',
          details: [],
        },
      });
    }

    // JWTトークン生成
    const token = generateToken({
      id: staff.id,
      email: staff.email!,
      name: staff.name,
    });

    return res.json({
      success: true,
      data: {
        token,
        user: {
          id: staff.id,
          name: staff.name,
          email: staff.email,
        },
        message: 'ログインが正常に完了しました',
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'サーバー内部エラーが発生しました',
        details: [],
      },
    });
  }
};

export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    // ミドルウェアでセットされたユーザー情報を取得
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '認証が必要です',
          details: [],
        },
      });
    }

    const staff = await prisma.staff.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
      },
    });

    if (!staff || !staff.isActive) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'ユーザーが見つかりません',
          details: [],
        },
      });
    }

    return res.json({
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
        code: 'INTERNAL_ERROR',
        message: 'サーバー内部エラーが発生しました',
        details: [],
      },
    });
  }
};