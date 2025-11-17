import { z } from 'zod';
import { emailSchema } from '../middleware/validation';

/**
 * ログインリクエストのバリデーションスキーマ
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'パスワードは必須です'),
});

/**
 * パスワード変更リクエストのバリデーションスキーマ
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, '現在のパスワードは必須です'),
    newPassword: z
      .string()
      .min(8, 'パスワードは8文字以上である必要があります')
      .max(128, 'パスワードは128文字以下である必要があります')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'パスワードは大文字、小文字、数字を含む必要があります'
      ),
    confirmPassword: z.string().min(1, 'パスワード確認は必須です'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'パスワードが一致しません',
    path: ['confirmPassword'],
  });

/**
 * 型エクスポート
 */
export type LoginRequest = z.infer<typeof loginSchema>;
export type ChangePasswordRequest = z.infer<typeof changePasswordSchema>;
