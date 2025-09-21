import request from 'supertest';
import express from 'express';
import burialRoutes from '../../src/burials/burialRoutes';
import * as burialController from '../../src/burials/burialController';
import * as authMiddleware from '../../src/middleware/auth';
import * as permissionMiddleware from '../../src/middleware/permission';

// コントローラーのモック
jest.mock('../../src/burials/burialController', () => ({
  searchBurials: jest.fn((req, res) => res.json({ success: true, controller: 'searchBurials' })),
  getBurials: jest.fn((req, res) => res.json({ success: true, controller: 'getBurials' })),
  createBurial: jest.fn((req, res) => res.json({ success: true, controller: 'createBurial' })),
  updateBurial: jest.fn((req, res) => res.json({ success: true, controller: 'updateBurial' })),
  deleteBurial: jest.fn((req, res) => res.json({ success: true, controller: 'deleteBurial' }))
}));

// ミドルウェアのモック
jest.mock('../../src/middleware/auth', () => ({
  authenticate: jest.fn((req, res, next) => next())
}));

jest.mock('../../src/middleware/permission', () => ({
  requirePermission: jest.fn(() => (req: any, res: any, next: any) => next())
}));

const mockBurialController = burialController as jest.Mocked<typeof burialController>;
const mockAuthMiddleware = authMiddleware as jest.Mocked<typeof authMiddleware>;
const mockPermissionMiddleware = permissionMiddleware as jest.Mocked<typeof permissionMiddleware>;

describe('Burial Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/burials', burialRoutes);
    jest.clearAllMocks();
  });

  describe('GET /api/v1/burials/search', () => {
    it('should handle searchBurials request', async () => {
      const response = await request(app)
        .get('/api/v1/burials/search')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('searchBurials');
      expect(mockBurialController.searchBurials).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
      // requirePermissionはルートセットアップ時に呼ばれる
    });
  });

  describe('GET /api/v1/burials/contracts/:contract_id/burials', () => {
    it('should handle getBurials request (legacy route)', async () => {
      const response = await request(app)
        .get('/api/v1/burials/contracts/1/burials')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('getBurials');
      expect(mockBurialController.getBurials).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /api/v1/burials/', () => {
    it('should handle createBurial request', async () => {
      const response = await request(app)
        .post('/api/v1/burials/')
        .set('Authorization', 'Bearer token')
        .send({ name: 'Test Burial' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('createBurial');
      expect(mockBurialController.createBurial).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
      // requirePermissionはルートセットアップ時に呼ばれる
    });
  });

  describe('POST /api/v1/burials/contracts/:contract_id/burials', () => {
    it('should handle createBurial request (legacy route)', async () => {
      const response = await request(app)
        .post('/api/v1/burials/contracts/1/burials')
        .set('Authorization', 'Bearer token')
        .send({ name: 'Test Burial' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('createBurial');
      expect(mockBurialController.createBurial).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
    });
  });

  describe('PUT /api/v1/burials/:id', () => {
    it('should handle updateBurial request', async () => {
      const response = await request(app)
        .put('/api/v1/burials/1')
        .set('Authorization', 'Bearer token')
        .send({ name: 'Updated Burial' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('updateBurial');
      expect(mockBurialController.updateBurial).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
      // requirePermissionはルートセットアップ時に呼ばれる
    });
  });

  describe('DELETE /api/v1/burials/:id', () => {
    it('should handle deleteBurial request', async () => {
      const response = await request(app)
        .delete('/api/v1/burials/1')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('deleteBurial');
      expect(mockBurialController.deleteBurial).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
      // requirePermissionはルートセットアップ時に呼ばれる
    });
  });
});