/**
 * スタッフコントローラー
 * スタッフ（ユーザー）管理のCRUD操作を提供
 */
import { Request, Response, NextFunction } from 'express';
import { getRequestLogger } from '../utils/logger';
import { Prisma, StaffRole } from '@prisma/client';
import { NotFoundError, ConflictError, ValidationError } from '../middleware/errorHandler';
import prisma from '../db/prisma';
import {
  isSupabaseAdminAvailable,
  createSupabaseUser,
  deleteSupabaseUser,
  updateSupabaseUserEmail,
  resendInvitation,
  sendPasswordReset,
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
 * 最後の有効な admin を失う操作（降格・無効化・削除）を防ぐ（#208）。
 * admin が0人になると staff 管理・マスタ更新等の admin 専用操作が全て不能になり、
 * 復旧に bootstrap script の実行が必要になるため、対象スタッフを除いて
 * is_active な admin が存在しない場合は操作を拒否する。
 */
const assertNotLastActiveAdmin = async (staffId: number, operationLabel: string): Promise<void> => {
  const otherActiveAdmins = await prisma.staff.count({
    where: {
      role: 'admin',
      is_active: true,
      deleted_at: null,
      id: { not: staffId },
    },
  });
  if (otherActiveAdmins === 0) {
    throw new ValidationError(
      `最後の有効な管理者のため${operationLabel}できません。先に別のスタッフへ管理者権限を付与してください`
    );
  }
};

/**
 * 最後の有効 admin を失いうる更新を「更新＋再検証」の Serializable トランザクションで
 * 原子的に実行する（#269）。
 * 事前チェック（assertNotLastActiveAdmin）だけでは count→update の間に並行する
 * 降格・無効化・削除が挟まる TOCTOU レースで admin が 0 人になりうる
 * （例: admin が2人のとき互いを同時降格すると両方の事前チェックが通過する）。
 * 更新後に同一トランザクション内で有効 admin を再カウントし、0 人ならロールバックする。
 * Serializable 分離レベルにより競合するトランザクションは直列化される。
 */
const updateStaffGuardingLastAdmin = async (
  staffId: number,
  data: Prisma.StaffUncheckedUpdateInput,
  operationLabel: string
) =>
  prisma.$transaction(
    async (tx) => {
      const updated = await tx.staff.update({ where: { id: staffId }, data });
      const remainingAdmins = await tx.staff.count({
        where: { role: 'admin', is_active: true, deleted_at: null },
      });
      if (remainingAdmins === 0) {
        throw new ValidationError(
          `最後の有効な管理者のため${operationLabel}できません。先に別のスタッフへ管理者権限を付与してください`
        );
      }
      return updated;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );

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
    const {
      name,
      email,
      role = 'viewer',
      skipSupabase = false,
    } = req.body as {
      name?: string;
      email?: string;
      role?: string;
      skipSupabase?: boolean;
    };

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
    // Staff.email は deleted_at を含まない DB レベルの @unique 制約のため、
    // 論理削除済みスタッフのメールでも create が P2002 になる（#204）。
    // 削除済みヒットは P2002 に当たる前に専用メッセージで弾く。
    const existingStaff = await prisma.staff.findFirst({
      where: {
        email: normalizedEmail,
      },
    });

    if (existingStaff) {
      if (existingStaff.deleted_at) {
        throw new ConflictError(
          'このメールアドレスは過去に削除されたスタッフで使用されています。別のメールアドレスを使用してください'
        );
      }
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
        // #174: Supabase に同一メールのユーザーが残存しているケース。
        // 重複チェック（deleted_at: null）は通過しているため、CRM上にアクティブな
        // スタッフは存在しない。論理削除済みスタッフの有無で対処可能な文言に振り分ける。
        if (supabaseResult.errorCode === 'already_registered') {
          const softDeletedStaff = await prisma.staff.findFirst({
            where: { email: normalizedEmail, deleted_at: { not: null } },
          });
          if (softDeletedStaff) {
            throw new ConflictError(
              'このメールアドレスは過去に削除されたスタッフで使用されており、認証基盤(Supabase)側にアカウントが残存しています。' +
                '管理者に認証基盤側の残存アカウント削除を依頼してから再登録してください。'
            );
          }
          throw new ConflictError(
            'このメールアドレスは認証基盤(Supabase)側に既に登録されています。' +
              'CRM上に該当スタッフが存在しない場合は、認証基盤側に残存しているアカウントの確認・削除が必要です。'
          );
        }
        throw new ConflictError(supabaseResult.error || 'Supabaseアカウントの作成に失敗しました');
      }

      supabaseUid = supabaseResult.user.id;
      invitationSent = true;
    } else {
      // Supabaseが利用不可またはスキップの場合は仮のUIDを設定
      supabaseUid = `pending_${Date.now()}`;
    }

    // スタッフ作成
    // #173: Supabaseユーザー作成（=招待メール送信）後に staff.create が失敗すると
    // 招待メールだけ飛んでDBレコードが無い orphan アカウントが残る。
    // DB作成失敗時は作成済みSupabaseユーザーを補償削除（best-effort）してから再スロー。
    let newStaff;
    try {
      newStaff = await prisma.staff.create({
        data: {
          name: name.trim(),
          email: normalizedEmail,
          role: role as StaffRole,
          supabase_uid: supabaseUid,
          is_active: true,
        },
      });
    } catch (createError) {
      if (invitationSent && !supabaseUid.startsWith('pending_')) {
        try {
          const cleanup = await deleteSupabaseUser(supabaseUid);
          if (!cleanup.success) {
            getRequestLogger().warn(
              { email: normalizedEmail, supabaseUid, error: cleanup.error },
              'staff.create 失敗後のSupabaseユーザー補償削除に失敗（orphanの可能性）'
            );
          } else {
            getRequestLogger().warn(
              { email: normalizedEmail, supabaseUid },
              'staff.create 失敗のためSupabaseユーザーを補償削除した'
            );
          }
        } catch (cleanupError) {
          getRequestLogger().warn(
            {
              email: normalizedEmail,
              supabaseUid,
              error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
            },
            'staff.create 失敗後のSupabaseユーザー補償削除で例外（orphanの可能性）'
          );
        }
      }
      throw createError;
    }

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
    const { id } = req.params as Record<string, string>;
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
    const { id } = req.params as Record<string, string>;
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

    const { name, email, role, isActive } = req.body as {
      name?: string;
      email?: string;
      role?: string;
      isActive?: boolean;
    };
    const normalizedEmail = email ? email.trim().toLowerCase() : undefined;

    // 最後の有効な admin の降格・無効化を防ぐ（#208）
    const demoting = role !== undefined && ['viewer', 'operator', 'manager'].includes(role);
    const deactivating = isActive === false;
    const needsLastAdminGuard =
      existingStaff.role === 'admin' && existingStaff.is_active && (demoting || deactivating);
    const guardLabel = demoting ? '権限を変更' : '無効化';
    if (needsLastAdminGuard) {
      await assertNotLastActiveAdmin(staffId, guardLabel);
    }

    // Supabase 側メールを更新したかどうか（DB更新失敗時の補償戻し判定用 #233）
    let supabaseEmailUpdated = false;

    // メールアドレスの重複チェック
    if (normalizedEmail && normalizedEmail !== existingStaff.email) {
      const emailExists = await prisma.staff.findFirst({
        where: {
          email: normalizedEmail,
          id: { not: staffId },
        },
      });

      if (emailExists) {
        // 論理削除済みでも email @unique（deleted_at 非考慮）に当たるため弾く（#204 と同根）
        if (emailExists.deleted_at) {
          throw new ConflictError(
            'このメールアドレスは過去に削除されたスタッフで使用されています。別のメールアドレスを使用してください'
          );
        }
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
        supabaseEmailUpdated = true;
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
    // Supabase メール更新成功後に DB 更新が失敗すると Supabase=新 / DB=旧 の
    // 分散不整合が残り、再招待・パスワードリセットが誤メール宛になる。
    // createStaff の補償削除と同様に、失敗時は Supabase 側を旧メールへ戻す（#233）。
    let updatedStaff;
    try {
      // admin を失いうる更新は tx 内再検証つきで原子的に行う（#269）
      updatedStaff = needsLastAdminGuard
        ? await updateStaffGuardingLastAdmin(staffId, updateData, guardLabel)
        : await prisma.staff.update({
            where: { id: staffId },
            data: updateData,
          });
    } catch (dbError) {
      if (supabaseEmailUpdated && existingStaff.supabase_uid) {
        try {
          const revert = await updateSupabaseUserEmail(
            existingStaff.supabase_uid,
            existingStaff.email
          );
          if (!revert.success) {
            getRequestLogger().warn(
              { staffId, error: revert.error },
              'DB更新失敗後のSupabaseメール補償戻しに失敗（不整合が残存している可能性）'
            );
          } else {
            getRequestLogger().warn({ staffId }, 'DB更新失敗のためSupabaseメールを旧値へ戻した');
          }
        } catch (revertException) {
          getRequestLogger().warn(
            { staffId, err: revertException },
            'Supabaseメール補償戻しで例外（不整合が残存している可能性）'
          );
        }
      }
      throw dbError;
    }

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
    const { id } = req.params as Record<string, string>;
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

    // 最後の有効な admin の削除を防ぐ（#208）
    // Supabase アカウント削除より前に判定する（認証アカウントだけ消える事故を防ぐ）
    const needsLastAdminGuard = existingStaff.role === 'admin' && existingStaff.is_active;
    if (needsLastAdminGuard) {
      await assertNotLastActiveAdmin(staffId, '削除');
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
        getRequestLogger().warn({ staffId, error: deleteResult.error }, 'Supabaseユーザー削除失敗');
      }
    }

    // 論理削除実行（admin を失いうる削除は tx 内再検証つきで原子的に行う #269）
    const deleteData = { deleted_at: new Date(), is_active: false };
    if (needsLastAdminGuard) {
      await updateStaffGuardingLastAdmin(staffId, deleteData, '削除');
    } else {
      await prisma.staff.update({ where: { id: staffId }, data: deleteData });
    }

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
    const { id } = req.params as Record<string, string>;
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

    // 最後の有効な admin の無効化を防ぐ（#208）
    const needsLastAdminGuard = existingStaff.role === 'admin' && existingStaff.is_active;
    if (needsLastAdminGuard) {
      await assertNotLastActiveAdmin(staffId, '無効化');
    }

    // 有効/無効を切り替え（admin を失いうる無効化は tx 内再検証つきで原子的に行う #269）
    const updatedStaff = needsLastAdminGuard
      ? await updateStaffGuardingLastAdmin(staffId, { is_active: false }, '無効化')
      : await prisma.staff.update({
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
    const { id } = req.params as Record<string, string>;
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

    const redirectTo = process.env['FRONTEND_URL']
      ? `${process.env['FRONTEND_URL']}/set-password`
      : undefined;

    // #175: supabase_uid が仮（pending_）= Supabaseアカウント未作成のスタッフは招待メール
    // （inviteUserByEmail = ユーザー新規作成）でよいが、既に実アカウントがあるスタッフへ
    // 招待を送ると `already registered` で失敗する。既存アカウントには recovery（パスワード
    // 再設定）メールを送る。
    const isPending =
      !existingStaff.supabase_uid || existingStaff.supabase_uid.startsWith('pending_');

    if (isPending) {
      // 仮UID: 招待メール送信（=Supabaseユーザー新規作成）
      const result = await resendInvitation(existingStaff.email, redirectTo);

      // 仮UIDなのにSupabase側に既存アカウントがある（UID未同期等）場合は、招待ではなく
      // パスワード再設定メールにフォールバックして再送を成立させる。
      if (!result.success && result.errorCode === 'already_registered') {
        const fallback = await sendPasswordReset(existingStaff.email, redirectTo);
        if (!fallback.success) {
          throw new ValidationError(fallback.error || 'パスワード再設定メールの送信に失敗しました');
        }
        res.json({
          success: true,
          data: {
            message: 'パスワード再設定メールを送信しました',
          },
        });
        return;
      }

      if (!result.success) {
        throw new ValidationError(result.error || '招待メールの送信に失敗しました');
      }

      // 新規作成されたSupabaseユーザーの実UIDで仮UIDを更新
      if (result.user) {
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
      return;
    }

    // 既存アカウント: パスワード再設定メールを送信
    const result = await sendPasswordReset(existingStaff.email, redirectTo);

    if (!result.success) {
      throw new ValidationError(result.error || 'パスワード再設定メールの送信に失敗しました');
    }

    res.json({
      success: true,
      data: {
        message: 'パスワード再設定メールを送信しました',
      },
    });
  } catch (error) {
    next(error);
  }
};
