import request from 'supertest';
import express from 'express';
import burialRoutes from '../../src/burials/burialRoutes';

// コントローラーのモック
jest.mock('../../src/burials/burialController', () => ({
  getBurials: jest.fn((req, res) => res.json({ success: true })),
  createBurial: jest.fn((req, res) => res.json({ success: true })),
  updateBurial: jest.fn((req, res) => res.json({ success: true })),
  deleteBurial: jest.fn((req, res) => res.json({ success: true }))
}));

// ミドルウェアのモック
jest.mock('../../src/middleware/auth', () => ({
  authenticate: jest.fn((req, res, next) => next())
}));

describe('Burial Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api', burialRoutes);
  });

  describe('GET /api/contracts/:contract_id/burials', () => {
    it('should handle getBurials request', async () => {
      const response = await request(app)
        .get('/api/contracts/1/burials')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/contracts/:contract_id/burials', () => {
    it('should handle createBurial request', async () => {
      const response = await request(app)
        .post('/api/contracts/1/burials')
        .set('Authorization', 'Bearer token')
        .send({ name: 'Test Burial' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('PUT /api/burials/:burial_id', () => {
    it('should handle updateBurial request', async () => {
      const response = await request(app)
        .put('/api/burials/1')
        .set('Authorization', 'Bearer token')
        .send({ name: 'Updated Burial' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('DELETE /api/burials/:burial_id', () => {
    it('should handle deleteBurial request', async () => {
      const response = await request(app)
        .delete('/api/burials/1')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});