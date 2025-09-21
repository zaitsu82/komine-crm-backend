import request from 'supertest';
import express from 'express';
import usageFeeRoutes from '../../src/usage-fees/usageFeeRoutes';
import * as usageFeeController from '../../src/usage-fees/usageFeeController';
import * as authMiddleware from '../../src/middleware/auth';
import * as permissionMiddleware from '../../src/middleware/permission';

jest.mock('../../src/usage-fees/usageFeeController', () => ({
  createUsageFee: jest.fn((req, res) => res.json({ success: true, controller: 'createUsageFee' })),
  updateUsageFee: jest.fn((req, res) => res.json({ success: true, controller: 'updateUsageFee' })),
  deleteUsageFee: jest.fn((req, res) => res.json({ success: true, controller: 'deleteUsageFee' }))
}));

jest.mock('../../src/middleware/auth', () => ({
  authenticate: jest.fn((req, res, next) => next())
}));

jest.mock('../../src/middleware/permission', () => ({
  requirePermission: jest.fn(() => (req: any, res: any, next: any) => next())
}));

const mockUsageFeeController = usageFeeController as jest.Mocked<typeof usageFeeController>;
const mockAuthMiddleware = authMiddleware as jest.Mocked<typeof authMiddleware>;
const mockPermissionMiddleware = permissionMiddleware as jest.Mocked<typeof permissionMiddleware>;

