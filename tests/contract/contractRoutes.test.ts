import request from 'supertest';
import express from 'express';
import contractRoutes from '../../src/contract/contractRoutes';

// コントローラーのモック
jest.mock('../../src/contract/contractController', () => ({
  getContracts: jest.fn((req, res) => res.json({ success: true })),
  getContractDetail: jest.fn((req, res) => res.json({ success: true })),
  createContract: jest.fn((req, res) => res.json({ success: true })),
  updateContract: jest.fn((req, res) => res.json({ success: true })),
  deleteContract: jest.fn((req, res) => res.json({ success: true }))
}));

// ミドルウェアのモック
jest.mock('../../src/middleware/auth', () => ({
  authenticate: jest.fn((req, res, next) => next())
}));

describe('Contract Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/contracts', contractRoutes);
  });

  describe('GET /contracts', () => {
    it('should handle getContracts request', async () => {
      const response = await request(app)
        .get('/contracts')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /contracts/:contract_id', () => {
    it('should handle getContractDetail request', async () => {
      const response = await request(app)
        .get('/contracts/1')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /contracts', () => {
    it('should handle createContract request', async () => {
      const response = await request(app)
        .post('/contracts')
        .set('Authorization', 'Bearer token')
        .send({ name: 'Test Contract' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('PUT /contracts/:contract_id', () => {
    it('should handle updateContract request', async () => {
      const response = await request(app)
        .put('/contracts/1')
        .set('Authorization', 'Bearer token')
        .send({ name: 'Updated Contract' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('DELETE /contracts/:contract_id', () => {
    it('should handle deleteContract request', async () => {
      const response = await request(app)
        .delete('/contracts/1')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});