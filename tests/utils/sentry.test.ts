import * as Sentry from '@sentry/node';
import {
  initializeSentry,
  setSentryUser,
  clearSentryUser,
  setSentryTag,
  setSentryContext,
  captureException,
  captureMessage,
} from '../../src/utils/sentry';

// Sentryモジュールをモック
jest.mock('@sentry/node', () => ({
  init: jest.fn(),
  setUser: jest.fn(),
  setTag: jest.fn(),
  setContext: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  withScope: jest.fn(),
  expressIntegration: jest.fn(() => 'express-integration'),
}));
jest.mock('@sentry/profiling-node', () => ({
  nodeProfilingIntegration: jest.fn(() => 'profiling-integration'),
}));

describe('Sentry Utilities', () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    delete process.env['SENTRY_DSN'];
    delete process.env['SENTRY_ENVIRONMENT'];
    delete process.env['NODE_ENV'];
    delete process.env['SENTRY_TRACES_SAMPLE_RATE'];
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('initializeSentry', () => {
    it('should not initialize Sentry when DSN is not configured', () => {
      initializeSentry();

      expect(Sentry.init).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Sentry DSN not configured. Skipping Sentry initialization.'
      );
    });

    it('should initialize Sentry with default configuration', () => {
      process.env['SENTRY_DSN'] = 'https://test@sentry.io/123';

      initializeSentry();

      expect(Sentry.init).toHaveBeenCalledWith(
        expect.objectContaining({
          dsn: 'https://test@sentry.io/123',
          environment: 'development',
          tracesSampleRate: 1.0,
          profilesSampleRate: 1.0,
          integrations: ['express-integration', 'profiling-integration'],
        })
      );
    });

    it('should initialize Sentry with custom environment', () => {
      process.env['SENTRY_DSN'] = 'https://test@sentry.io/123';
      process.env['SENTRY_ENVIRONMENT'] = 'production';

      initializeSentry();

      expect(Sentry.init).toHaveBeenCalledWith(
        expect.objectContaining({
          environment: 'production',
        })
      );
    });

    it('should initialize Sentry with custom traces sample rate', () => {
      process.env['SENTRY_DSN'] = 'https://test@sentry.io/123';
      process.env['SENTRY_TRACES_SAMPLE_RATE'] = '0.3';

      initializeSentry();

      expect(Sentry.init).toHaveBeenCalledWith(
        expect.objectContaining({
          tracesSampleRate: 0.3,
        })
      );
    });

    it('should use NODE_ENV when SENTRY_ENVIRONMENT is not set', () => {
      process.env['SENTRY_DSN'] = 'https://test@sentry.io/123';
      process.env['NODE_ENV'] = 'staging';

      initializeSentry();

      expect(Sentry.init).toHaveBeenCalledWith(
        expect.objectContaining({
          environment: 'staging',
        })
      );
    });

    it('should filter password fields in beforeSend hook', () => {
      process.env['SENTRY_DSN'] = 'https://test@sentry.io/123';
      process.env['SENTRY_ENVIRONMENT'] = 'production'; // 本番環境で実行

      initializeSentry();

      const initCall = (Sentry.init as jest.Mock).mock.calls[0][0];
      const beforeSend = initCall.beforeSend;

      const event = {
        request: {
          data: {
            email: 'test@example.com',
            password: 'secret123',
            newPassword: 'newsecret456',
            currentPassword: 'oldsecret789',
          },
        },
      };

      const result = beforeSend(event, {});

      expect(result.request.data).toEqual({
        email: 'test@example.com',
        password: '[FILTERED]',
        newPassword: '[FILTERED]',
        currentPassword: '[FILTERED]',
      });
    });

    it('should not send events in development environment', () => {
      process.env['SENTRY_DSN'] = 'https://test@sentry.io/123';
      process.env['SENTRY_ENVIRONMENT'] = 'development';

      initializeSentry();

      const initCall = (Sentry.init as jest.Mock).mock.calls[0][0];
      const beforeSend = initCall.beforeSend;

      const event = { message: 'test error' };
      const result = beforeSend(event, {});

      expect(result).toBeNull();
      expect(consoleLogSpy).toHaveBeenCalledWith('Sentry event (not sent in development):', event);
    });
  });

  describe('setSentryUser', () => {
    it('should set user information in Sentry', () => {
      const user = {
        id: 42,
        email: 'user@example.com',
        name: 'Test User',
        role: 'admin',
      };

      setSentryUser(user);

      expect(Sentry.setUser).toHaveBeenCalledWith({
        id: '42',
        email: 'user@example.com',
        username: 'Test User',
        role: 'admin',
      });
    });
  });

  describe('clearSentryUser', () => {
    it('should clear user information in Sentry', () => {
      clearSentryUser();

      expect(Sentry.setUser).toHaveBeenCalledWith(null);
    });
  });

  describe('setSentryTag', () => {
    it('should set a tag in Sentry', () => {
      setSentryTag('endpoint', '/api/v1/plots');

      expect(Sentry.setTag).toHaveBeenCalledWith('endpoint', '/api/v1/plots');
    });
  });

  describe('setSentryContext', () => {
    it('should set context in Sentry', () => {
      const context = { userId: 123, action: 'create' };

      setSentryContext('business', context);

      expect(Sentry.setContext).toHaveBeenCalledWith('business', context);
    });
  });

  describe('captureException', () => {
    it('should capture exception without context', () => {
      const error = new Error('Test error');

      captureException(error);

      expect(Sentry.captureException).toHaveBeenCalledWith(error);
    });

    it('should capture exception with context', () => {
      const error = new Error('Test error');
      const context = { userId: 123, endpoint: '/api/v1/plots' };

      const mockScope = {
        setExtra: jest.fn(),
      };
      (Sentry.withScope as jest.Mock).mockImplementation((callback) => {
        callback(mockScope);
      });

      captureException(error, context);

      expect(Sentry.withScope).toHaveBeenCalled();
      expect(mockScope.setExtra).toHaveBeenCalledWith('userId', 123);
      expect(mockScope.setExtra).toHaveBeenCalledWith('endpoint', '/api/v1/plots');
      expect(Sentry.captureException).toHaveBeenCalledWith(error);
    });
  });

  describe('captureMessage', () => {
    it('should capture message with default info level', () => {
      captureMessage('Test message');

      expect(Sentry.captureMessage).toHaveBeenCalledWith('Test message', 'info');
    });

    it('should capture message with custom level', () => {
      captureMessage('Warning message', 'warning');

      expect(Sentry.captureMessage).toHaveBeenCalledWith('Warning message', 'warning');
    });
  });
});
