import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { comparePassword, hashPassword } from '../utils/password';
import { generateToken } from '../utils/jwt';
import { checkResourceAction, ROLES } from '../middleware/permission';

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
        is_active: true,
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

    // 最終ログイン日時を更新
    await prisma.staff.update({
      where: { id: staff.id },
      data: { last_login_at: new Date() },
    });

    // JWTトークン生成（ロール情報も含める）
    const token = generateToken({
      id: staff.id,
      email: staff.email!,
      name: staff.name,
      role: staff.role,
    });

    return res.json({
      success: true,
      data: {
        token,
        user: {
          id: staff.id,
          name: staff.name,
          email: staff.email,
          role: staff.role,
          is_active: staff.is_active,
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
        role: true,
        is_active: true,
        last_login_at: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!staff || !staff.is_active) {
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

export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password, role = 'viewer' } = req.body;

    // 入力値検証
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '名前、メールアドレス、パスワードは必須です',
          details: [
            !name && { field: 'name', message: '名前は必須です' },
            !email && { field: 'email', message: 'メールアドレスは必須です' },
            !password && { field: 'password', message: 'パスワードは必須です' },
          ].filter(Boolean),
        },
      });
    }

    // メールアドレス形式の検証
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '有効なメールアドレスを入力してください',
          details: [
            { field: 'email', message: '有効なメールアドレスを入力してください' },
          ],
        },
      });
    }

    // パスワード強度の検証（最低8文字）
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'パスワードは8文字以上で入力してください',
          details: [
            { field: 'password', message: 'パスワードは8文字以上で入力してください' },
          ],
        },
      });
    }

    // 既存ユーザーの確認
    const existingStaff = await prisma.staff.findFirst({
      where: {
        email: email,
      },
    });

    if (existingStaff) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'このメールアドレスは既に登録されています',
          details: [
            { field: 'email', message: 'このメールアドレスは既に登録されています' },
          ],
        },
      });
    }

    // パスワードのハッシュ化
    const hashedPassword = await hashPassword(password);

    // ロールバリデーション
    const validRoles = ['viewer', 'operator', 'manager', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '無効なロールです',
          details: [
            { field: 'role', message: '有効なロール（viewer, operator, manager, admin）を指定してください' },
          ],
        },
      });
    }

    // 新規ユーザーの作成
    const newStaff = await prisma.staff.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        is_active: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        is_active: true,
        created_at: true,
      },
    });

    // JWTトークン生成
    const token = generateToken({
      id: newStaff.id,
      email: newStaff.email!,
      name: newStaff.name,
      role: newStaff.role,
    });

    return res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: newStaff.id,
          name: newStaff.name,
          email: newStaff.email,
          role: newStaff.role,
          is_active: newStaff.is_active,
        },
        message: 'ユーザー登録が正常に完了しました',
      },
    });
  } catch (error) {
    console.error('Register error:', error);
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

// ログアウト
export const logout = async (req: Request, res: Response) => {
  return res.json({
    success: true,
    data: {
      message: 'ログアウトが正常に完了しました',
    },
  });
};

// パスワード更新
export const updatePassword = async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user?.id;

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

    // 入力値検証
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '現在のパスワードと新しいパスワードは必須です',
          details: [
            !currentPassword && { field: 'currentPassword', message: '現在のパスワードは必須です' },
            !newPassword && { field: 'newPassword', message: '新しいパスワードは必須です' },
          ].filter(Boolean),
        },
      });
    }

    // パスワード強度の検証
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'パスワードは8文字以上で入力してください',
          details: [
            { field: 'newPassword', message: 'パスワードは8文字以上で入力してください' },
          ],
        },
      });
    }

    // 現在のユーザー取得
    const staff = await prisma.staff.findUnique({
      where: { id: userId },
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

    // 現在のパスワード確認
    const isCurrentPasswordValid = await comparePassword(currentPassword, staff.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '現在のパスワードが正しくありません',
          details: [
            { field: 'currentPassword', message: '現在のパスワードが正しくありません' },
          ],
        },
      });
    }

    // 新しいパスワードをハッシュ化
    const hashedNewPassword = await hashPassword(newPassword);

    // パスワード更新
    await prisma.staff.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    });

    return res.json({
      success: true,
      data: {
        message: 'パスワードが正常に更新されました',
      },
    });
  } catch (error) {
    console.error('Update password error:', error);
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

// 権限一覧取得
export const getPermissions = async (req: Request, res: Response) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '認証が必要です',
          details: [],
        },
      });
    }

    // ユーザーの権限に応じたリソース・アクション一覧を作成
    const allowedActions: Record<string, string[]> = {
      gravestone: [],
      contractor: [],
      applicant: [],
      master: [],
      user: [],
      system: [],
    };

    // リソース・アクションの権限チェック
    const permissions = [
      { resource: 'gravestone', actions: ['read', 'create', 'update', 'delete'] },
      { resource: 'contractor', actions: ['read', 'create', 'update', 'delete', 'transfer'] },
      { resource: 'applicant', actions: ['read', 'create', 'update', 'delete'] },
      { resource: 'master', actions: ['read', 'create', 'update', 'delete'] },
      { resource: 'user', actions: ['read', 'manage'] },
      { resource: 'system', actions: ['admin'] },
    ];

    for (const permission of permissions) {
      for (const action of permission.actions) {
        if (checkResourceAction(user.role as any, permission.resource, action)) {
          allowedActions[permission.resource].push(action);
        }
      }
    }

    return res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        permissions: allowedActions,
      },
    });
  } catch (error) {
    console.error('Get permissions error:', error);
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

// 権限チェック
export const checkPermission = async (req: Request, res: Response) => {
  try {
    const { resource, action, resource_id } = req.body;
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '認証が必要です',
          details: [],
        },
      });
    }

    if (!resource || !action) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'リソースとアクションは必須です',
          details: [
            !resource && { field: 'resource', message: 'リソースは必須です' },
            !action && { field: 'action', message: 'アクションは必須です' },
          ].filter(Boolean),
        },
      });
    }

    const allowed = checkResourceAction(user.role as any, resource, action);

    return res.json({
      success: true,
      data: {
        allowed,
        reason: allowed ? null : '権限が不足しています',
        required_role: allowed ? null : 'より高い権限が必要です',
        user_role: user.role,
      },
    });
  } catch (error) {
    console.error('Check permission error:', error);
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

// リソース・アクション権限チェック
export const canResourceAction = async (req: Request, res: Response) => {
  try {
    const { resource, action } = req.params;
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '認証が必要です',
          details: [],
        },
      });
    }

    const allowed = checkResourceAction(user.role as any, resource, action);

    return res.json({
      success: true,
      data: {
        allowed,
        reason: allowed ? null : '権限が不足しています',
        required_role: allowed ? null : 'より高い権限が必要です',
        user_role: user.role,
      },
    });
  } catch (error) {
    console.error('Can resource action error:', error);
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