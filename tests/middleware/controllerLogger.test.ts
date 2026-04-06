import { Request, Response, NextFunction } from 'express';
import { withLogging } from '../../src/middleware/controllerLogger';
import { getRequestLogger } from '../../src/utils/logger';

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

describe('controllerLogger - withLogging', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockReq = {
      method: 'GET',
      path: '/api/v1/plots',
      originalUrl: '/api/v1/plots',
      body: {},
      user: {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin',
        is_active: true,
        supabase_uid: 'uid-123',
      },
    };

    const jsonFn = jest.fn().mockReturnThis();
    mockRes = {
      statusCode: 200,
      json: jsonFn,
      status: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  describe('START log (entry)', () => {
    it('should log entry with module, action, method, path, and user info', async () => {
      const controller = jest.fn((_req: Request, res: Response) => {
        res.json({ success: true, data: {} });
      });

      const wrapped = withLogging('Plots', 'getPlots', controller);
      await wrapped(mockReq, mockRes, mockNext);

      expect(mockLog.info).toHaveBeenCalledWith(
        expect.objectContaining({
          module: 'Plots',
          action: 'getPlots',
          method: 'GET',
          path: '/api/v1/plots',
          user: 'staff_id=1, role=admin',
        }),
        '[Plots] getPlots START'
      );
    });

    it('should log anonymous when no user is set', async () => {
      mockReq.user = undefined;
      const controller = jest.fn((_req: Request, res: Response) => {
        res.json({ success: true, data: {} });
      });

      const wrapped = withLogging('Auth', 'login', controller);
      await wrapped(mockReq, mockRes, mockNext);

      expect(mockLog.info).toHaveBeenCalledWith(
        expect.objectContaining({ user: 'anonymous' }),
        expect.stringContaining('START')
      );
    });

    it('should log request body keys', async () => {
      mockReq.method = 'POST';
      mockReq.body = { email: 'test@example.com', password: 'secret' };
      const controller = jest.fn((_req: Request, res: Response) => {
        res.json({ success: true, data: {} });
      });

      const wrapped = withLogging('Auth', 'login', controller);
      await wrapped(mockReq, mockRes, mockNext);

      expect(mockLog.info).toHaveBeenCalledWith(
        expect.objectContaining({ bodyKeys: 'email,password' }),
        expect.stringContaining('START')
      );
    });
  });

  describe('END log (success response)', () => {
    it('should log success when controller returns success: true', async () => {
      const controller = jest.fn((_req: Request, res: Response) => {
        res.statusCode = 200;
        res.json({ success: true, data: { id: 1 } });
      });

      const wrapped = withLogging('Plots', 'getPlotById', controller);
      await wrapped(mockReq, mockRes, mockNext);

      expect(mockLog.info).toHaveBeenCalledWith(
        expect.objectContaining({
          module: 'Plots',
          action: 'getPlotById',
          status: 200,
          success: true,
        }),
        '[Plots] getPlotById END'
      );
    });

    it('should include duration in the end log', async () => {
      const controller = jest.fn((_req: Request, res: Response) => {
        res.json({ success: true, data: {} });
      });

      const wrapped = withLogging('Staff', 'getStaffList', controller);
      await wrapped(mockReq, mockRes, mockNext);

      expect(mockLog.info).toHaveBeenCalledWith(
        expect.objectContaining({
          duration: expect.any(Number),
        }),
        expect.stringContaining('END')
      );
    });
  });

  describe('END log (failure response)', () => {
    it('should log warning when controller returns success: false', async () => {
      const controller = jest.fn((_req: Request, res: Response) => {
        res.statusCode = 400;
        res.json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: [] },
        });
      });

      const wrapped = withLogging('Plots', 'createPlot', controller);
      await wrapped(mockReq, mockRes, mockNext);

      expect(mockLog.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          module: 'Plots',
          action: 'createPlot',
          status: 400,
          success: false,
          errorCode: 'VALIDATION_ERROR',
        }),
        '[Plots] createPlot END'
      );
    });

    it('should log UNKNOWN error_code when error object has no code', async () => {
      const controller = jest.fn((_req: Request, res: Response) => {
        res.statusCode = 500;
        res.json({ success: false, error: { message: 'Something failed' } });
      });

      const wrapped = withLogging('Auth', 'login', controller);
      await wrapped(mockReq, mockRes, mockNext);

      expect(mockLog.warn).toHaveBeenCalledWith(
        expect.objectContaining({ errorCode: 'UNKNOWN' }),
        expect.any(String)
      );
    });
  });

  describe('ERROR log (exception)', () => {
    it('should log error when controller throws', async () => {
      const controller = jest.fn(() => {
        throw new Error('Database connection failed');
      });

      const wrapped = withLogging('Plots', 'createPlot', controller);
      await wrapped(mockReq, mockRes, mockNext);

      expect(mockLog.error).toHaveBeenCalledWith(
        expect.objectContaining({
          module: 'Plots',
          action: 'createPlot',
          err: 'Database connection failed',
        }),
        '[Plots] createPlot ERROR'
      );
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should log error when controller rejects', async () => {
      const controller = jest.fn(async () => {
        throw new Error('Async error');
      });

      const wrapped = withLogging('Staff', 'createStaff', controller);
      await wrapped(mockReq, mockRes, mockNext);

      expect(mockLog.error).toHaveBeenCalledWith(
        expect.objectContaining({
          module: 'Staff',
          action: 'createStaff',
          err: 'Async error',
        }),
        '[Staff] createStaff ERROR'
      );
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('next(error) pattern', () => {
    it('should log error when controller calls next(error)', async () => {
      const controller = jest.fn((_req: Request, _res: Response, next: NextFunction) => {
        next(new Error('Validation failed'));
      });

      const wrapped = withLogging('Plots', 'updatePlot', controller);
      await wrapped(mockReq, mockRes, mockNext);

      expect(mockLog.error).toHaveBeenCalledWith(
        expect.objectContaining({
          module: 'Plots',
          action: 'updatePlot',
          err: 'Validation failed',
        }),
        '[Plots] updatePlot ERROR'
      );
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should not log error when controller calls next() without error', async () => {
      const controller = jest.fn((_req: Request, _res: Response, next: NextFunction) => {
        next();
      });

      const wrapped = withLogging('Auth', 'logout', controller);
      await wrapped(mockReq, mockRes, mockNext);

      expect(mockLog.error).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(undefined);
    });
  });

  describe('deduplication', () => {
    it('should not log END twice if res.json is called multiple times', async () => {
      const controller = jest.fn((_req: Request, res: Response) => {
        res.json({ success: true, data: {} });
        res.json({ success: true, data: {} });
      });

      const wrapped = withLogging('Masters', 'getAllMasters', controller);
      await wrapped(mockReq, mockRes, mockNext);

      const endLogs = mockLog.info.mock.calls.filter(
        (call: any[]) => typeof call[1] === 'string' && call[1].includes('END')
      );
      expect(endLogs).toHaveLength(1);
    });
  });

  describe('both controller patterns', () => {
    it('should work with (req, res) pattern', async () => {
      const controller = jest.fn(async (_req: Request, res: Response) => {
        res.statusCode = 201;
        res.json({ success: true, data: { id: 1 } });
      });

      const wrapped = withLogging('Plots', 'createPlot', controller);
      await wrapped(mockReq, mockRes, mockNext);

      expect(mockLog.info).toHaveBeenCalledWith(
        expect.objectContaining({ module: 'Plots', action: 'createPlot' }),
        '[Plots] createPlot START'
      );
      expect(mockLog.info).toHaveBeenCalledWith(
        expect.objectContaining({ module: 'Plots', action: 'createPlot', status: 201 }),
        '[Plots] createPlot END'
      );
    });

    it('should work with (req, res, next) pattern', async () => {
      const controller = jest.fn(async (_req: Request, res: Response, _next: NextFunction) => {
        res.statusCode = 200;
        res.json({ success: true, data: [] });
      });

      const wrapped = withLogging('Staff', 'getStaffList', controller);
      await wrapped(mockReq, mockRes, mockNext);

      expect(mockLog.info).toHaveBeenCalledWith(
        expect.objectContaining({ module: 'Staff', action: 'getStaffList' }),
        '[Staff] getStaffList START'
      );
      expect(mockLog.info).toHaveBeenCalledWith(
        expect.objectContaining({ module: 'Staff', action: 'getStaffList', status: 200 }),
        '[Staff] getStaffList END'
      );
    });
  });
});
