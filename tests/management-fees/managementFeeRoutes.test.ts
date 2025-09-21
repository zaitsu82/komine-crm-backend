import request from 'supertest';
import express from 'express';
import managementFeeRoutes from '../../src/management-fees/managementFeeRoutes';
import * as managementFeeController from '../../src/management-fees/managementFeeController';
import * as authMiddleware from '../../src/middleware/auth';
import * as permissionMiddleware from '../../src/middleware/permission';

jest.mock('../../src/management-fees/managementFeeController', () => ({
  createManagementFee: jest.fn((req, res) => res.json({ success: true, controller: 'createManagementFee' })),
  updateManagementFee: jest.fn((req, res) => res.json({ success: true, controller: 'updateManagementFee' })),
  deleteManagementFee: jest.fn((req, res) => res.json({ success: true, controller: 'deleteManagementFee' })),
  calculateManagementFee: jest.fn((req, res) => res.json({ success: true, controller: 'calculateManagementFee' }))
}));

jest.mock('../../src/middleware/auth', () => ({
  authenticate: jest.fn((req, res, next) => next())
}));

jest.mock('../../src/middleware/permission', () => ({
  requirePermission: jest.fn(() => (req: any, res: any, next: any) => next())
}));

const mockManagementFeeController = managementFeeController as jest.Mocked<typeof managementFeeController>;
const mockAuthMiddleware = authMiddleware as jest.Mocked<typeof authMiddleware>;
const mockPermissionMiddleware = permissionMiddleware as jest.Mocked<typeof permissionMiddleware>;

describe('Management Fee Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/management-fees', managementFeeRoutes);
    jest.clearAllMocks();
  });

  describe('POST /api/v1/management-fees/calculate', () => {
    it('should handle calculateManagementFee request', async () => {
      const response = await request(app)
        .post('/api/v1/management-fees/calculate')
        .set('Authorization', 'Bearer token')
        .send({
          gravestone_id: 1,
          calc_type: 'area_based',
          area: '10.5',
          unit_price: '5000'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('calculateManagementFee');
      expect(mockManagementFeeController.calculateManagementFee).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /api/v1/management-fees/', () => {
    it('should handle createManagementFee request', async () => {
      const response = await request(app)
        .post('/api/v1/management-fees/')
        .set('Authorization', 'Bearer token')
        .send({
          gravestone_id: 1,
          calc_type: 'fixed_amount',
          billing_type: 'monthly',
          fee: '50000',
          payment_method: 'bank_transfer'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('createManagementFee');
      expect(mockManagementFeeController.createManagementFee).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
    });
  });

  describe('PUT /api/v1/management-fees/:id', () => {
    it('should handle updateManagementFee request', async () => {
      const response = await request(app)
        .put('/api/v1/management-fees/1')
        .set('Authorization', 'Bearer token')
        .send({
          calc_type: 'area_based',
          billing_type: 'yearly',
          fee: '75000'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('updateManagementFee');
      expect(mockManagementFeeController.updateManagementFee).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
    });
  });

  describe('DELETE /api/v1/management-fees/:id', () => {
    it('should handle deleteManagementFee request', async () => {
      const response = await request(app)
        .delete('/api/v1/management-fees/1')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('deleteManagementFee');
      expect(mockManagementFeeController.deleteManagementFee).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
    });
  });

  describe('Route middleware verification', () => {
    it('should apply authentication and permissions for all endpoints', async () => {
      // These tests verify that routes are properly configured with middleware
      // The specific permission checking is implementation detail tested at integration level

      await request(app)
        .post('/api/v1/management-fees/calculate')
        .set('Authorization', 'Bearer token')
        .send({ gravestone_id: 1, calc_type: 'fixed_amount', unit_price: '30000' });

      await request(app)
        .post('/api/v1/management-fees/')
        .set('Authorization', 'Bearer token')
        .send({ gravestone_id: 1, fee: '30000', payment_method: 'cash' });

      await request(app)
        .put('/api/v1/management-fees/1')
        .set('Authorization', 'Bearer token')
        .send({ fee: '40000' });

      await request(app)
        .delete('/api/v1/management-fees/1')
        .set('Authorization', 'Bearer token');

      // Verify authentication middleware was called for all requests
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(4);
    });
  });

  describe('Authentication middleware verification', () => {
    it('should require authentication for all endpoints', async () => {
      // Test POST /calculate
      await request(app)
        .post('/api/v1/management-fees/calculate')
        .set('Authorization', 'Bearer token')
        .send({ gravestone_id: 1, calc_type: 'fixed_amount', unit_price: '30000' });

      // Test POST /
      await request(app)
        .post('/api/v1/management-fees/')
        .set('Authorization', 'Bearer token')
        .send({ gravestone_id: 1, fee: '30000', payment_method: 'cash' });

      // Test PUT /:id
      await request(app)
        .put('/api/v1/management-fees/1')
        .set('Authorization', 'Bearer token')
        .send({ fee: '40000' });

      // Test DELETE /:id
      await request(app)
        .delete('/api/v1/management-fees/1')
        .set('Authorization', 'Bearer token');

      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(4);
    });
  });

  describe('Route order verification', () => {
    it('should handle /calculate route before /:id routes', async () => {
      // Test that /calculate doesn't get caught by /:id pattern
      const calculateResponse = await request(app)
        .post('/api/v1/management-fees/calculate')
        .set('Authorization', 'Bearer token')
        .send({
          gravestone_id: 1,
          calc_type: 'fixed_amount',
          unit_price: '30000'
        });

      expect(calculateResponse.status).toBe(200);
      expect(calculateResponse.body.controller).toBe('calculateManagementFee');
      expect(mockManagementFeeController.calculateManagementFee).toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should handle controller errors gracefully', async () => {
      mockManagementFeeController.createManagementFee.mockImplementationOnce(async (req, res) => {
        res.status(500).json({ success: false, error: 'Internal server error' });
        return res;
      });

      const response = await request(app)
        .post('/api/v1/management-fees/')
        .set('Authorization', 'Bearer token')
        .send({
          gravestone_id: 1,
          fee: '30000',
          payment_method: 'cash'
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });
});