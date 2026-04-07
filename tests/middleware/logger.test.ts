import { Request, Response, NextFunction } from 'express';
import { EventEmitter } from 'events';
import { requestLogger, securityHeaders } from '../../src/middleware/logger';
import { getRequestLogger } from '../../src/utils/logger';

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

const mockLog = getRequestLogger() as unknown as {
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
};

describe('Logger Middleware', () => {
  let mockRequest: any;
  let mockResponse: any;
  let mockNext: NextFunction;

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
  });

  describe('requestLogger', () => {
    it('リクエストをログに記録すること（成功レスポンス）', (done) => {
      requestLogger(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();

      mockResponse.emit('finish');

      setImmediate(() => {
        expect(mockLog.info).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'GET',
            path: '/test',
            statusCode: 200,
            user: 'anonymous',
          }),
          'HTTP request completed'
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
        expect(mockLog.info).toHaveBeenCalledWith(
          expect.objectContaining({
            user: 'テストユーザー (test@example.com)',
          }),
          'HTTP request completed'
        );
        done();
      });
    });

    it('400番台のエラーをWARNレベルでログに記録すること', (done) => {
      mockResponse.statusCode = 404;

      requestLogger(mockRequest as Request, mockResponse as Response, mockNext);

      mockResponse.emit('finish');

      setImmediate(() => {
        expect(mockLog.warn).toHaveBeenCalledWith(
          expect.objectContaining({ statusCode: 404 }),
          'HTTP request completed with client error'
        );
        expect(mockLog.info).not.toHaveBeenCalled();
        expect(mockLog.error).not.toHaveBeenCalled();
        done();
      });
    });

    it('500番台のエラーをERRORレベルでログに記録すること', (done) => {
      mockResponse.statusCode = 500;

      requestLogger(mockRequest as Request, mockResponse as Response, mockNext);

      mockResponse.emit('finish');

      setImmediate(() => {
        expect(mockLog.error).toHaveBeenCalledWith(
          expect.objectContaining({ statusCode: 500 }),
          'HTTP request completed with server error'
        );
        expect(mockLog.info).not.toHaveBeenCalled();
        expect(mockLog.warn).not.toHaveBeenCalled();
        done();
      });
    });

    it('レスポンス時間を記録すること', (done) => {
      requestLogger(mockRequest as Request, mockResponse as Response, mockNext);

      setTimeout(() => {
        mockResponse.emit('finish');

        setImmediate(() => {
          expect(mockLog.info).toHaveBeenCalledWith(
            expect.objectContaining({
              duration: expect.any(Number),
            }),
            expect.any(String)
          );
          done();
        });
      }, 10);
    });

    it('IPアドレスを記録すること', (done) => {
      requestLogger(mockRequest as Request, mockResponse as Response, mockNext);

      mockResponse.emit('finish');

      setImmediate(() => {
        expect(mockLog.info).toHaveBeenCalledWith(
          expect.objectContaining({ ip: '127.0.0.1' }),
          expect.any(String)
        );
        done();
      });
    });

    it('req.ipがない場合、socket.remoteAddressを使用すること', (done) => {
      mockRequest.ip = undefined;

      requestLogger(mockRequest as Request, mockResponse as Response, mockNext);

      mockResponse.emit('finish');

      setImmediate(() => {
        expect(mockLog.info).toHaveBeenCalledWith(
          expect.objectContaining({ ip: '192.168.1.1' }),
          expect.any(String)
        );
        done();
      });
    });

    it('User-Agentを記録すること', (done) => {
      requestLogger(mockRequest as Request, mockResponse as Response, mockNext);

      mockResponse.emit('finish');

      setImmediate(() => {
        expect(mockLog.info).toHaveBeenCalledWith(
          expect.objectContaining({ userAgent: 'test-agent' }),
          expect.any(String)
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
