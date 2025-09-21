describe('Server Index', () => {
  let mockApp: any;
  let mockExpress: any;
  let mockCors: any;
  let mockDotenv: any;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    // すべてのモジュールをリセット
    jest.resetModules();

    // モックの作成
    mockApp = {
      use: jest.fn(),
      listen: jest.fn((port, callback) => {
        if (callback) callback();
        return { close: jest.fn() };
      })
    };

    mockExpress = jest.fn(() => mockApp);
    mockExpress.json = jest.fn(() => 'json-middleware');

    mockCors = jest.fn(() => 'cors-middleware');

    mockDotenv = {
      config: jest.fn()
    };

    // モジュールのモック
    jest.doMock('express', () => mockExpress);
    jest.doMock('cors', () => mockCors);
    jest.doMock('dotenv', () => mockDotenv);

    // ルートモジュールのモック
    jest.doMock('../src/auth/authRoutes', () => ({ default: 'auth-routes' }));
    jest.doMock('../src/masters/mastersRoutes', () => ({ default: 'masters-routes' }));
    jest.doMock('../src/validations/validationRoutes', () => ({ default: 'validation-routes' }));
    jest.doMock('../src/family-contacts/familyContactRoutes', () => ({ default: 'family-contact-routes' }));
    jest.doMock('../src/burials/burialRoutes', () => ({ default: 'burial-routes' }));
    jest.doMock('../src/constructions/constructionRoutes', () => ({ default: 'construction-routes' }));
    jest.doMock('../src/gravestones/gravestoneRoutes', () => ({ default: 'gravestone-routes' }));
    jest.doMock('../src/applicants/applicantRoutes', () => ({ default: 'applicant-routes' }));
    jest.doMock('../src/contractors/contractorRoutes', () => ({ default: 'contractor-routes' }));
    jest.doMock('../src/usage-fees/usageFeeRoutes', () => ({ default: 'usage-fee-routes' }));
    jest.doMock('../src/management-fees/managementFeeRoutes', () => ({ default: 'management-fee-routes' }));
    jest.doMock('../src/billing-infos/billingInfoRoutes', () => ({ default: 'billing-info-routes' }));

    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    process.env.PORT = '3001';
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    delete process.env.PORT;
    jest.clearAllMocks();
  });

  it('should create express application and configure middleware', () => {
    require('../src/index');

    expect(mockExpress).toHaveBeenCalledTimes(1);
    expect(mockCors).toHaveBeenCalledTimes(1);
    expect(mockExpress.json).toHaveBeenCalledTimes(1);
    expect(mockDotenv.config).toHaveBeenCalledTimes(1);
  });

  it('should configure all API routes', () => {
    require('../src/index');

    expect(mockApp.use).toHaveBeenCalledWith('/api/v1/auth', { default: 'auth-routes' });
    expect(mockApp.use).toHaveBeenCalledWith('/api/v1/masters', { default: 'masters-routes' });
    expect(mockApp.use).toHaveBeenCalledWith('/api/v1/validations', { default: 'validation-routes' });
    expect(mockApp.use).toHaveBeenCalledWith('/api/v1/gravestones', { default: 'gravestone-routes' });
    expect(mockApp.use).toHaveBeenCalledWith('/api/v1/applicants', { default: 'applicant-routes' });
    expect(mockApp.use).toHaveBeenCalledWith('/api/v1/contractors', { default: 'contractor-routes' });
    expect(mockApp.use).toHaveBeenCalledWith('/api/v1/usage-fees', { default: 'usage-fee-routes' });
    expect(mockApp.use).toHaveBeenCalledWith('/api/v1/management-fees', { default: 'management-fee-routes' });
    expect(mockApp.use).toHaveBeenCalledWith('/api/v1/billing-infos', { default: 'billing-info-routes' });
    expect(mockApp.use).toHaveBeenCalledWith('/api/v1/family-contacts', { default: 'family-contact-routes' });
    expect(mockApp.use).toHaveBeenCalledWith('/api/v1/burials', { default: 'burial-routes' });
    expect(mockApp.use).toHaveBeenCalledWith('/api/v1/constructions', { default: 'construction-routes' });
  });

  it('should start server on specified port', () => {
    require('../src/index');

    expect(mockApp.listen).toHaveBeenCalledWith(
      '3001',
      expect.any(Function)
    );
  });

  it('should start server on default port when PORT env is not set', () => {
    delete process.env.PORT;

    require('../src/index');

    expect(mockApp.listen).toHaveBeenCalledWith(
      4000,
      expect.any(Function)
    );
  });

  it('should log server startup message', () => {
    require('../src/index');

    expect(consoleSpy).toHaveBeenCalledWith(
      'Cemetery CRM Server is running on http://localhost:3001'
    );
  });

  it('should configure middleware in correct order', () => {
    require('../src/index');

    const calls = mockApp.use.mock.calls;

    expect(calls[0]).toEqual(['cors-middleware']);
    expect(calls[1]).toEqual(['json-middleware']);
    expect(calls[2]).toEqual(['/api/v1/auth', { default: 'auth-routes' }]);
  });

  it('should register all routes and middleware', () => {
    require('../src/index');

    // 2つのミドルウェア + 12個のAPIルート = 14回の呼び出し
    expect(mockApp.use).toHaveBeenCalledTimes(14);
  });

  it('should handle different port environments', () => {
    process.env.PORT = '8080';

    require('../src/index');

    expect(mockApp.listen).toHaveBeenCalledWith(
      '8080',
      expect.any(Function)
    );
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
  });

  describe('Route validation', () => {
    it('should mount auth routes', () => {
      require('../src/index');

      expect(mockApp.use).toHaveBeenCalledWith('/api/v1/auth', { default: 'auth-routes' });
    });

    it('should mount all business logic routes', () => {
      require('../src/index');

      const businessRoutes = [
        '/api/v1/gravestones',
        '/api/v1/applicants',
        '/api/v1/contractors',
        '/api/v1/usage-fees',
        '/api/v1/management-fees',
        '/api/v1/billing-infos',
        '/api/v1/family-contacts',
        '/api/v1/burials',
        '/api/v1/constructions'
      ];

      businessRoutes.forEach(route => {
        expect(mockApp.use).toHaveBeenCalledWith(
          route,
          expect.objectContaining({ default: expect.any(String) })
        );
      });
    });

    it('should mount utility routes', () => {
      require('../src/index');

      expect(mockApp.use).toHaveBeenCalledWith('/api/v1/masters', { default: 'masters-routes' });
      expect(mockApp.use).toHaveBeenCalledWith('/api/v1/validations', { default: 'validation-routes' });
    });
  });
});