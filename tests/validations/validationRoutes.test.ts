import request from 'supertest';
import express from 'express';
import validationRoutes from '../../src/validations/validationRoutes';

// コントローラーのモック
jest.mock('../../src/validations/validationController', () => ({
  checkContractNumber: jest.fn((req, res) => res.json({ success: true })),
  validateContractData: jest.fn((req, res) => res.json({ success: true }))
}));

// ミドルウェアのモック
jest.mock('../../src/middleware/auth', () => ({
  authenticate: jest.fn((req, res, next) => next())
}));

describe('Validation Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/validations', validationRoutes);
  });

  describe('GET /validations/contract-number', () => {
    it('should handle checkContractNumber request', async () => {
      const response = await request(app)
        .get('/validations/contract-number')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /validations/contract', () => {
    it('should handle validateContractData request', async () => {
      const response = await request(app)
        .post('/validations/contract')
        .set('Authorization', 'Bearer token')
        .send({ contract_data: 'test' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});