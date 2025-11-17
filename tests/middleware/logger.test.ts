import { Request, Response, NextFunction } from 'express';
import { EventEmitter } from 'events';
import { requestLogger, securityHeaders } from '../../src/middleware/logger';

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

describe('Logger Middleware', () => {
  let mockRequest: any;
  let mockResponse: any;
  let mockNext: NextFunction;
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    mockRequest = {
      method: 'GET',
      path: '/test',
      headers: {
        'user-agent': 'test-agent',
      },
      ip: '127.0.0.1',
      socket: {
        remoteAddress: '192.168.1.1',
      },
    };

    mockResponse = Object.assign(new EventEmitter(), {
      statusCode: 200,
      setHeader: jest.fn(),
    });

    mockNext = jest.fn();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('requestLogger', () => {
    it('リクエストをログに記録すること（成功レスポンス）', (done) => {
      requestLogger(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();

      // レスポンス完了イベントを発火
      mockResponse.emit('finish');

      // 非同期処理の完了を待つ
      setImmediate(() => {
        expect(consoleLogSpy).toHaveBeenCalledWith(
          '[INFO]',
          expect.stringContaining('"method":"GET"')
        );
        expect(consoleLogSpy).toHaveBeenCalledWith(
          '[INFO]',
          expect.stringContaining('"path":"/test"')
        );
        expect(consoleLogSpy).toHaveBeenCalledWith(
          '[INFO]',
          expect.stringContaining('"statusCode":200')
        );
        expect(consoleLogSpy).toHaveBeenCalledWith(
          '[INFO]',
          expect.stringContaining('"user":"anonymous"')
        );
        done();
      });
    });

    it('リクエストをログに記録すること（認証済みユーザー）', (done) => {
      mockRequest.user = {
        id: 1,
        email: 'test@example.com',
        name: 'テストユーザー',
        role: 'admin',
        is_active: true,
        supabase_uid: 'test-uid',
      };

      requestLogger(mockRequest as Request, mockResponse as Response, mockNext);

      mockResponse.emit('finish');

      setImmediate(() => {
        expect(consoleLogSpy).toHaveBeenCalledWith(
          '[INFO]',
          expect.stringContaining('"user":"テストユーザー (test@example.com)"')
        );
        done();
      });
    });

    it('400番台のエラーをWARNレベルでログに記録すること', (done) => {
      mockResponse.statusCode = 404;

      requestLogger(mockRequest as Request, mockResponse as Response, mockNext);

      mockResponse.emit('finish');

      setImmediate(() => {
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          '[WARN]',
          expect.stringContaining('"statusCode":404')
        );
        expect(consoleLogSpy).not.toHaveBeenCalled();
        expect(consoleErrorSpy).not.toHaveBeenCalled();
        done();
      });
    });

    it('500番台のエラーをERRORレベルでログに記録すること', (done) => {
      mockResponse.statusCode = 500;

      requestLogger(mockRequest as Request, mockResponse as Response, mockNext);

      mockResponse.emit('finish');

      setImmediate(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          '[ERROR]',
          expect.stringContaining('"statusCode":500')
        );
        expect(consoleLogSpy).not.toHaveBeenCalled();
        expect(consoleWarnSpy).not.toHaveBeenCalled();
        done();
      });
    });

    it('レスポンス時間を記録すること', (done) => {
      requestLogger(mockRequest as Request, mockResponse as Response, mockNext);

      // 少し待ってからレスポンス完了
      setTimeout(() => {
        mockResponse.emit('finish');

        setImmediate(() => {
          expect(consoleLogSpy).toHaveBeenCalledWith(
            '[INFO]',
            expect.stringMatching(/"duration":"\d+ms"/)
          );
          done();
        });
      }, 10);
    });

    it('IPアドレスを記録すること', (done) => {
      requestLogger(mockRequest as Request, mockResponse as Response, mockNext);

      mockResponse.emit('finish');

      setImmediate(() => {
        expect(consoleLogSpy).toHaveBeenCalledWith(
          '[INFO]',
          expect.stringContaining('"ip":"127.0.0.1"')
        );
        done();
      });
    });

    it('req.ipがない場合、socket.remoteAddressを使用すること', (done) => {
      mockRequest.ip = undefined;

      requestLogger(mockRequest as Request, mockResponse as Response, mockNext);

      mockResponse.emit('finish');

      setImmediate(() => {
        expect(consoleLogSpy).toHaveBeenCalledWith(
          '[INFO]',
          expect.stringContaining('"ip":"192.168.1.1"')
        );
        done();
      });
    });

    it('User-Agentを記録すること', (done) => {
      requestLogger(mockRequest as Request, mockResponse as Response, mockNext);

      mockResponse.emit('finish');

      setImmediate(() => {
        expect(consoleLogSpy).toHaveBeenCalledWith(
          '[INFO]',
          expect.stringContaining('"userAgent":"test-agent"')
        );
        done();
      });
    });
  });

  describe('securityHeaders', () => {
    it('セキュリティヘッダーを設定すること', () => {
      securityHeaders(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
      expect(mockNext).toHaveBeenCalled();
    });

    it('HTTPSリクエストの場合、Strict-Transport-Securityヘッダーを設定すること', () => {
      mockRequest.secure = true;

      securityHeaders(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains'
      );
    });

    it('HTTPリクエストの場合、Strict-Transport-Securityヘッダーを設定しないこと', () => {
      mockRequest.secure = false;

      securityHeaders(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.setHeader).not.toHaveBeenCalledWith(
        'Strict-Transport-Security',
        expect.any(String)
      );
    });
  });
});
