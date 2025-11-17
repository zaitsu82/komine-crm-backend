import request from 'supertest';
import express from 'express';
import masterRoutes from '../../src/masters/masterRoutes';
import * as masterController from '../../src/masters/masterController';
import * as authMiddleware from '../../src/middleware/auth';
import * as permissionMiddleware from '../../src/middleware/permission';

// コントローラーのモック
jest.mock('../../src/masters/masterController', () => ({
  getUsageStatusMaster: jest.fn((req, res) => res.status(200).json({ success: true, controller: 'getUsageStatusMaster' })),
  getCemeteryTypeMaster: jest.fn((req, res) => res.status(200).json({ success: true, controller: 'getCemeteryTypeMaster' })),
  getDenominationMaster: jest.fn((req, res) => res.status(200).json({ success: true, controller: 'getDenominationMaster' })),
  getGenderMaster: jest.fn((req, res) => res.status(200).json({ success: true, controller: 'getGenderMaster' })),
  getPaymentMethodMaster: jest.fn((req, res) => res.status(200).json({ success: true, controller: 'getPaymentMethodMaster' })),
  getTaxTypeMaster: jest.fn((req, res) => res.status(200).json({ success: true, controller: 'getTaxTypeMaster' })),
  getCalcTypeMaster: jest.fn((req, res) => res.status(200).json({ success: true, controller: 'getCalcTypeMaster' })),
  getBillingTypeMaster: jest.fn((req, res) => res.status(200).json({ success: true, controller: 'getBillingTypeMaster' })),
  getAccountTypeMaster: jest.fn((req, res) => res.status(200).json({ success: true, controller: 'getAccountTypeMaster' })),
  getRecipientTypeMaster: jest.fn((req, res) => res.status(200).json({ success: true, controller: 'getRecipientTypeMaster' })),
  getRelationMaster: jest.fn((req, res) => res.status(200).json({ success: true, controller: 'getRelationMaster' })),
  getConstructionTypeMaster: jest.fn((req, res) => res.status(200).json({ success: true, controller: 'getConstructionTypeMaster' })),
  getUpdateTypeMaster: jest.fn((req, res) => res.status(200).json({ success: true, controller: 'getUpdateTypeMaster' })),
  getPrefectureMaster: jest.fn((req, res) => res.status(200).json({ success: true, controller: 'getPrefectureMaster' })),
  getAllMasters: jest.fn((req, res) => res.status(200).json({ success: true, controller: 'getAllMasters' })),
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

  describe('GET /api/v1/masters/usage-status', () => {
    it('should handle getUsageStatusMaster request', async () => {
      const response = await request(app)
        .get('/api/v1/masters/usage-status')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('getUsageStatusMaster');
      expect(mockMasterController.getUsageStatusMaster).toHaveBeenCalledTimes(1);
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

  describe('GET /api/v1/masters/denomination', () => {
    it('should handle getDenominationMaster request', async () => {
      const response = await request(app)
        .get('/api/v1/masters/denomination')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('getDenominationMaster');
      expect(mockMasterController.getDenominationMaster).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/masters/gender', () => {
    it('should handle getGenderMaster request', async () => {
      const response = await request(app)
        .get('/api/v1/masters/gender')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('getGenderMaster');
      expect(mockMasterController.getGenderMaster).toHaveBeenCalledTimes(1);
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

  describe('GET /api/v1/masters/relation', () => {
    it('should handle getRelationMaster request', async () => {
      const response = await request(app)
        .get('/api/v1/masters/relation')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('getRelationMaster');
      expect(mockMasterController.getRelationMaster).toHaveBeenCalledTimes(1);
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

  describe('GET /api/v1/masters/update-type', () => {
    it('should handle getUpdateTypeMaster request', async () => {
      const response = await request(app)
        .get('/api/v1/masters/update-type')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('getUpdateTypeMaster');
      expect(mockMasterController.getUpdateTypeMaster).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/masters/prefecture', () => {
    it('should handle getPrefectureMaster request', async () => {
      const response = await request(app)
        .get('/api/v1/masters/prefecture')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('getPrefectureMaster');
      expect(mockMasterController.getPrefectureMaster).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalled();
    });
  });
});
