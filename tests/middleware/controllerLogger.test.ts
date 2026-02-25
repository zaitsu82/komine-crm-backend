import { Request, Response, NextFunction } from 'express';
import { withLogging } from '../../src/middleware/controllerLogger';

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

describe('controllerLogger - withLogging', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: jest.Mock;
  let consoleInfoSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

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

    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('START log (entry)', () => {
    it('should log entry with module, action, method, path, and user info', async () => {
      const controller = jest.fn((_req: Request, res: Response) => {
        res.json({ success: true, data: {} });
      });

      const wrapped = withLogging('Plots', 'getPlots', controller);
      await wrapped(mockReq, mockRes, mockNext);

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Plots] getPlots START: GET /api/v1/plots')
      );
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('staff_id=1, role=admin')
      );
    });

    it('should log anonymous when no user is set', async () => {
      mockReq.user = undefined;
      const controller = jest.fn((_req: Request, res: Response) => {
        res.json({ success: true, data: {} });
      });

      const wrapped = withLogging('Auth', 'login', controller);
      await wrapped(mockReq, mockRes, mockNext);

      expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('user={anonymous}'));
    });

    it('should log request body keys', async () => {
      mockReq.method = 'POST';
      mockReq.body = { email: 'test@example.com', password: 'secret' };
      const controller = jest.fn((_req: Request, res: Response) => {
        res.json({ success: true, data: {} });
      });

      const wrapped = withLogging('Auth', 'login', controller);
      await wrapped(mockReq, mockRes, mockNext);

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('body_keys=[email,password]')
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

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Plots] getPlotById END: status=200')
      );
      expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('success=true'));
    });

    it('should include duration in the end log', async () => {
      const controller = jest.fn((_req: Request, res: Response) => {
        res.json({ success: true, data: {} });
      });

      const wrapped = withLogging('Staff', 'getStaffList', controller);
      await wrapped(mockReq, mockRes, mockNext);

      // Check that END log contains duration pattern
      const endLog = consoleInfoSpy.mock.calls.find(
        (call: any[]) => typeof call[0] === 'string' && call[0].includes('END:')
      );
      expect(endLog).toBeTruthy();
      expect(endLog![0]).toMatch(/duration=\d+ms/);
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

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Plots] createPlot END: status=400')
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('success=false'));
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('error_code=VALIDATION_ERROR')
      );
    });

    it('should log UNKNOWN error_code when error object has no code', async () => {
      const controller = jest.fn((_req: Request, res: Response) => {
        res.statusCode = 500;
        res.json({ success: false, error: { message: 'Something failed' } });
      });

      const wrapped = withLogging('Auth', 'login', controller);
      await wrapped(mockReq, mockRes, mockNext);

      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('error_code=UNKNOWN'));
    });
  });

  describe('ERROR log (exception)', () => {
    it('should log error when controller throws', async () => {
      const controller = jest.fn(() => {
        throw new Error('Database connection failed');
      });

      const wrapped = withLogging('Plots', 'createPlot', controller);
      await wrapped(mockReq, mockRes, mockNext);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Plots] createPlot ERROR:')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('error=Database connection failed')
      );
      // Should call next(error) for Express error handler
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should log error when controller rejects', async () => {
      const controller = jest.fn(async () => {
        throw new Error('Async error');
      });

      const wrapped = withLogging('Staff', 'createStaff', controller);
      await wrapped(mockReq, mockRes, mockNext);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Staff] createStaff ERROR:')
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

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Plots] updatePlot ERROR:')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('error=Validation failed')
      );
      // Original next should be called
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should not log error when controller calls next() without error', async () => {
      const controller = jest.fn((_req: Request, _res: Response, next: NextFunction) => {
        next();
      });

      const wrapped = withLogging('Auth', 'logout', controller);
      await wrapped(mockReq, mockRes, mockNext);

      expect(consoleErrorSpy).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(undefined);
    });
  });

  describe('deduplication', () => {
    it('should not log END twice if res.json is called multiple times', async () => {
      const controller = jest.fn((_req: Request, res: Response) => {
        res.json({ success: true, data: {} });
        // Simulate accidental second call
        res.json({ success: true, data: {} });
      });

      const wrapped = withLogging('Masters', 'getAllMasters', controller);
      await wrapped(mockReq, mockRes, mockNext);

      const endLogs = consoleInfoSpy.mock.calls.filter(
        (call: any[]) => typeof call[0] === 'string' && call[0].includes('END:')
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

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Plots] createPlot START:')
      );
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Plots] createPlot END: status=201')
      );
    });

    it('should work with (req, res, next) pattern', async () => {
      const controller = jest.fn(async (_req: Request, res: Response, _next: NextFunction) => {
        res.statusCode = 200;
        res.json({ success: true, data: [] });
      });

      const wrapped = withLogging('Staff', 'getStaffList', controller);
      await wrapped(mockReq, mockRes, mockNext);

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Staff] getStaffList START:')
      );
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Staff] getStaffList END: status=200')
      );
    });
  });
});
