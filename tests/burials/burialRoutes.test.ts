import request from 'supertest';
import express from 'express';
import burialRoutes from '../../src/burials/burialRoutes';

// コントローラーのモック
jest.mock('../../src/burials/burialController', () => ({
  searchBurials: jest.fn((req, res) => res.json({ success: true })),
  getBurials: jest.fn((req, res) => res.json({ success: true })),
  createBurial: jest.fn((req, res) => res.json({ success: true })),
  updateBurial: jest.fn((req, res) => res.json({ success: true })),
  deleteBurial: jest.fn((req, res) => res.json({ success: true }))
}));

// ミドルウェアのモック
jest.mock('../../src/middleware/auth', () => ({
  authenticate: jest.fn((req, res, next) => next())
}));

jest.mock('../../src/middleware/permission', () => ({
  requirePermission: jest.fn(() => (req: any, res: any, next: any) => next())
}));

describe('Burial Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/burials', burialRoutes);
  });

  describe('GET /api/v1/burials/search', () => {
    it('should handle searchBurials request', async () => {
      const response = await request(app)
        .get('/api/v1/burials/search')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/v1/burials/contracts/:contract_id/burials', () => {
    it('should handle getBurials request (legacy route)', async () => {
      const response = await request(app)
        .get('/api/v1/burials/contracts/1/burials')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
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
    });
  });

  describe('DELETE /api/v1/burials/:id', () => {
    it('should handle deleteBurial request', async () => {
      const response = await request(app)
        .delete('/api/v1/burials/1')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});