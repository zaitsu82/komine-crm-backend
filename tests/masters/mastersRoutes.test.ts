import request from 'supertest';
import express from 'express';
import mastersRoutes from '../../src/masters/mastersRoutes';

// コントローラーのモック
jest.mock('../../src/masters/mastersController', () => ({
  getStaff: jest.fn((req, res) => res.json({ success: true })),
  getPaymentMethods: jest.fn((req, res) => res.json({ success: true })),
  getGraveTypes: jest.fn((req, res) => res.json({ success: true })),
  getReligiousSects: jest.fn((req, res) => res.json({ success: true }))
}));

// ミドルウェアのモック
jest.mock('../../src/middleware/auth', () => ({
  authenticate: jest.fn((req, res, next) => next())
}));

describe('Masters Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/masters', mastersRoutes);
  });

  describe('GET /masters/staff', () => {
    it('should handle getStaff request', async () => {
      const response = await request(app)
        .get('/masters/staff')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /masters/payment-methods', () => {
    it('should handle getPaymentMethods request', async () => {
      const response = await request(app)
        .get('/masters/payment-methods')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /masters/grave-types', () => {
    it('should handle getGraveTypes request', async () => {
      const response = await request(app)
        .get('/masters/grave-types')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /masters/religious-sects', () => {
    it('should handle getReligiousSects request', async () => {
      const response = await request(app)
        .get('/masters/religious-sects')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});