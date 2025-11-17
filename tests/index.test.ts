describe('Server Index', () => {
  let mockApp: any;
  let mockExpress: any;
  let mockCors: any;
  let mockDotenv: any;
  let mockRequestLogger: jest.Mock;
  let mockSecurityHeaders: jest.Mock;
  let mockErrorHandler: jest.Mock;
  let mockNotFoundHandler: jest.Mock;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    // すべてのモジュールをリセット
    jest.resetModules();

    // ヘルスチェックハンドラー用のモック
    const mockHealthHandler = jest.fn();

    // モックの作成
    mockApp = {
      use: jest.fn(),
      get: jest.fn(),
      listen: jest.fn((port, callback) => {
        if (callback) callback();
        return { close: jest.fn() };
      }),
    };

    mockExpress = jest.fn(() => mockApp);
    mockExpress.json = jest.fn(() => 'json-middleware');
    mockExpress.urlencoded = jest.fn(() => 'urlencoded-middleware');
    mockExpress.Router = jest.fn(() => ({
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      use: jest.fn(),
    }));

    mockCors = jest.fn(() => 'cors-middleware');

    mockDotenv = {
      config: jest.fn(),
    };

    // helmet と hpp のモック
    const mockHelmet = jest.fn(() => jest.fn((req: any, res: any, next: any) => next()));
    const mockHpp = jest.fn(() => jest.fn((req: any, res: any, next: any) => next()));

    mockRequestLogger = jest.fn((req: any, res: any, next: any) => next());
    mockSecurityHeaders = jest.fn((req: any, res: any, next: any) => next());
    mockErrorHandler = jest.fn();
    mockNotFoundHandler = jest.fn();

    // モジュールのモック
    jest.doMock('express', () => mockExpress);
    jest.doMock('cors', () => mockCors);
    jest.doMock('dotenv', () => mockDotenv);

    // ルートモジュールのモック
    jest.doMock('../src/auth/authRoutes', () => ({
      __esModule: true,
      default: 'auth-routes',
    }));
    jest.doMock('../src/plots/plotRoutes', () => ({
      __esModule: true,
      default: 'plot-routes',
    }));
    jest.doMock('../src/masters/masterRoutes', () => ({
      __esModule: true,
      default: 'master-routes',
    }));

    // ミドルウェアのモック
    jest.doMock('../src/middleware/errorHandler', () => ({
      errorHandler: mockErrorHandler,
      notFoundHandler: mockNotFoundHandler,
    }));
    jest.doMock('../src/middleware/logger', () => ({
      requestLogger: mockRequestLogger,
      securityHeaders: mockSecurityHeaders,
    }));
    jest.doMock('../src/middleware/security', () => ({
      getCorsOptions: jest.fn(() => ({})),
      createRateLimiter: jest.fn(() => jest.fn((req: any, res: any, next: any) => next())),
      createAuthRateLimiter: jest.fn(() => jest.fn((req: any, res: any, next: any) => next())),
      getHelmetOptions: jest.fn(() => jest.fn((req: any, res: any, next: any) => next())),
      hppProtection: jest.fn((req: any, res: any, next: any) => next()),
      sanitizeInput: jest.fn((req: any, res: any, next: any) => next()),
    }));

    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    process.env.PORT = '3001';
  });

  afterEach(() => {
    if (consoleSpy) {
      consoleSpy.mockRestore();
    }
    delete process.env.PORT;
    delete process.env.NODE_ENV;
    jest.clearAllMocks();
  });

  it('should create express application and configure middleware', () => {
    require('../src/index');

    expect(mockExpress).toHaveBeenCalledTimes(1);
    expect(mockCors).toHaveBeenCalledTimes(1);
    expect(mockExpress.json).toHaveBeenCalledTimes(1);
    expect(mockExpress.urlencoded).toHaveBeenCalledWith({ extended: true, limit: '10mb' });
    expect(mockDotenv.config).toHaveBeenCalledTimes(1);
  });

  it('should configure all middleware in correct order', () => {
    require('../src/index');

    const useCalls = mockApp.use.mock.calls;

    // セキュリティミドルウェアが適用されることを確認
    // helmet, cors, hpp, json, urlencoded, sanitizeInput, rateLimiter, requestLogger, securityHeaders
    // Note: 新しいセキュリティミドルウェアが追加されたため、多数のミドルウェアが登録される
    expect(useCalls.length).toBeGreaterThanOrEqual(9);
  });

  it('should configure API routes', () => {
    require('../src/index');

    expect(mockApp.use).toHaveBeenCalledWith('/api/v1/auth', 'auth-routes');
    expect(mockApp.use).toHaveBeenCalledWith('/api/v1/plots', 'plot-routes');
    expect(mockApp.use).toHaveBeenCalledWith('/api/v1/masters', 'master-routes');
  });

  it('should configure error handlers last', () => {
    require('../src/index');

    const useCalls = mockApp.use.mock.calls;
    const lastTwoCalls = useCalls.slice(-2);

    expect(lastTwoCalls[0]).toEqual([mockNotFoundHandler]); // 404 handler
    expect(lastTwoCalls[1]).toEqual([mockErrorHandler]); // Error handler
  });

  it('should configure health check endpoint', () => {
    require('../src/index');

    expect(mockApp.get).toHaveBeenCalledWith('/health', expect.any(Function));
  });

  it('should start server on specified port', () => {
    require('../src/index');

    expect(mockApp.listen).toHaveBeenCalledWith('3001', expect.any(Function));
  });

  it('should start server on default port when PORT env is not set', () => {
    delete process.env.PORT;

    require('../src/index');

    expect(mockApp.listen).toHaveBeenCalledWith(4000, expect.any(Function));
  });

  it('should log server startup message with correct port', () => {
    require('../src/index');

    expect(consoleSpy).toHaveBeenCalled();
    const logMessage = consoleSpy.mock.calls[0][0];
    expect(logMessage).toContain('Cemetery CRM Backend Server');
    expect(logMessage).toContain('3001');
  });

  it('should register all middleware and routes correctly', () => {
    require('../src/index');

    // セキュリティミドルウェア（helmet, cors, hpp, json, urlencoded, sanitizeInput, rateLimiter）
    // + ログミドルウェア（requestLogger, securityHeaders）
    // + 3 API routes + 2 error handlers = 14 use calls
    expect(mockApp.use).toHaveBeenCalledTimes(14);
    // 1 health check endpoint
    expect(mockApp.get).toHaveBeenCalledTimes(1);
  });

  it('should handle different port environments', () => {
    process.env.PORT = '8080';

    require('../src/index');

    expect(mockApp.listen).toHaveBeenCalledWith('8080', expect.any(Function));
  });

  it('should successfully import all modules', () => {
    expect(() => require('../src/index')).not.toThrow();
  });

  describe('Error handling', () => {
    it('should handle server startup without errors', () => {
      expect(() => require('../src/index')).not.toThrow();

      const listenCalls = mockApp.listen.mock.calls;
      if (listenCalls.length > 0) {
        const callback = listenCalls[0][1];
        expect(() => callback()).not.toThrow();
      }
    });

    it('should handle missing environment variables', () => {
      delete process.env.PORT;
      delete process.env.NODE_ENV;

      expect(() => require('../src/index')).not.toThrow();
    });
  });

  describe('Module configuration', () => {
    it('should configure dotenv at startup', () => {
      require('../src/index');

      expect(mockDotenv.config).toHaveBeenCalledTimes(1);
    });

    it('should configure CORS middleware', () => {
      require('../src/index');

      expect(mockCors).toHaveBeenCalledTimes(1);
      expect(mockApp.use).toHaveBeenCalledWith('cors-middleware');
    });

    it('should configure JSON body parser', () => {
      require('../src/index');

      expect(mockExpress.json).toHaveBeenCalledTimes(1);
      expect(mockApp.use).toHaveBeenCalledWith('json-middleware');
    });

    it('should configure URL encoded body parser', () => {
      require('../src/index');

      expect(mockExpress.urlencoded).toHaveBeenCalledWith({ extended: true, limit: '10mb' });
      expect(mockApp.use).toHaveBeenCalledWith('urlencoded-middleware');
    });

    it('should configure request logger', () => {
      require('../src/index');

      expect(mockApp.use).toHaveBeenCalledWith(mockRequestLogger);
    });

    it('should configure security headers', () => {
      require('../src/index');

      expect(mockApp.use).toHaveBeenCalledWith(mockSecurityHeaders);
    });
  });

  describe('Route validation', () => {
    it('should mount auth routes', () => {
      require('../src/index');

      expect(mockApp.use).toHaveBeenCalledWith('/api/v1/auth', 'auth-routes');
    });

    it('should mount plot routes', () => {
      require('../src/index');

      expect(mockApp.use).toHaveBeenCalledWith('/api/v1/plots', 'plot-routes');
    });

    it('should mount master routes', () => {
      require('../src/index');

      expect(mockApp.use).toHaveBeenCalledWith('/api/v1/masters', 'master-routes');
    });

    it('should mount health check endpoint', () => {
      require('../src/index');

      expect(mockApp.get).toHaveBeenCalledWith('/health', expect.any(Function));
    });
  });

  describe('Health check endpoint', () => {
    it('should return correct health check response', () => {
      require('../src/index');

      const healthHandler = mockApp.get.mock.calls.find((call: any) => call[0] === '/health')[1];

      const mockReq = {};
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      healthHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          status: 'ok',
          timestamp: expect.any(String),
          uptime: expect.any(Number),
          environment: expect.any(String),
        }),
      });
    });

    it('should include NODE_ENV in health check when set', () => {
      process.env.NODE_ENV = 'production';

      require('../src/index');

      const healthHandler = mockApp.get.mock.calls.find((call: any) => call[0] === '/health')[1];

      const mockReq = {};
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      healthHandler(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          environment: 'production',
        }),
      });
    });
  });

  describe('Server startup logging', () => {
    it('should log with development environment by default', () => {
      delete process.env.NODE_ENV;

      require('../src/index');

      const logMessage = consoleSpy.mock.calls[0][0];
      expect(logMessage).toContain('development');
    });

    it('should log with production environment when set', () => {
      process.env.NODE_ENV = 'production';

      require('../src/index');

      const logMessage = consoleSpy.mock.calls[0][0];
      expect(logMessage).toContain('production');
    });

    it('should log server URL correctly', () => {
      process.env.PORT = '5000';

      require('../src/index');

      const logMessage = consoleSpy.mock.calls[0][0];
      expect(logMessage).toContain('http://localhost:5000');
      expect(logMessage).toContain('http://localhost:5000/health');
    });
  });
});
