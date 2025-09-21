import request from 'supertest';
import express from 'express';
import gravestoneRoutes from '../../src/gravestones/gravestoneRoutes';
import * as gravestoneController from '../../src/gravestones/gravestoneController';
import * as authMiddleware from '../../src/middleware/auth';
import * as permissionMiddleware from '../../src/middleware/permission';

// コントローラーのモック
jest.mock('../../src/gravestones/gravestoneController', () => ({
  getGravestones: jest.fn((req, res) => res.json({ success: true, controller: 'getGravestones' })),
  getGravestoneById: jest.fn((req, res) => res.json({ success: true, controller: 'getGravestoneById' })),
  searchGravestones: jest.fn((req, res) => res.json({ success: true, controller: 'searchGravestones' })),
  createGravestone: jest.fn((req, res) => res.json({ success: true, controller: 'createGravestone' })),
  updateGravestone: jest.fn((req, res) => res.json({ success: true, controller: 'updateGravestone' })),
  deleteGravestone: jest.fn((req, res) => res.json({ success: true, controller: 'deleteGravestone' }))
}));

// ミドルウェアのモック
jest.mock('../../src/middleware/auth', () => ({
  authenticate: jest.fn((req, res, next) => next())
}));

jest.mock('../../src/middleware/permission', () => ({
  requirePermission: jest.fn(() => (req: any, res: any, next: any) => next())
}));

const mockGravestoneController = gravestoneController as jest.Mocked<typeof gravestoneController>;
const mockAuthMiddleware = authMiddleware as jest.Mocked<typeof authMiddleware>;
const mockPermissionMiddleware = permissionMiddleware as jest.Mocked<typeof permissionMiddleware>;

describe('Gravestone Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/gravestones', gravestoneRoutes);
    jest.clearAllMocks();
  });

  describe('GET /api/v1/gravestones/', () => {
    it('should handle getGravestones request', async () => {
      const response = await request(app)
        .get('/api/v1/gravestones/')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('getGravestones');
      expect(mockGravestoneController.getGravestones).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
      // requirePermissionはルートセットアップ時に呼ばれる
    });
  });

  describe('GET /api/v1/gravestones/search', () => {
    it('should handle searchGravestones request', async () => {
      const response = await request(app)
        .get('/api/v1/gravestones/search')
        .set('Authorization', 'Bearer token')
        .query({ q: 'search term' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('searchGravestones');
      expect(mockGravestoneController.searchGravestones).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
      // requirePermissionはルートセットアップ時に呼ばれる
    });
  });

  describe('GET /api/v1/gravestones/:id', () => {
    it('should handle getGravestoneById request', async () => {
      const response = await request(app)
        .get('/api/v1/gravestones/1')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('getGravestoneById');
      expect(mockGravestoneController.getGravestoneById).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
      // requirePermissionはルートセットアップ時に呼ばれる
    });
  });

  describe('POST /api/v1/gravestones/', () => {
    it('should handle createGravestone request', async () => {
      const response = await request(app)
        .post('/api/v1/gravestones/')
        .set('Authorization', 'Bearer token')
        .send({ gravestone_code: 'A-01', usage_status: 'available', price: 1000000 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('createGravestone');
      expect(mockGravestoneController.createGravestone).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
      // requirePermissionはルートセットアップ時に呼ばれる
    });
  });

  describe('PUT /api/v1/gravestones/:id', () => {
    it('should handle updateGravestone request', async () => {
      const response = await request(app)
        .put('/api/v1/gravestones/1')
        .set('Authorization', 'Bearer token')
        .send({ price: 1200000 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('updateGravestone');
      expect(mockGravestoneController.updateGravestone).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
      // requirePermissionはルートセットアップ時に呼ばれる
    });
  });

  describe('DELETE /api/v1/gravestones/:id', () => {
    it('should handle deleteGravestone request', async () => {
      const response = await request(app)
        .delete('/api/v1/gravestones/1')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('deleteGravestone');
      expect(mockGravestoneController.deleteGravestone).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
      // requirePermissionはルートセットアップ時に呼ばれる
    });
  });
});