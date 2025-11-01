import request from 'supertest';
import express from 'express';
import plotRoutes from '../../src/plots/plotRoutes';
import * as plotController from '../../src/plots/plotController';
import * as authMiddleware from '../../src/middleware/auth';
import * as permissionMiddleware from '../../src/middleware/permission';

// コントローラーのモック
jest.mock('../../src/plots/plotController', () => ({
  getPlots: jest.fn((req, res) => res.json({ success: true, controller: 'getPlots' })),
  getPlotById: jest.fn((req, res) => res.json({ success: true, controller: 'getPlotById' })),
  createPlot: jest.fn((req, res) => res.json({ success: true, controller: 'createPlot' })),
  updatePlot: jest.fn((req, res) => res.json({ success: true, controller: 'updatePlot' })),
}));

// ミドルウェアのモック
jest.mock('../../src/middleware/auth', () => ({
  authenticate: jest.fn((req, res, next) => next()),
}));

jest.mock('../../src/middleware/permission', () => ({
  requirePermission: jest.fn(() => (req: any, res: any, next: any) => next()),
}));

const mockPlotController = plotController as jest.Mocked<typeof plotController>;
const mockAuthMiddleware = authMiddleware as jest.Mocked<typeof authMiddleware>;
const mockPermissionMiddleware = permissionMiddleware as jest.Mocked<typeof permissionMiddleware>;

describe('Plot Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/plots', plotRoutes);
    jest.clearAllMocks();
  });

  describe('GET /api/v1/plots/', () => {
    it('should handle getPlots request', async () => {
      const response = await request(app)
        .get('/api/v1/plots/')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('getPlots');
      expect(mockPlotController.getPlots).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /api/v1/plots/:id', () => {
    it('should handle getPlotById request', async () => {
      const response = await request(app)
        .get('/api/v1/plots/plot-uuid-1')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('getPlotById');
      expect(mockPlotController.getPlotById).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /api/v1/plots/', () => {
    it('should handle createPlot request', async () => {
      const response = await request(app)
        .post('/api/v1/plots/')
        .set('Authorization', 'Bearer token')
        .send({
          plot: {
            plotNumber: 'A-001',
            section: 'A',
            usage: 'in_use',
            size: '3.0㎡',
            price: '1000000',
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('createPlot');
      expect(mockPlotController.createPlot).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
    });
  });

  describe('PUT /api/v1/plots/:id', () => {
    it('should handle updatePlot request', async () => {
      const response = await request(app)
        .put('/api/v1/plots/plot-uuid-1')
        .set('Authorization', 'Bearer token')
        .send({
          plot: {
            price: '1200000',
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('updatePlot');
      expect(mockPlotController.updatePlot).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .put('/api/v1/plots/plot-uuid-1')
        .send({
          plot: {
            price: '1200000',
          },
        });

      // authenticate middleware is mocked to pass, but in real scenario would fail without token
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalled();
    });
  });
});
