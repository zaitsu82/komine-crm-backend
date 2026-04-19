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
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      // ボディのバリデーション
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }

      // クエリパラメータのバリデーション
      // Express v5: req.query is a getter that re-parses the URL each time,
      // so we override it with Object.defineProperty to return parsed values.
      if (schemas.query) {
        const parsed = await schemas.query.parseAsync(req.query);
        Object.defineProperty(req, 'query', { value: parsed, writable: true });
      }

      // パスパラメータのバリデーション
      if (schemas.params) {
        const parsed = await schemas.params.parseAsync(req.params);
        Object.defineProperty(req, 'params', { value: parsed, writable: true });
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Zodエラーを統一されたエラーフォーマットに変換
        const details = error.issues.map((err) => ({
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
 * 共通バリデーションスキーマは @komine/types の共有バリデーションを正として再エクスポートする。
 * （@komine/types の index.ts から `./validations` が再エクスポートされている）
 * 本ファイルではそれをさらに再エクスポートし、バックエンド固有（paginationSchema 等）のみを定義する。
 */
export {
  dateSchema,
  optionalDateSchema,
  yearMonthSchema,
  phoneSchema,
  requiredPhoneSchema,
  postalCodeSchema,
  emailSchema,
  optionalEmailSchema,
  katakanaSchema,
  optionalNonnegativeNumber,
  optionalNonnegativeInt,
  uuidSchema,
} from '@komine/types';

// ページネーション用のクエリパラメータ（バックエンド固有：クエリ文字列のcoerce）
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
 * カスタムバリデーター（バックエンド固有）
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
