import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  validate,
  emailSchema,
  phoneSchema,
  postalCodeSchema,
  dateSchema,
  uuidSchema,
  paginationSchema,
  japaneseStringSchema,
  katakanaSchema,
  amountSchema,
  yearMonthSchema,
  areaSchema,
} from '../../src/middleware/validation';
import { ValidationError } from '../../src/middleware/errorHandler';

describe('Validation Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      body: {},
      query: {},
      params: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe('validate middleware', () => {
    describe('bodyのバリデーション', () => {
      it('有効なbodyでバリデーションが成功すること', async () => {
        const schema = z.object({
          name: z.string().min(1),
          age: z.number(),
        });

        mockRequest.body = {
          name: 'テスト',
          age: 30,
        };

        const middleware = validate({ body: schema });
        await middleware(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockNext).toHaveBeenCalledTimes(1);
        expect(mockNext).toHaveBeenCalledWith();
        expect(mockRequest.body).toEqual({ name: 'テスト', age: 30 });
      });

      it('無効なbodyでバリデーションエラーが発生すること', async () => {
        const schema = z.object({
          name: z.string().min(1),
          age: z.number(),
        });

        mockRequest.body = {
          name: '',
          age: 'invalid',
        };

        const middleware = validate({ body: schema });
        await middleware(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockNext).toHaveBeenCalledTimes(1);
        const error = (mockNext as jest.Mock).mock.calls[0][0];
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.message).toBe('バリデーションエラーが発生しました');
        expect(error.details).toBeDefined();
        expect(error.details.length).toBeGreaterThan(0);
      });

      it('必須フィールドが欠けている場合エラーが発生すること', async () => {
        const schema = z.object({
          name: z.string().min(1),
          email: z.string().email(),
        });

        mockRequest.body = {
          name: 'テスト',
        };

        const middleware = validate({ body: schema });
        await middleware(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockNext).toHaveBeenCalledTimes(1);
        const error = (mockNext as jest.Mock).mock.calls[0][0];
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.details).toBeDefined();
        expect(error.details.some((d: any) => d.field === 'email')).toBe(true);
      });
    });

    describe('queryのバリデーション', () => {
      it('有効なqueryでバリデーションが成功すること', async () => {
        const schema = z.object({
          page: z.string().optional(),
          limit: z.string().optional(),
        });

        mockRequest.query = {
          page: '1',
          limit: '10',
        };

        const middleware = validate({ query: schema });
        await middleware(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockNext).toHaveBeenCalledTimes(1);
        expect(mockNext).toHaveBeenCalledWith();
      });

      it('無効なqueryでバリデーションエラーが発生すること', async () => {
        const schema = z.object({
          page: z.string().regex(/^\d+$/),
        });

        mockRequest.query = {
          page: 'invalid',
        };

        const middleware = validate({ query: schema });
        await middleware(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockNext).toHaveBeenCalledTimes(1);
        const error = (mockNext as jest.Mock).mock.calls[0][0];
        expect(error).toBeInstanceOf(ValidationError);
      });
    });

    describe('paramsのバリデーション', () => {
      it('有効なparamsでバリデーションが成功すること', async () => {
        const schema = z.object({
          id: z.string().uuid(),
        });

        mockRequest.params = {
          id: '123e4567-e89b-12d3-a456-426614174000',
        };

        const middleware = validate({ params: schema });
        await middleware(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockNext).toHaveBeenCalledTimes(1);
        expect(mockNext).toHaveBeenCalledWith();
      });

      it('無効なparamsでバリデーションエラーが発生すること', async () => {
        const schema = z.object({
          id: z.string().uuid(),
        });

        mockRequest.params = {
          id: 'invalid-uuid',
        };

        const middleware = validate({ params: schema });
        await middleware(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockNext).toHaveBeenCalledTimes(1);
        const error = (mockNext as jest.Mock).mock.calls[0][0];
        expect(error).toBeInstanceOf(ValidationError);
      });
    });

    describe('複数のスキーマを組み合わせた場合', () => {
      it('body、query、paramsすべてが有効な場合バリデーションが成功すること', async () => {
        const bodySchema = z.object({ name: z.string() });
        const querySchema = z.object({ search: z.string().optional() });
        const paramsSchema = z.object({ id: z.string().uuid() });

        mockRequest.body = { name: 'テスト' };
        mockRequest.query = { search: 'test' };
        mockRequest.params = { id: '123e4567-e89b-12d3-a456-426614174000' };

        const middleware = validate({
          body: bodySchema,
          query: querySchema,
          params: paramsSchema,
        });

        await middleware(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockNext).toHaveBeenCalledTimes(1);
        expect(mockNext).toHaveBeenCalledWith();
      });

      it('いずれかが無効な場合エラーが発生すること', async () => {
        const bodySchema = z.object({ name: z.string() });
        const paramsSchema = z.object({ id: z.string().uuid() });

        mockRequest.body = { name: 'テスト' };
        mockRequest.params = { id: 'invalid' };

        const middleware = validate({
          body: bodySchema,
          params: paramsSchema,
        });

        await middleware(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockNext).toHaveBeenCalledTimes(1);
        const error = (mockNext as jest.Mock).mock.calls[0][0];
        expect(error).toBeInstanceOf(ValidationError);
      });
    });

    describe('Zod以外のエラーの処理', () => {
      it('予期しないエラーがそのまま渡されること', async () => {
        const errorSchema = z.object({}).transform(() => {
          throw new Error('Unexpected error');
        });

        mockRequest.body = {};

        const middleware = validate({ body: errorSchema });
        await middleware(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockNext).toHaveBeenCalledTimes(1);
        const error = (mockNext as jest.Mock).mock.calls[0][0];
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('Unexpected error');
      });
    });
  });

  describe('共通バリデーションスキーマ', () => {
    describe('emailSchema', () => {
      it('有効なメールアドレスでバリデーションが成功すること', () => {
        expect(() => emailSchema.parse('test@example.com')).not.toThrow();
        expect(() => emailSchema.parse('user.name+tag@example.co.jp')).not.toThrow();
      });

      it('無効なメールアドレスでエラーが発生すること', () => {
        expect(() => emailSchema.parse('invalid')).toThrow();
        expect(() => emailSchema.parse('test@')).toThrow();
        expect(() => emailSchema.parse('@example.com')).toThrow();
      });
    });

    describe('phoneSchema', () => {
      it('有効な電話番号でバリデーションが成功すること', () => {
        expect(() => phoneSchema.parse('03-1234-5678')).not.toThrow();
        expect(() => phoneSchema.parse('0312345678')).not.toThrow();
        expect(() => phoneSchema.parse('090-1234-5678')).not.toThrow();
        expect(() => phoneSchema.parse('09012345678')).not.toThrow();
        expect(() => phoneSchema.parse('')).not.toThrow();
      });

      it('無効な電話番号でエラーが発生すること', () => {
        expect(() => phoneSchema.parse('123-456')).toThrow();
        expect(() => phoneSchema.parse('abc-defg-hijk')).toThrow();
      });

      it('未定義でも許可されること', () => {
        expect(() => phoneSchema.parse(undefined)).not.toThrow();
      });
    });

    describe('postalCodeSchema', () => {
      it('有効な郵便番号でバリデーションが成功すること', () => {
        expect(() => postalCodeSchema.parse('123-4567')).not.toThrow();
        expect(() => postalCodeSchema.parse('1234567')).not.toThrow();
        expect(() => postalCodeSchema.parse('')).not.toThrow();
      });

      it('無効な郵便番号でエラーが発生すること', () => {
        expect(() => postalCodeSchema.parse('12-3456')).toThrow();
        expect(() => postalCodeSchema.parse('abcd-efgh')).toThrow();
      });

      it('未定義でも許可されること', () => {
        expect(() => postalCodeSchema.parse(undefined)).not.toThrow();
      });
    });

    describe('dateSchema', () => {
      it('有効な日付形式でバリデーションが成功すること', () => {
        expect(() => dateSchema.parse('2024-01-01')).not.toThrow();
        expect(() => dateSchema.parse('2024-12-31')).not.toThrow();
      });

      it('無効な日付形式でエラーが発生すること', () => {
        expect(() => dateSchema.parse('2024/01/01')).toThrow();
        expect(() => dateSchema.parse('01-01-2024')).toThrow();
        expect(() => dateSchema.parse('2024-1-1')).toThrow();
      });
    });

    describe('uuidSchema', () => {
      it('有効なUUIDでバリデーションが成功すること', () => {
        expect(() => uuidSchema.parse('123e4567-e89b-12d3-a456-426614174000')).not.toThrow();
        expect(() => uuidSchema.parse('550e8400-e29b-41d4-a716-446655440000')).not.toThrow();
      });

      it('無効なUUIDでエラーが発生すること', () => {
        expect(() => uuidSchema.parse('invalid-uuid')).toThrow();
        expect(() => uuidSchema.parse('123456')).toThrow();
      });
    });

    describe('paginationSchema', () => {
      it('有効なページネーションパラメータでバリデーションが成功すること', () => {
        const result = paginationSchema.parse({ page: '1', limit: '20' });
        expect(result.page).toBe(1);
        expect(result.limit).toBe(20);
      });

      it('パラメータが未指定の場合デフォルト値が設定されること', () => {
        const result = paginationSchema.parse({});
        expect(result.page).toBe(1);
        expect(result.limit).toBe(20);
      });

      it('無効な値でエラーが発生すること', () => {
        expect(() => paginationSchema.parse({ page: '0' })).toThrow();
        expect(() => paginationSchema.parse({ page: '-1' })).toThrow();
        expect(() => paginationSchema.parse({ limit: '0' })).toThrow();
        expect(() => paginationSchema.parse({ limit: '101' })).toThrow();
      });
    });

    describe('japaneseStringSchema', () => {
      it('有効な日本語文字列でバリデーションが成功すること', () => {
        const schema = japaneseStringSchema('名前');
        expect(() => schema.parse('山田太郎')).not.toThrow();
        expect(() => schema.parse('やまだ たろう')).not.toThrow();
        expect(() => schema.parse('ヤマダ タロウ')).not.toThrow();
      });

      it('英数字が含まれる場合エラーが発生すること', () => {
        const schema = japaneseStringSchema('名前');
        expect(() => schema.parse('Yamada Taro')).toThrow();
        expect(() => schema.parse('山田123')).toThrow();
      });

      it('空文字でエラーが発生すること', () => {
        const schema = japaneseStringSchema('名前');
        expect(() => schema.parse('')).toThrow();
      });

      it('デフォルトのフィールド名でエラーメッセージが生成されること', () => {
        const schema = japaneseStringSchema();
        try {
          schema.parse('');
        } catch (error: any) {
          expect(error.issues[0].message).toContain('フィールド');
        }
      });
    });

    describe('katakanaSchema', () => {
      it('有効なカタカナ文字列でバリデーションが成功すること', () => {
        const schema = katakanaSchema('フリガナ');
        expect(() => schema.parse('ヤマダ タロウ')).not.toThrow();
        expect(() => schema.parse('カタカナ')).not.toThrow();
      });

      it('ひらがなや漢字が含まれる場合エラーが発生すること', () => {
        const schema = katakanaSchema('フリガナ');
        expect(() => schema.parse('やまだ')).toThrow();
        expect(() => schema.parse('山田')).toThrow();
      });

      it('空文字でエラーが発生すること', () => {
        const schema = katakanaSchema('フリガナ');
        expect(() => schema.parse('')).toThrow();
      });

      it('デフォルトのフィールド名でエラーメッセージが生成されること', () => {
        const schema = katakanaSchema();
        try {
          schema.parse('');
        } catch (error: any) {
          expect(error.issues[0].message).toContain('フィールド');
        }
      });
    });

    describe('amountSchema', () => {
      it('有効な金額でバリデーションが成功すること', () => {
        const schema = amountSchema('価格');
        expect(() => schema.parse(1000)).not.toThrow();
        expect(() => schema.parse(0)).not.toThrow();
        expect(() => schema.parse('5000')).not.toThrow();
      });

      it('負の値でエラーが発生すること', () => {
        const schema = amountSchema('価格');
        expect(() => schema.parse(-100)).toThrow();
        expect(() => schema.parse('-100')).toThrow();
      });

      it('小数でエラーが発生すること', () => {
        const schema = amountSchema('価格');
        expect(() => schema.parse(100.5)).toThrow();
      });

      it('無効な文字列でエラーが発生すること', () => {
        const schema = amountSchema('価格');
        expect(() => schema.parse('invalid')).toThrow();
      });

      it('デフォルトのフィールド名でエラーメッセージが生成されること', () => {
        const schema = amountSchema();
        try {
          schema.parse(-100);
        } catch (error: any) {
          expect(error.issues[0].message).toContain('金額');
        }
      });
    });

    describe('yearMonthSchema', () => {
      it('有効な年月形式でバリデーションが成功すること', () => {
        expect(() => yearMonthSchema.parse('2024年1月')).not.toThrow();
        expect(() => yearMonthSchema.parse('2024年12月')).not.toThrow();
        expect(() => yearMonthSchema.parse('')).not.toThrow();
      });

      it('無効な形式でエラーが発生すること', () => {
        expect(() => yearMonthSchema.parse('2024-01')).toThrow();
        expect(() => yearMonthSchema.parse('2024/01')).toThrow();
      });

      it('未定義でも許可されること', () => {
        expect(() => yearMonthSchema.parse(undefined)).not.toThrow();
      });
    });

    describe('areaSchema', () => {
      it('有効な面積でバリデーションが成功すること', () => {
        expect(() => areaSchema.parse(100.5)).not.toThrow();
        expect(() => areaSchema.parse('50.25')).not.toThrow();
        expect(() => areaSchema.parse(undefined)).not.toThrow();
      });

      it('負の値でエラーが発生すること', () => {
        expect(() => areaSchema.parse(-10)).toThrow();
        expect(() => areaSchema.parse('-5.5')).toThrow();
      });

      it('ゼロでエラーが発生すること', () => {
        expect(() => areaSchema.parse(0)).toThrow();
      });
    });
  });
});
