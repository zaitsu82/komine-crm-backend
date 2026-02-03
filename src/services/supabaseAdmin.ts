/**
 * Supabase Admin サービス
 * Service Role Keyを使用した管理者権限でのユーザー管理機能を提供
 */
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

// 環境変数
const supabaseUrl = process.env['SUPABASE_URL'] || '';
const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'] || '';

let supabaseAdmin: SupabaseClient | null = null;

// 環境変数が設定されている場合のみクライアントを初期化
if (supabaseUrl && supabaseServiceKey) {
  supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Supabase Admin クライアントが利用可能かチェック
 */
export const isSupabaseAdminAvailable = (): boolean => {
  return supabaseAdmin !== null;
};

/**
 * ユーザー作成結果
 */
export interface CreateUserResult {
  success: boolean;
  user?: User;
  error?: string;
}

/**
 * 招待メール送信結果
 */
export interface InviteUserResult {
  success: boolean;
  user?: User;
  error?: string;
}

/**
 * ユーザー削除結果
 */
export interface DeleteUserResult {
  success: boolean;
  error?: string;
}

/**
 * Supabaseユーザーを作成（招待メール送信付き）
 *
 * @param email - ユーザーのメールアドレス
 * @param metadata - ユーザーメタデータ（name, roleなど）
 * @param redirectTo - パスワード設定後のリダイレクト先URL（オプション）
 * @returns 作成結果
 */
export const createSupabaseUser = async (
  email: string,
  metadata: { name: string; role: string },
  redirectTo?: string
): Promise<CreateUserResult> => {
  if (!supabaseAdmin) {
    return {
      success: false,
      error: 'Supabase Admin サービスが利用できません',
    };
  }

  try {
    // inviteUserByEmailを使用してユーザーを作成し、招待メールを送信
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: metadata,
      redirectTo: redirectTo,
    });

    if (error) {
      // よくあるエラーの日本語化
      let errorMessage = error.message;
      if (error.message.includes('already registered')) {
        errorMessage = 'このメールアドレスは既にSupabaseに登録されています';
      } else if (error.message.includes('rate limit')) {
        errorMessage = '招待メールの送信制限に達しました。しばらく待ってから再試行してください';
      }

      return {
        success: false,
        error: errorMessage,
      };
    }

    return {
      success: true,
      user: data.user,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : '不明なエラーが発生しました';
    return {
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * Supabaseユーザーを作成（招待メールなし、パスワード指定）
 * 主にテスト用途や、即座にログイン可能なアカウントが必要な場合に使用
 *
 * @param email - ユーザーのメールアドレス
 * @param password - 初期パスワード
 * @param metadata - ユーザーメタデータ
 * @returns 作成結果
 */
export const createSupabaseUserWithPassword = async (
  email: string,
  password: string,
  metadata: { name: string; role: string }
): Promise<CreateUserResult> => {
  if (!supabaseAdmin) {
    return {
      success: false,
      error: 'Supabase Admin サービスが利用できません',
    };
  }

  try {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // メール確認済みとして作成
      user_metadata: metadata,
    });

    if (error) {
      let errorMessage = error.message;
      if (error.message.includes('already registered')) {
        errorMessage = 'このメールアドレスは既にSupabaseに登録されています';
      }

      return {
        success: false,
        error: errorMessage,
      };
    }

    return {
      success: true,
      user: data.user,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : '不明なエラーが発生しました';
    return {
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * Supabaseユーザーを削除
 *
 * @param userId - Supabase UID
 * @returns 削除結果
 */
export const deleteSupabaseUser = async (userId: string): Promise<DeleteUserResult> => {
  if (!supabaseAdmin) {
    return {
      success: false,
      error: 'Supabase Admin サービスが利用できません',
    };
  }

  try {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : '不明なエラーが発生しました';
    return {
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * Supabaseユーザーのメールアドレスを更新
 *
 * @param userId - Supabase UID
 * @param newEmail - 新しいメールアドレス
 * @returns 更新結果
 */
export const updateSupabaseUserEmail = async (
  userId: string,
  newEmail: string
): Promise<CreateUserResult> => {
  if (!supabaseAdmin) {
    return {
      success: false,
      error: 'Supabase Admin サービスが利用できません',
    };
  }

  try {
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      email: newEmail,
    });

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      user: data.user,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : '不明なエラーが発生しました';
    return {
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * 招待メールを再送信
 *
 * @param email - ユーザーのメールアドレス
 * @param redirectTo - パスワード設定後のリダイレクト先URL（オプション）
 * @returns 送信結果
 */
export const resendInvitation = async (
  email: string,
  redirectTo?: string
): Promise<InviteUserResult> => {
  if (!supabaseAdmin) {
    return {
      success: false,
      error: 'Supabase Admin サービスが利用できません',
    };
  }

  try {
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
    });

    if (error) {
      let errorMessage = error.message;
      if (error.message.includes('rate limit')) {
        errorMessage = '招待メールの送信制限に達しました。しばらく待ってから再試行してください';
      }

      return {
        success: false,
        error: errorMessage,
      };
    }

    return {
      success: true,
      user: data.user,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : '不明なエラーが発生しました';
    return {
      success: false,
      error: errorMessage,
    };
  }
};

export default supabaseAdmin;
