import request from 'supertest';
import express from 'express';
import billingInfoRoutes from '../../src/billing-infos/billingInfoRoutes';
import * as billingInfoController from '../../src/billing-infos/billingInfoController';
import * as authMiddleware from '../../src/middleware/auth';
import * as permissionMiddleware from '../../src/middleware/permission';

jest.mock('../../src/billing-infos/billingInfoController', () => ({
  generateBillingData: jest.fn((req, res) => res.json({ success: true, controller: 'generateBillingData' })),
  createBillingInfo: jest.fn((req, res) => res.json({ success: true, controller: 'createBillingInfo' })),
  updateBillingInfo: jest.fn((req, res) => res.json({ success: true, controller: 'updateBillingInfo' })),
  deleteBillingInfo: jest.fn((req, res) => res.json({ success: true, controller: 'deleteBillingInfo' }))
}));

jest.mock('../../src/middleware/auth', () => ({
  authenticate: jest.fn((req, res, next) => next())
}));

jest.mock('../../src/middleware/permission', () => ({
  requirePermission: jest.fn(() => (req: any, res: any, next: any) => next())
}));

const mockBillingInfoController = billingInfoController as jest.Mocked<typeof billingInfoController>;
const mockAuthMiddleware = authMiddleware as jest.Mocked<typeof authMiddleware>;
const mockPermissionMiddleware = permissionMiddleware as jest.Mocked<typeof permissionMiddleware>;

describe('BillingInfo Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/billing-infos', billingInfoRoutes);
    jest.clearAllMocks();
  });

  describe('POST /api/v1/billing-infos/generate', () => {
    it('should handle generateBillingData request', async () => {
      const response = await request(app)
        .post('/api/v1/billing-infos/generate')
        .set('Authorization', 'Bearer token')
        .send({
          gravestone_id: 1,
          contractor_id: 1,
          year: 2024,
          month: 3
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('generateBillingData');
      expect(mockBillingInfoController.generateBillingData).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /api/v1/billing-infos/', () => {
    it('should handle createBillingInfo request', async () => {
      const response = await request(app)
        .post('/api/v1/billing-infos/')
        .set('Authorization', 'Bearer token')
        .send({
          gravestone_id: 1,
          contractor_id: 1,
          bank_name: 'テスト銀行',
          branch_name: 'テスト支店',
          account_type: 'savings',
          account_number: '1234567',
          account_holder: 'テスト太郎'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('createBillingInfo');
      expect(mockBillingInfoController.createBillingInfo).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
    });
  });

  describe('PUT /api/v1/billing-infos/:id', () => {
    it('should handle updateBillingInfo request', async () => {
      const response = await request(app)
        .put('/api/v1/billing-infos/1')
        .set('Authorization', 'Bearer token')
        .send({
          bank_name: '更新銀行',
          branch_name: '更新支店'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('updateBillingInfo');
      expect(mockBillingInfoController.updateBillingInfo).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
    });
  });

  describe('DELETE /api/v1/billing-infos/:id', () => {
    it('should handle deleteBillingInfo request', async () => {
      const response = await request(app)
        .delete('/api/v1/billing-infos/1')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('deleteBillingInfo');
      expect(mockBillingInfoController.deleteBillingInfo).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
    });
  });
});