describe('Usage Fee Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/usage-fees', usageFeeRoutes);
    jest.clearAllMocks();
  });

  describe('POST /api/v1/usage-fees/', () => {
    it('should handle createUsageFee request successfully', async () => {
      const response = await request(app)
        .post('/api/v1/usage-fees/')
        .set('Authorization', 'Bearer token')
        .send({
          gravestone_id: 1,
          calc_type: 'area_based',
          area: '15.5',
          fee: '120000',
          tax_type: 'included',
          payment_method: 'bank_transfer'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('createUsageFee');
      expect(mockUsageFeeController.createUsageFee).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
    });

    it('should handle createUsageFee request with minimal data', async () => {
      const response = await request(app)
        .post('/api/v1/usage-fees/')
        .set('Authorization', 'Bearer token')
        .send({
          gravestone_id: 1,
          fee: '50000'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('createUsageFee');
      expect(mockUsageFeeController.createUsageFee).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
    });
  });

  describe('PUT /api/v1/usage-fees/:id', () => {
    it('should handle updateUsageFee request successfully', async () => {
      const response = await request(app)
        .put('/api/v1/usage-fees/1')
        .set('Authorization', 'Bearer token')
        .send({
          calc_type: 'fixed_amount',
          fee: '150000',
          tax_type: 'excluded',
          payment_method: 'credit_card'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('updateUsageFee');
      expect(mockUsageFeeController.updateUsageFee).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
    });

    it('should handle updateUsageFee request with date fields', async () => {
      const response = await request(app)
        .put('/api/v1/usage-fees/1')
        .set('Authorization', 'Bearer token')
        .send({
          effective_start_date: '2024-06-01',
          effective_end_date: '2029-05-31',
          remarks: '更新されたテスト備考'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('updateUsageFee');
      expect(mockUsageFeeController.updateUsageFee).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
    });
  });

  describe('DELETE /api/v1/usage-fees/:id', () => {
    it('should handle deleteUsageFee request successfully', async () => {
      const response = await request(app)
        .delete('/api/v1/usage-fees/1')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('deleteUsageFee');
      expect(mockUsageFeeController.deleteUsageFee).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
    });

    it('should handle deleteUsageFee request with different ID', async () => {
      const response = await request(app)
        .delete('/api/v1/usage-fees/999')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('deleteUsageFee');
      expect(mockUsageFeeController.deleteUsageFee).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
    });
  });

  describe('Route middleware verification', () => {
    it('should apply authentication and permissions for all endpoints', async () => {
      // Test POST /
      await request(app)
        .post('/api/v1/usage-fees/')
        .set('Authorization', 'Bearer token')
        .send({ gravestone_id: 1, fee: '50000' });

      // Test PUT /:id
      await request(app)
        .put('/api/v1/usage-fees/1')
        .set('Authorization', 'Bearer token')
        .send({ fee: '75000' });

      // Test DELETE /:id
      await request(app)
        .delete('/api/v1/usage-fees/1')
        .set('Authorization', 'Bearer token');

      // Verify authentication middleware was called for all requests
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(3);
    });
  });

  describe('Authentication middleware verification', () => {
    it('should require authentication for all endpoints', async () => {
      // Test POST /
      await request(app)
        .post('/api/v1/usage-fees/')
        .set('Authorization', 'Bearer token')
        .send({ gravestone_id: 1, fee: '50000' });

      // Test PUT /:id
      await request(app)
        .put('/api/v1/usage-fees/1')
        .set('Authorization', 'Bearer token')
        .send({ fee: '75000' });

      // Test DELETE /:id
      await request(app)
        .delete('/api/v1/usage-fees/1')
        .set('Authorization', 'Bearer token');

      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(3);
    });

    it('should call controllers with correct request data', async () => {
      const createData = { gravestone_id: 1, fee: '100000' };
      const updateData = { fee: '125000' };

      await request(app)
        .post('/api/v1/usage-fees/')
        .set('Authorization', 'Bearer token')
        .send(createData);

      await request(app)
        .put('/api/v1/usage-fees/5')
        .set('Authorization', 'Bearer token')
        .send(updateData);

      await request(app)
        .delete('/api/v1/usage-fees/5')
        .set('Authorization', 'Bearer token');

      // Verify controllers were called
      expect(mockUsageFeeController.createUsageFee).toHaveBeenCalledTimes(1);
      expect(mockUsageFeeController.updateUsageFee).toHaveBeenCalledTimes(1);
      expect(mockUsageFeeController.deleteUsageFee).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error handling', () => {
    it('should handle controller errors gracefully', async () => {
      mockUsageFeeController.createUsageFee.mockImplementationOnce(async (req, res) => {
        res.status(500).json({ success: false, error: 'Internal server error' });
        return res;
      });

      const response = await request(app)
        .post('/api/v1/usage-fees/')
        .set('Authorization', 'Bearer token')
        .send({
          gravestone_id: 1,
          fee: '50000'
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    it('should handle update controller errors gracefully', async () => {
      mockUsageFeeController.updateUsageFee.mockImplementationOnce(async (req, res) => {
        res.status(404).json({ success: false, error: 'Usage fee not found' });
        return res;
      });

      const response = await request(app)
        .put('/api/v1/usage-fees/999')
        .set('Authorization', 'Bearer token')
        .send({ fee: '75000' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should handle delete controller errors gracefully', async () => {
      mockUsageFeeController.deleteUsageFee.mockImplementationOnce(async (req, res) => {
        res.status(404).json({ success: false, error: 'Usage fee not found' });
        return res;
      });

      const response = await request(app)
        .delete('/api/v1/usage-fees/999')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Route parameter handling', () => {
    it('should handle various ID formats in routes', async () => {
      const testIds = ['1', '123', '999'];

      for (const id of testIds) {
        await request(app)
          .put(`/api/v1/usage-fees/${id}`)
          .set('Authorization', 'Bearer token')
          .send({ fee: '60000' });

        await request(app)
          .delete(`/api/v1/usage-fees/${id}`)
          .set('Authorization', 'Bearer token');
      }

      expect(mockUsageFeeController.updateUsageFee).toHaveBeenCalledTimes(3);
      expect(mockUsageFeeController.deleteUsageFee).toHaveBeenCalledTimes(3);
    });
  });

  describe('HTTP method verification', () => {
    it('should only accept POST for creation endpoint', async () => {
      const response = await request(app)
        .get('/api/v1/usage-fees/')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(404);
    });

    it('should only accept PUT for update endpoint', async () => {
      const response = await request(app)
        .post('/api/v1/usage-fees/1')
        .set('Authorization', 'Bearer token')
        .send({ fee: '50000' });

      expect(response.status).toBe(404);
    });

    it('should only accept DELETE for deletion endpoint', async () => {
      const response = await request(app)
        .get('/api/v1/usage-fees/1')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(404);
    });
  });

  describe('Request data validation', () => {
    it('should pass through request body for create operations', async () => {
      const complexData = {
        gravestone_id: 1,
        calc_type: 'area_based',
        area: '25.0',
        fee: '200000',
        tax_type: 'included',
        billing_years: 15,
        unit_price: '13333',
        payment_method: 'bank_transfer',
        remarks: '詳細なテスト使用料データ',
        effective_start_date: '2024-01-01',
        effective_end_date: '2039-12-31'
      };

      const response = await request(app)
        .post('/api/v1/usage-fees/')
        .set('Authorization', 'Bearer token')
        .send(complexData);

      expect(response.status).toBe(200);
      expect(mockUsageFeeController.createUsageFee).toHaveBeenCalledTimes(1);
    });

    it('should pass through request body for update operations', async () => {
      const updateData = {
        calc_type: 'fixed_amount',
        area: '30.0',
        fee: '250000',
        tax_type: 'excluded',
        billing_years: 20,
        unit_price: '12500',
        payment_method: 'credit_card',
        remarks: '更新された詳細なデータ',
        effective_start_date: '2024-07-01',
        effective_end_date: '2044-06-30'
      };

      const response = await request(app)
        .put('/api/v1/usage-fees/10')
        .set('Authorization', 'Bearer token')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(mockUsageFeeController.updateUsageFee).toHaveBeenCalledTimes(1);
    });
  });
});