import request from 'supertest';
import express from 'express';
import masterRoutes from '../../src/masters/masterRoutes';
import * as masterController from '../../src/masters/masterController';
import * as authMiddleware from '../../src/middleware/auth';
import * as permissionMiddleware from '../../src/middleware/permission';

// コントローラーのモック
jest.mock('../../src/masters/masterController', () => ({
  getCemeteryTypeMaster: jest.fn((req, res) =>
    res.status(200).json({ success: true, controller: 'getCemeteryTypeMaster' })
  ),
  getPaymentMethodMaster: jest.fn((req, res) =>
    res.status(200).json({ success: true, controller: 'getPaymentMethodMaster' })
  ),
  getTaxTypeMaster: jest.fn((req, res) =>
    res.status(200).json({ success: true, controller: 'getTaxTypeMaster' })
  ),
  getCalcTypeMaster: jest.fn((req, res) =>
    res.status(200).json({ success: true, controller: 'getCalcTypeMaster' })
  ),
  getBillingTypeMaster: jest.fn((req, res) =>
    res.status(200).json({ success: true, controller: 'getBillingTypeMaster' })
  ),
  getAccountTypeMaster: jest.fn((req, res) =>
    res.status(200).json({ success: true, controller: 'getAccountTypeMaster' })
  ),
  getRecipientTypeMaster: jest.fn((req, res) =>
    res.status(200).json({ success: true, controller: 'getRecipientTypeMaster' })
  ),
  getConstructionTypeMaster: jest.fn((req, res) =>
    res.status(200).json({ success: true, controller: 'getConstructionTypeMaster' })
  ),
  getAllMasters: jest.fn((req, res) =>
    res.status(200).json({ success: true, controller: 'getAllMasters' })
  ),
  createMaster: jest.fn((req, res) =>
    res.status(201).json({ success: true, controller: 'createMaster' })
  ),
  updateMaster: jest.fn((req, res) =>
    res.status(200).json({ success: true, controller: 'updateMaster' })
  ),
  deleteMaster: jest.fn((req, res) =>
    res.status(200).json({ success: true, controller: 'deleteMaster' })
  ),
}));

// ミドルウェアのモック
jest.mock('../../src/middleware/auth', () => ({
  authenticate: jest.fn((req, res, next) => next()),
}));

jest.mock('../../src/middleware/permission', () => ({
  checkApiPermission: jest.fn(() => (req: any, res: any, next: any) => next()),
}));

const mockMasterController = masterController as jest.Mocked<typeof masterController>;
const mockAuthMiddleware = authMiddleware as jest.Mocked<typeof authMiddleware>;
const mockPermissionMiddleware = permissionMiddleware as jest.Mocked<typeof permissionMiddleware>;

describe('Master Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/masters', masterRoutes);
    jest.clearAllMocks();
  });

  describe('GET /api/v1/masters/all', () => {
    it('should handle getAllMasters request', async () => {
      const response = await request(app)
        .get('/api/v1/masters/all')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('getAllMasters');
      expect(mockMasterController.getAllMasters).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/masters/cemetery-type', () => {
    it('should handle getCemeteryTypeMaster request', async () => {
      const response = await request(app)
        .get('/api/v1/masters/cemetery-type')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('getCemeteryTypeMaster');
      expect(mockMasterController.getCemeteryTypeMaster).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/masters/payment-method', () => {
    it('should handle getPaymentMethodMaster request', async () => {
      const response = await request(app)
        .get('/api/v1/masters/payment-method')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('getPaymentMethodMaster');
      expect(mockMasterController.getPaymentMethodMaster).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/masters/tax-type', () => {
    it('should handle getTaxTypeMaster request', async () => {
      const response = await request(app)
        .get('/api/v1/masters/tax-type')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('getTaxTypeMaster');
      expect(mockMasterController.getTaxTypeMaster).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/masters/calc-type', () => {
    it('should handle getCalcTypeMaster request', async () => {
      const response = await request(app)
        .get('/api/v1/masters/calc-type')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('getCalcTypeMaster');
      expect(mockMasterController.getCalcTypeMaster).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/masters/billing-type', () => {
    it('should handle getBillingTypeMaster request', async () => {
      const response = await request(app)
        .get('/api/v1/masters/billing-type')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('getBillingTypeMaster');
      expect(mockMasterController.getBillingTypeMaster).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/masters/account-type', () => {
    it('should handle getAccountTypeMaster request', async () => {
      const response = await request(app)
        .get('/api/v1/masters/account-type')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('getAccountTypeMaster');
      expect(mockMasterController.getAccountTypeMaster).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/masters/recipient-type', () => {
    it('should handle getRecipientTypeMaster request', async () => {
      const response = await request(app)
        .get('/api/v1/masters/recipient-type')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('getRecipientTypeMaster');
      expect(mockMasterController.getRecipientTypeMaster).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/masters/construction-type', () => {
    it('should handle getConstructionTypeMaster request', async () => {
      const response = await request(app)
        .get('/api/v1/masters/construction-type')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('getConstructionTypeMaster');
      expect(mockMasterController.getConstructionTypeMaster).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/masters/:masterType', () => {
    it('should handle createMaster request', async () => {
      const response = await request(app)
        .post('/api/v1/masters/cemetery-type')
        .set('Authorization', 'Bearer token')
        .send({ code: 'test', name: 'テスト' });

      expect(response.status).toBe(201);
      expect(response.body.controller).toBe('createMaster');
      expect(mockMasterController.createMaster).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalled();
    });
  });

  describe('PUT /api/v1/masters/:masterType/:id', () => {
    it('should handle updateMaster request', async () => {
      const response = await request(app)
        .put('/api/v1/masters/cemetery-type/1')
        .set('Authorization', 'Bearer token')
        .send({ name: '更新テスト' });

      expect(response.status).toBe(200);
      expect(response.body.controller).toBe('updateMaster');
      expect(mockMasterController.updateMaster).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalled();
    });
  });

  describe('DELETE /api/v1/masters/:masterType/:id', () => {
    it('should handle deleteMaster request', async () => {
      const response = await request(app)
        .delete('/api/v1/masters/cemetery-type/1')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.controller).toBe('deleteMaster');
      expect(mockMasterController.deleteMaster).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalled();
    });
  });
});
