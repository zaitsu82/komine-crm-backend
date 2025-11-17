import { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodSchema } from 'zod';
import { ValidationError } from './errorHandler';

/**
 * Zodスキーマの種類
 */
export interface ValidationSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

/**
 * Zodバリデーションミドルウェア
 * リクエストのボディ、クエリパラメータ、パスパラメータをバリデーション
 */
export const validate = (schemas: ValidationSchemas) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // ボディのバリデーション
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }

      // クエリパラメータのバリデーション
      if (schemas.query) {
        req.query = await schemas.query.parseAsync(req.query) as any;
      }

      // パスパラメータのバリデーション
      if (schemas.params) {
        req.params = await schemas.params.parseAsync(req.params) as any;
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Zodエラーを統一されたエラーフォーマットに変換
        const details = error.errors.map((err: any) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        next(new ValidationError('バリデーションエラーが発生しました', details));
      } else {
        next(error);
      }
    }
  };
};

/**
 * 共通のバリデーションスキーマ
 */

// UUID形式のバリデーション
export const uuidSchema = z.string().uuid('有効なUUID形式で入力してください');

// 日付形式のバリデーション (YYYY-MM-DD)
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日付はYYYY-MM-DD形式で入力してください');

// メールアドレスのバリデーション
export const emailSchema = z.string().email('有効なメールアドレスを入力してください');

// 電話番号のバリデーション（日本の電話番号形式）
export const phoneSchema = z
  .string()
  .regex(/^0\d{1,4}-?\d{1,4}-?\d{4}$/, '有効な電話番号を入力してください')
  .optional()
  .or(z.literal(''));

// 郵便番号のバリデーション（日本の郵便番号形式）
export const postalCodeSchema = z
  .string()
  .regex(/^\d{3}-?\d{4}$/, '郵便番号は000-0000形式で入力してください')
  .optional()
  .or(z.literal(''));

// ページネーション用のクエリパラメータ
export const paginationSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .refine((val) => val > 0, 'ページ番号は1以上である必要があります'),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .refine((val) => val > 0 && val <= 100, '取得件数は1〜100の範囲で指定してください'),
});

/**
 * カスタムバリデーター
 */

/**
 * 日本語文字列のバリデーション（ひらがな、カタカナ、漢字）
 */
export const japaneseStringSchema = (fieldName: string = 'フィールド') => {
  return z
    .string()
    .min(1, `${fieldName}は必須です`)
    .regex(/^[ぁ-んァ-ヶー一-龠々〆〤\s]+$/, `${fieldName}は日本語で入力してください`);
};

/**
 * カタカナのバリデーション
 */
export const katakanaSchema = (fieldName: string = 'フィールド') => {
  return z
    .string()
    .min(1, `${fieldName}は必須です`)
    .regex(/^[ァ-ヶー\s]+$/, `${fieldName}はカタカナで入力してください`);
};

/**
 * 金額のバリデーション（正の整数）
 */
export const amountSchema = (fieldName: string = '金額') => {
  return z
    .number()
    .int(`${fieldName}は整数で入力してください`)
    .nonnegative(`${fieldName}は0以上である必要があります`)
    .or(
      z
        .string()
        .transform((val) => parseInt(val, 10))
        .refine((val) => !isNaN(val) && val >= 0, `${fieldName}は0以上の数値で入力してください`)
    );
};

/**
 * 年月形式のバリデーション（YYYY年MM月）
 */
export const yearMonthSchema = z
  .string()
  .regex(/^\d{4}年\d{1,2}月$/, '年月はYYYY年MM月形式で入力してください')
  .optional()
  .or(z.literal(''));

/**
 * 面積のバリデーション（正の数値）
 */
export const areaSchema = z
  .number()
  .positive('面積は正の数値である必要があります')
  .or(
    z
      .string()
      .transform((val) => parseFloat(val))
      .refine((val) => !isNaN(val) && val > 0, '面積は正の数値で入力してください')
  )
  .optional();
