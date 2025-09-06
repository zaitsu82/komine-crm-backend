import request from 'supertest';
import express from 'express';
import constructionRoutes from '../../src/constructions/constructionRoutes';

// コントローラーのモック
jest.mock('../../src/constructions/constructionController', () => ({
  getConstructions: jest.fn((req, res) => res.json({ success: true })),
  createConstruction: jest.fn((req, res) => res.json({ success: true })),
  updateConstruction: jest.fn((req, res) => res.json({ success: true })),
  deleteConstruction: jest.fn((req, res) => res.json({ success: true }))
}));

// ミドルウェアのモック
jest.mock('../../src/middleware/auth', () => ({
  authenticate: jest.fn((req, res, next) => next())
}));

describe('Construction Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api', constructionRoutes);
  });

  describe('GET /api/contracts/:contract_id/constructions', () => {
    it('should handle getConstructions request', async () => {
      const response = await request(app)
        .get('/api/contracts/1/constructions')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
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
    });
  });

  describe('DELETE /api/constructions/:construction_id', () => {
    it('should handle deleteConstruction request', async () => {
      const response = await request(app)
        .delete('/api/constructions/1')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});