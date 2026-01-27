/**
 * スタッフコントローラー
 * スタッフ（ユーザー）管理のCRUD操作を提供
 */
import { Request, Response, NextFunction } from 'express';
import { PrismaClient, StaffRole } from '@prisma/client';
import { NotFoundError, ConflictError, ValidationError } from '../middleware/errorHandler';

const prisma = new PrismaClient();

// スタッフ一覧のレスポンス型
interface StaffListItem {
  id: number;
  name: string;
  email: string;
  role: StaffRole;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

// スタッフ詳細のレスポンス型
interface StaffDetail extends StaffListItem {
  updatedAt: Date;
}

/**
 * スタッフ一覧取得
 * GET /staff
 */
export const getStaffList = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { page = '1', limit = '50', search, role, isActive } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
    const skip = (pageNum - 1) * limitNum;

    // 検索条件の構築
    const where: {
      deleted_at: null;
      role?: StaffRole;
      is_active?: boolean;
      OR?: Array<{
        name?: { contains: string; mode: 'insensitive' };
        email?: { contains: string; mode: 'insensitive' };
      }>;
    } = {
      deleted_at: null,
    };

    // ロールでフィルタ
    if (role && ['viewer', 'operator', 'manager', 'admin'].includes(role as string)) {
      where.role = role as StaffRole;
    }

    // 有効/無効でフィルタ
    if (isActive !== undefined) {
      where.is_active = isActive === 'true';
    }

    // 検索キーワード
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    // 総件数取得
    const total = await prisma.staff.count({ where });

    // スタッフ一覧取得
    const staffList = await prisma.staff.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        is_active: true,
        last_login_at: true,
        created_at: true,
      },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
      skip,
      take: limitNum,
    });

    // レスポンス形式に変換
    const items: StaffListItem[] = staffList.map((staff) => ({
      id: staff.id,
      name: staff.name,
      email: staff.email,
      role: staff.role,
      isActive: staff.is_active,
      lastLoginAt: staff.last_login_at,
      createdAt: staff.created_at,
    }));

    res.json({
      success: true,
      data: {
        items,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * スタッフ詳細取得
 * GET /staff/:id
 */
export const getStaffById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const staffId = parseInt(id || '', 10);

    if (isNaN(staffId)) {
      throw new ValidationError('無効なスタッフIDです');
    }

    const staff = await prisma.staff.findFirst({
      where: {
        id: staffId,
        deleted_at: null,
      },
    });

    if (!staff) {
      throw new NotFoundError('スタッフが見つかりません');
    }

    const response: StaffDetail = {
      id: staff.id,
      name: staff.name,
      email: staff.email,
      role: staff.role,
      isActive: staff.is_active,
      lastLoginAt: staff.last_login_at,
      createdAt: staff.created_at,
      updatedAt: staff.updated_at,
    };

    res.json({
      success: true,
      data: response,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * スタッフ更新
 * PUT /staff/:id
 */
export const updateStaff = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const staffId = parseInt(id || '', 10);

    if (isNaN(staffId)) {
      throw new ValidationError('無効なスタッフIDです');
    }

    // 更新対象のスタッフ存在確認
    const existingStaff = await prisma.staff.findFirst({
      where: {
        id: staffId,
        deleted_at: null,
      },
    });

    if (!existingStaff) {
      throw new NotFoundError('スタッフが見つかりません');
    }

    const { name, email, role, isActive } = req.body;

    // メールアドレスの重複チェック
    if (email && email !== existingStaff.email) {
      const emailExists = await prisma.staff.findFirst({
        where: {
          email,
          id: { not: staffId },
          deleted_at: null,
        },
      });

      if (emailExists) {
        throw new ConflictError('このメールアドレスは既に使用されています');
      }
    }

    // 更新データの構築
    const updateData: {
      name?: string;
      email?: string;
      role?: StaffRole;
      is_active?: boolean;
    } = {};

    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (role !== undefined && ['viewer', 'operator', 'manager', 'admin'].includes(role)) {
      updateData.role = role as StaffRole;
    }
    if (isActive !== undefined) updateData.is_active = isActive;

    // 更新実行
    const updatedStaff = await prisma.staff.update({
      where: { id: staffId },
      data: updateData,
    });

    const response: StaffDetail = {
      id: updatedStaff.id,
      name: updatedStaff.name,
      email: updatedStaff.email,
      role: updatedStaff.role,
      isActive: updatedStaff.is_active,
      lastLoginAt: updatedStaff.last_login_at,
      createdAt: updatedStaff.created_at,
      updatedAt: updatedStaff.updated_at,
    };

    res.json({
      success: true,
      data: response,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * スタッフ削除（論理削除）
 * DELETE /staff/:id
 */
export const deleteStaff = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const staffId = parseInt(id || '', 10);

    if (isNaN(staffId)) {
      throw new ValidationError('無効なスタッフIDです');
    }

    // 削除対象のスタッフ存在確認
    const existingStaff = await prisma.staff.findFirst({
      where: {
        id: staffId,
        deleted_at: null,
      },
    });

    if (!existingStaff) {
      throw new NotFoundError('スタッフが見つかりません');
    }

    // 自分自身を削除しようとしていないかチェック
    if (req.user && req.user.id === staffId) {
      throw new ValidationError('自分自身を削除することはできません');
    }

    // 論理削除実行
    await prisma.staff.update({
      where: { id: staffId },
      data: {
        deleted_at: new Date(),
        is_active: false,
      },
    });

    res.json({
      success: true,
      data: { message: 'スタッフを削除しました' },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * スタッフ有効/無効切り替え
 * PUT /staff/:id/toggle-active
 */
export const toggleStaffActive = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const staffId = parseInt(id || '', 10);

    if (isNaN(staffId)) {
      throw new ValidationError('無効なスタッフIDです');
    }

    // 対象のスタッフ存在確認
    const existingStaff = await prisma.staff.findFirst({
      where: {
        id: staffId,
        deleted_at: null,
      },
    });

    if (!existingStaff) {
      throw new NotFoundError('スタッフが見つかりません');
    }

    // 自分自身を無効化しようとしていないかチェック
    if (req.user && req.user.id === staffId && existingStaff.is_active) {
      throw new ValidationError('自分自身を無効化することはできません');
    }

    // 有効/無効を切り替え
    const updatedStaff = await prisma.staff.update({
      where: { id: staffId },
      data: {
        is_active: !existingStaff.is_active,
      },
    });

    res.json({
      success: true,
      data: {
        id: updatedStaff.id,
        isActive: updatedStaff.is_active,
        message: updatedStaff.is_active ? 'スタッフを有効化しました' : 'スタッフを無効化しました',
      },
    });
  } catch (error) {
    next(error);
  }
};
