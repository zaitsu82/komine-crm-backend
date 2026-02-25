/**
 * スタッフコントローラー
 * スタッフ（ユーザー）管理のCRUD操作を提供
 */
import { Request, Response, NextFunction } from 'express';
import { StaffRole } from '@prisma/client';
import { z } from 'zod';
import { NotFoundError, ConflictError, ValidationError } from '../middleware/errorHandler';
import prisma from '../db/prisma';
import {
  isSupabaseAdminAvailable,
  createSupabaseUser,
  deleteSupabaseUser,
  updateSupabaseUserEmail,
  resendInvitation,
} from '../config/supabase';

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
 * スタッフ新規作成
 * POST /staff
 *
 * Supabase Admin SDKを使用してアカウントを作成し、招待メールを送信
 * スタッフDBレコードとSupabaseアカウントを同時に作成
 */
export const createStaff = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, email, role = 'viewer', skipSupabase = false } = req.body;

    // バリデーション
    if (!name || !name.trim()) {
      throw new ValidationError('名前は必須です');
    }
    if (!email || !email.trim()) {
      throw new ValidationError('メールアドレスは必須です');
    }
    if (!['viewer', 'operator', 'manager', 'admin'].includes(role)) {
      throw new ValidationError('無効なロールです');
    }

    // メールアドレスの形式チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ValidationError('有効なメールアドレスを入力してください');
    }

    const normalizedEmail = email.trim().toLowerCase();

    // メールアドレスの重複チェック
    const existingStaff = await prisma.staff.findFirst({
      where: {
        email: normalizedEmail,
        deleted_at: null,
      },
    });

    if (existingStaff) {
      throw new ConflictError('このメールアドレスは既に使用されています');
    }

    let supabaseUid: string;
    let invitationSent = false;

    // Supabase Admin SDKが利用可能かつskipSupabaseがfalseの場合
    if (isSupabaseAdminAvailable() && !skipSupabase) {
      // Supabaseユーザーを作成（招待メール送信）
      const supabaseResult = await createSupabaseUser(
        normalizedEmail,
        { name: name.trim(), role },
        process.env['FRONTEND_URL'] ? `${process.env['FRONTEND_URL']}/set-password` : undefined
      );

      if (!supabaseResult.success || !supabaseResult.user) {
        throw new ConflictError(supabaseResult.error || 'Supabaseアカウントの作成に失敗しました');
      }

      supabaseUid = supabaseResult.user.id;
      invitationSent = true;
    } else {
      // Supabaseが利用不可またはスキップの場合は仮のUIDを設定
      supabaseUid = `pending_${Date.now()}`;
    }

    // スタッフ作成
    const newStaff = await prisma.staff.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        role: role as StaffRole,
        supabase_uid: supabaseUid,
        is_active: true,
      },
    });

    const response: StaffDetail = {
      id: newStaff.id,
      name: newStaff.name,
      email: newStaff.email,
      role: newStaff.role,
      isActive: newStaff.is_active,
      lastLoginAt: newStaff.last_login_at,
      createdAt: newStaff.created_at,
      updatedAt: newStaff.updated_at,
    };

    const message = invitationSent
      ? 'スタッフを作成しました。招待メールを送信しました。'
      : 'スタッフを作成しました。Supabaseアカウントは別途作成してください。';

    res.status(201).json({
      success: true,
      data: response,
      message,
      invitationSent,
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
 *
 * メールアドレス変更時はSupabaseも同期
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
    const normalizedEmail = email ? email.trim().toLowerCase() : undefined;

    // メールアドレスの重複チェック
    if (normalizedEmail && normalizedEmail !== existingStaff.email) {
      const emailExists = await prisma.staff.findFirst({
        where: {
          email: normalizedEmail,
          id: { not: staffId },
          deleted_at: null,
        },
      });

      if (emailExists) {
        throw new ConflictError('このメールアドレスは既に使用されています');
      }

      // Supabaseのメールアドレスも更新
      if (
        isSupabaseAdminAvailable() &&
        existingStaff.supabase_uid &&
        !existingStaff.supabase_uid.startsWith('pending_')
      ) {
        const updateResult = await updateSupabaseUserEmail(
          existingStaff.supabase_uid,
          normalizedEmail
        );
        if (!updateResult.success) {
          throw new ConflictError(
            updateResult.error || 'Supabaseメールアドレスの更新に失敗しました'
          );
        }
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
    if (normalizedEmail !== undefined) updateData.email = normalizedEmail;
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
 *
 * Supabaseユーザーも同時に削除（オプション）
 */
export const deleteStaff = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const staffId = parseInt(id || '', 10);
    const { deleteSupabaseAccount = true } = req.query;

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

    let supabaseDeleted = false;

    // Supabaseユーザーの削除（pending_で始まる仮UIDは除外）
    if (
      deleteSupabaseAccount !== 'false' &&
      isSupabaseAdminAvailable() &&
      existingStaff.supabase_uid &&
      !existingStaff.supabase_uid.startsWith('pending_')
    ) {
      const deleteResult = await deleteSupabaseUser(existingStaff.supabase_uid);
      supabaseDeleted = deleteResult.success;
      // Supabase削除が失敗してもDBの論理削除は続行
      if (!deleteResult.success) {
        console.warn(`Supabaseユーザー削除失敗 (staff_id: ${staffId}): ${deleteResult.error}`);
      }
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
      data: {
        message: 'スタッフを削除しました',
        supabaseAccountDeleted: supabaseDeleted,
      },
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

/**
 * 招待メール再送信
 * POST /staff/:id/resend-invitation
 */
export const resendStaffInvitation = async (
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

    // Supabase Admin SDKが利用可能かチェック
    if (!isSupabaseAdminAvailable()) {
      throw new ValidationError('Supabase Admin サービスが利用できません');
    }

    // 招待メール再送信
    const result = await resendInvitation(
      existingStaff.email,
      process.env['FRONTEND_URL'] ? `${process.env['FRONTEND_URL']}/set-password` : undefined
    );

    if (!result.success) {
      throw new ValidationError(result.error || '招待メールの送信に失敗しました');
    }

    // supabase_uidが仮の値の場合、新しいUIDで更新
    if (result.user && existingStaff.supabase_uid?.startsWith('pending_')) {
      await prisma.staff.update({
        where: { id: staffId },
        data: { supabase_uid: result.user.id },
      });
    }

    res.json({
      success: true,
      data: {
        message: '招待メールを再送信しました',
      },
    });
  } catch (error) {
    next(error);
  }
};

// 一括登録用Zodスキーマ
const bulkStaffItemSchema = z.object({
  name: z
    .string({ error: '名前は必須です' })
    .min(1, '名前は必須です')
    .max(100, '名前は100文字以内で入力してください'),
  email: z
    .string({ error: 'メールアドレスは必須です' })
    .min(1, 'メールアドレスは必須です')
    .email('有効なメールアドレスを入力してください'),
  role: z.enum(['viewer', 'operator', 'manager', 'admin'] as const, {
    error: '無効なロールです。viewer, operator, manager, admin のいずれかを指定してください',
  }),
});

/**
 * スタッフ一括登録
 * POST /staff/bulk
 *
 * 複数のスタッフを一括で登録する（トランザクション使用: all-or-nothing）
 * admin権限のみ
 */
export const bulkCreateStaff = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { items } = req.body;

    // 配列バリデーション
    if (!Array.isArray(items)) {
      throw new ValidationError('items は配列である必要があります');
    }

    if (items.length === 0) {
      throw new ValidationError('items は空にできません');
    }

    if (items.length > 100) {
      throw new ValidationError('一括登録は最大100件までです');
    }

    // 各行のZodバリデーション
    const validationErrors: Array<{ row: number; field: string; message: string }> = [];

    const parsedItems: Array<{ name: string; email: string; role: string }> = [];

    for (let i = 0; i < items.length; i++) {
      const result = bulkStaffItemSchema.safeParse(items[i]);
      if (!result.success) {
        for (const issue of result.error.issues) {
          validationErrors.push({
            row: i,
            field: issue.path.join('.') || 'unknown',
            message: issue.message,
          });
        }
      } else {
        parsedItems.push(result.data);
      }
    }

    if (validationErrors.length > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '一括登録でエラーが発生しました',
          details: validationErrors,
        },
      });
      return;
    }

    // バッチ内の重複メールチェック
    const normalizedEmails = parsedItems.map((item) => item.email.trim().toLowerCase());
    const emailSet = new Set<string>();
    const duplicateErrors: Array<{ row: number; field: string; message: string }> = [];

    for (let i = 0; i < normalizedEmails.length; i++) {
      if (emailSet.has(normalizedEmails[i]!)) {
        duplicateErrors.push({
          row: i,
          field: 'email',
          message: 'バッチ内でメールアドレスが重複しています',
        });
      } else {
        emailSet.add(normalizedEmails[i]!);
      }
    }

    if (duplicateErrors.length > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '一括登録でエラーが発生しました',
          details: duplicateErrors,
        },
      });
      return;
    }

    // 既存メールアドレスとの重複チェック
    const existingStaff = await prisma.staff.findMany({
      where: {
        email: { in: normalizedEmails },
        deleted_at: null,
      },
      select: { email: true },
    });

    if (existingStaff.length > 0) {
      const existingEmailSet = new Set(existingStaff.map((s) => s.email));
      const dbDuplicateErrors: Array<{ row: number; field: string; message: string }> = [];

      for (let i = 0; i < normalizedEmails.length; i++) {
        if (existingEmailSet.has(normalizedEmails[i]!)) {
          dbDuplicateErrors.push({
            row: i,
            field: 'email',
            message: 'このメールアドレスは既に使用されています',
          });
        }
      }

      res.status(409).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '一括登録でエラーが発生しました',
          details: dbDuplicateErrors,
        },
      });
      return;
    }

    // トランザクションで一括作成
    const timestamp = Date.now();
    const createdStaff = await prisma.$transaction(
      parsedItems.map((item, index) =>
        prisma.staff.create({
          data: {
            name: item.name.trim(),
            email: normalizedEmails[index]!,
            role: item.role as StaffRole,
            supabase_uid: `pending_bulk_${timestamp}_${index}`,
            is_active: true,
          },
        })
      )
    );

    const results = createdStaff.map((staff) => ({
      id: staff.id,
      name: staff.name,
      email: staff.email,
    }));

    res.status(201).json({
      success: true,
      data: {
        totalRequested: items.length,
        created: createdStaff.length,
        results,
      },
    });
  } catch (error) {
    next(error);
  }
};
