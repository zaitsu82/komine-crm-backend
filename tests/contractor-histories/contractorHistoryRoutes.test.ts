import request from 'supertest';
import express from 'express';
import contractorHistoryRoutes from '../../src/contractor-histories/contractorHistoryRoutes';

// コントローラーのモック
jest.mock('../../src/contractor-histories/contractorHistoryController', () => ({
  getContractorHistories: jest.fn((req, res) => res.json({ success: true })),
  createContractorHistory: jest.fn((req, res) => res.json({ success: true }))
}));

// ミドルウェアのモック
jest.mock('../../src/middleware/auth', () => ({
  authenticate: jest.fn((req, res, next) => next())
}));

describe('ContractorHistory Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api', contractorHistoryRoutes);
  });

  describe('GET /api/contracts/:contract_id/contractor-histories', () => {
    it('should handle getContractorHistories request', async () => {
      const response = await request(app)
        .get('/api/contracts/1/contractor-histories')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/contracts/:contract_id/contractor-histories', () => {
    it('should handle createContractorHistory request', async () => {
      const response = await request(app)
        .post('/api/contracts/1/contractor-histories')
        .set('Authorization', 'Bearer token')
        .send({
          contractor_id: 1,
          name: 'テストユーザー',
          name_kana: 'てすとゆーざー',
          birth_date: '1980-01-01',
          postal_code: '123-4567',
          address1: '東京都',
          address2: '新宿区',
          phone1: '03-1234-5678',
          change_date: '2024-01-01'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});