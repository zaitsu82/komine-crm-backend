import request from 'supertest';
import express from 'express';
import constructionRoutes from '../../src/constructions/constructionRoutes';
import * as constructionController from '../../src/constructions/constructionController';
import * as authMiddleware from '../../src/middleware/auth';

// コントローラーのモック
jest.mock('../../src/constructions/constructionController', () => ({
  getConstructions: jest.fn((req, res) => res.json({ success: true, controller: 'getConstructions' })),
  createConstruction: jest.fn((req, res) => res.json({ success: true, controller: 'createConstruction' })),
  updateConstruction: jest.fn((req, res) => res.json({ success: true, controller: 'updateConstruction' })),
  deleteConstruction: jest.fn((req, res) => res.json({ success: true, controller: 'deleteConstruction' }))
}));

// ミドルウェアのモック
jest.mock('../../src/middleware/auth', () => ({
  authenticate: jest.fn((req, res, next) => next())
}));

const mockConstructionController = constructionController as jest.Mocked<typeof constructionController>;
const mockAuthMiddleware = authMiddleware as jest.Mocked<typeof authMiddleware>;

describe('Construction Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api', constructionRoutes);
    jest.clearAllMocks();
  });

  describe('GET /api/contracts/:contract_id/constructions', () => {
    it('should handle getConstructions request', async () => {
      const response = await request(app)
        .get('/api/contracts/1/constructions')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('getConstructions');
      expect(mockConstructionController.getConstructions).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /api/contracts/:contract_id/constructions', () => {
    it('should handle createConstruction request', async () => {
      const response = await request(app)
        .post('/api/contracts/1/constructions')
        .set('Authorization', 'Bearer token')
        .send({ contractor_name: 'Test', construction_type: 'Test Type' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('createConstruction');
      expect(mockConstructionController.createConstruction).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
    });
  });

  describe('PUT /api/constructions/:construction_id', () => {
    it('should handle updateConstruction request', async () => {
      const response = await request(app)
        .put('/api/constructions/1')
        .set('Authorization', 'Bearer token')
        .send({ contractor_name: 'Updated', construction_type: 'Updated Type' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('updateConstruction');
      expect(mockConstructionController.updateConstruction).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
    });
  });

  describe('DELETE /api/constructions/:construction_id', () => {
    it('should handle deleteConstruction request', async () => {
      const response = await request(app)
        .delete('/api/constructions/1')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('deleteConstruction');
      expect(mockConstructionController.deleteConstruction).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
    });
  });
});