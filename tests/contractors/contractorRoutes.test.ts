import request from 'supertest';
import express from 'express';
import contractorRoutes from '../../src/contractors/contractorRoutes';
import * as contractorController from '../../src/contractors/contractorController';
import * as authMiddleware from '../../src/middleware/auth';
import * as permissionMiddleware from '../../src/middleware/permission';

jest.mock('../../src/contractors/contractorController', () => ({
  getContractorById: jest.fn((req, res) => res.json({ success: true, controller: 'getContractorById' })),
  searchContractors: jest.fn((req, res) => res.json({ success: true, controller: 'searchContractors' })),
  createContractor: jest.fn((req, res) => res.json({ success: true, controller: 'createContractor' })),
  updateContractor: jest.fn((req, res) => res.json({ success: true, controller: 'updateContractor' })),
  deleteContractor: jest.fn((req, res) => res.json({ success: true, controller: 'deleteContractor' })),
  transferContractor: jest.fn((req, res) => res.json({ success: true, controller: 'transferContractor' }))
}));

jest.mock('../../src/middleware/auth', () => ({
  authenticate: jest.fn((req, res, next) => next())
}));

jest.mock('../../src/middleware/permission', () => ({
  requirePermission: jest.fn(() => (req: any, res: any, next: any) => next())
}));

const mockContractorController = contractorController as jest.Mocked<typeof contractorController>;
const mockAuthMiddleware = authMiddleware as jest.Mocked<typeof authMiddleware>;
const mockPermissionMiddleware = permissionMiddleware as jest.Mocked<typeof permissionMiddleware>;

describe('Contractor Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/contractors', contractorRoutes);
    jest.clearAllMocks();
  });

  describe('GET /api/v1/contractors/search', () => {
    it('should handle searchContractors request', async () => {
      const response = await request(app)
        .get('/api/v1/contractors/search')
        .set('Authorization', 'Bearer token')
        .query({ name: 'テスト' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('searchContractors');
      expect(mockContractorController.searchContractors).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /api/v1/contractors/:id', () => {
    it('should handle getContractorById request', async () => {
      const response = await request(app)
        .get('/api/v1/contractors/1')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('getContractorById');
      expect(mockContractorController.getContractorById).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /api/v1/contractors/', () => {
    it('should handle createContractor request', async () => {
      const response = await request(app)
        .post('/api/v1/contractors/')
        .set('Authorization', 'Bearer token')
        .send({
          gravestone_id: 1,
          start_date: '2024-01-01',
          name: 'テスト契約者',
          kana: 'テストケイヤクシャ',
          postal_code: '123-4567',
          address: 'テスト住所',
          phone: '012-345-6789'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('createContractor');
      expect(mockContractorController.createContractor).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
    });
  });

  describe('PUT /api/v1/contractors/:id', () => {
    it('should handle updateContractor request', async () => {
      const response = await request(app)
        .put('/api/v1/contractors/1')
        .set('Authorization', 'Bearer token')
        .send({
          name: '更新された契約者',
          phone: '090-1234-5678'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('updateContractor');
      expect(mockContractorController.updateContractor).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
    });
  });

  describe('DELETE /api/v1/contractors/:id', () => {
    it('should handle deleteContractor request', async () => {
      const response = await request(app)
        .delete('/api/v1/contractors/1')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('deleteContractor');
      expect(mockContractorController.deleteContractor).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /api/v1/contractors/:id/transfer', () => {
    it('should handle transferContractor request', async () => {
      const response = await request(app)
        .post('/api/v1/contractors/1/transfer')
        .set('Authorization', 'Bearer token')
        .send({
          new_contractor_data: {
            name: '新契約者',
            kana: 'シンケイヤクシャ',
            postal_code: '111-2222',
            address: '新住所',
            phone: '090-1111-2222'
          },
          transfer_reason: '相続'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('transferContractor');
      expect(mockContractorController.transferContractor).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
    });
  });
});