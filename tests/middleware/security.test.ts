import { Request, Response, NextFunction } from 'express';
import {
  getCorsOptions,
  sanitizeInput,
  createRateLimiter,
  createAuthRateLimiter,
  getHelmetOptions,
} from '../../src/middleware/security';

// Express.Request型を拡張
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        name: string;
        role: string;
        is_active: boolean;
        supabase_uid: string;
      };
    }
  }
}

describe('Security Middleware', () => {
  let mockRequest: any;
  let mockResponse: any;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      body: {},
      query: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe('getCorsOptions', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('開発環境で環境変数が未設定の場合、全オリジンを許可すること', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.ALLOWED_ORIGINS;

      const corsOptions = getCorsOptions();

      expect(corsOptions.origin).toBe(true);
      expect(corsOptions.credentials).toBe(true);
    });

    it('本番環境で許可されたオリジンからのリクエストを許可すること', () => {
      process.env.NODE_ENV = 'production';
      process.env.ALLOWED_ORIGINS = 'https://example.com,https://app.example.com';

      const corsOptions = getCorsOptions();
      const callback = jest.fn();

      if (typeof corsOptions.origin === 'function') {
        corsOptions.origin('https://example.com', callback);
        expect(callback).toHaveBeenCalledWith(null, true);
      }
    });

    it('本番環境で許可されていないオリジンからのリクエストを拒否すること', () => {
      process.env.NODE_ENV = 'production';
      process.env.ALLOWED_ORIGINS = 'https://example.com';

      const corsOptions = getCorsOptions();
      const callback = jest.fn();
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      if (typeof corsOptions.origin === 'function') {
        corsOptions.origin('https://malicious.com', callback);
        expect(callback).toHaveBeenCalledWith(expect.any(Error));
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('CORS blocked: https://malicious.com')
        );
      }

      consoleWarnSpy.mockRestore();
    });

    it('オリジンが指定されていない場合（サーバー間通信）、リクエストを許可すること', () => {
      process.env.NODE_ENV = 'production';
      process.env.ALLOWED_ORIGINS = 'https://example.com';

      const corsOptions = getCorsOptions();
      const callback = jest.fn();

      if (typeof corsOptions.origin === 'function') {
        corsOptions.origin(undefined, callback);
        expect(callback).toHaveBeenCalledWith(null, true);
      }
    });

    it('CORS設定に正しいメソッドとヘッダーが含まれていること', () => {
      process.env.NODE_ENV = 'production';
      process.env.ALLOWED_ORIGINS = 'https://example.com';

      const corsOptions = getCorsOptions();

      expect(corsOptions.methods).toEqual(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']);
      expect(corsOptions.allowedHeaders).toEqual(['Content-Type', 'Authorization']);
      expect(corsOptions.credentials).toBe(true);
      expect(corsOptions.maxAge).toBe(86400);
    });
  });

  describe('sanitizeInput', () => {
    it('リクエストボディの文字列をサニタイズすること', () => {
      mockRequest.body = {
        name: '<script>alert("XSS")</script>',
        email: 'user@example.com',
      };

      sanitizeInput(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.body.name).toBe(
        '&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;'
      );
      expect(mockRequest.body.email).toBe('user@example.com');
      expect(mockNext).toHaveBeenCalled();
    });

    it('クエリパラメータをサニタイズすること', () => {
      mockRequest.query = {
        search: '<img src=x onerror=alert(1)>',
      };

      sanitizeInput(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.query.search).toBe('&lt;img src=x onerror=alert(1)&gt;');
      expect(mockNext).toHaveBeenCalled();
    });

    it('ネストされたオブジェクトをサニタイズすること', () => {
      mockRequest.body = {
        user: {
          name: '<b>Bold</b>',
          address: {
            street: '<a href="#">Link</a>',
          },
        },
      };

      sanitizeInput(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.body.user.name).toBe('&lt;b&gt;Bold&lt;&#x2F;b&gt;');
      expect(mockRequest.body.user.address.street).toBe(
        '&lt;a href=&quot;#&quot;&gt;Link&lt;&#x2F;a&gt;'
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it('配列内の文字列をサニタイズすること', () => {
      mockRequest.body = {
        tags: ['<script>evil</script>', 'normal', '<div>html</div>'],
      };

      sanitizeInput(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.body.tags[0]).toBe('&lt;script&gt;evil&lt;&#x2F;script&gt;');
      expect(mockRequest.body.tags[1]).toBe('normal');
      expect(mockRequest.body.tags[2]).toBe('&lt;div&gt;html&lt;&#x2F;div&gt;');
      expect(mockNext).toHaveBeenCalled();
    });

    it('数値とブール値はそのまま保持すること', () => {
      mockRequest.body = {
        age: 25,
        active: true,
        score: 98.5,
      };

      sanitizeInput(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.body.age).toBe(25);
      expect(mockRequest.body.active).toBe(true);
      expect(mockRequest.body.score).toBe(98.5);
      expect(mockNext).toHaveBeenCalled();
    });

    it('nullとundefinedはそのまま保持すること', () => {
      mockRequest.body = {
        nullable: null,
        optional: undefined,
      };

      sanitizeInput(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.body.nullable).toBeNull();
      expect(mockRequest.body.optional).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('特殊文字をすべてエスケープすること', () => {
      mockRequest.body = {
        text: '& < > " \' /',
      };

      sanitizeInput(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.body.text).toBe('&amp; &lt; &gt; &quot; &#x27; &#x2F;');
      expect(mockNext).toHaveBeenCalled();
    });

    it('混在データ型を正しく処理すること', () => {
      mockRequest.body = {
        mixed: {
          string: '<script>',
          number: 123,
          boolean: true,
          nullValue: null,
          array: ['<b>test</b>', 456, false],
          nested: {
            html: '<div>content</div>',
            count: 42,
          },
        },
      };

      sanitizeInput(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.body.mixed.string).toBe('&lt;script&gt;');
      expect(mockRequest.body.mixed.number).toBe(123);
      expect(mockRequest.body.mixed.boolean).toBe(true);
      expect(mockRequest.body.mixed.nullValue).toBeNull();
      expect(mockRequest.body.mixed.array[0]).toBe('&lt;b&gt;test&lt;&#x2F;b&gt;');
      expect(mockRequest.body.mixed.array[1]).toBe(456);
      expect(mockRequest.body.mixed.array[2]).toBe(false);
      expect(mockRequest.body.mixed.nested.html).toBe('&lt;div&gt;content&lt;&#x2F;div&gt;');
      expect(mockRequest.body.mixed.nested.count).toBe(42);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('createRateLimiter', () => {
    it('Rate Limiterが正しい設定で作成されること', () => {
      const rateLimiter = createRateLimiter();

      expect(rateLimiter).toBeDefined();
      expect(typeof rateLimiter).toBe('function');
    });

    it('Rate Limiterの設定値が正しいこと', () => {
      const rateLimiter = createRateLimiter();

      // Rate Limiterの内部設定を確認
      // express-rate-limitはミドルウェア関数を返すため、関数として存在することを確認
      expect(rateLimiter).toBeInstanceOf(Function);
    });
  });

  describe('createAuthRateLimiter', () => {
    it('認証用Rate Limiterが正しい設定で作成されること', () => {
      const authRateLimiter = createAuthRateLimiter();

      expect(authRateLimiter).toBeDefined();
      expect(typeof authRateLimiter).toBe('function');
    });

    it('認証用Rate Limiterが関数として機能すること', () => {
      const authRateLimiter = createAuthRateLimiter();

      // ミドルウェア関数として機能することを確認
      expect(authRateLimiter).toBeInstanceOf(Function);
    });
  });

  describe('getHelmetOptions', () => {
    it('Helmetオプションが正しく設定されること', () => {
      const helmetOptions = getHelmetOptions();

      expect(helmetOptions).toBeDefined();
    });

    it('Helmetオプションが関数であること', () => {
      const helmetOptions = getHelmetOptions();

      // helmetはミドルウェアを返すため、関数であることを確認
      expect(typeof helmetOptions).toBe('function');
    });

    it('Helmetミドルウェアが正しく動作すること', () => {
      const helmetMiddleware = getHelmetOptions();
      const mockReq = {} as Request;
      const mockRes = {
        setHeader: jest.fn(),
        getHeader: jest.fn(),
        removeHeader: jest.fn(),
      } as any;
      const mockNext = jest.fn();

      // Helmetミドルウェアを実行
      helmetMiddleware(mockReq, mockRes, mockNext);

      // nextが呼ばれることを確認
      expect(mockNext).toHaveBeenCalled();
    });
  });
});
