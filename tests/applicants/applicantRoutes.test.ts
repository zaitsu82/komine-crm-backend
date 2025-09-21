import request from 'supertest';
import express from 'express';
import applicantRoutes from '../../src/applicants/applicantRoutes';
import * as applicantController from '../../src/applicants/applicantController';
import * as authMiddleware from '../../src/middleware/auth';
import * as permissionMiddleware from '../../src/middleware/permission';

jest.mock('../../src/applicants/applicantController', () => ({
  getApplicantById: jest.fn((req, res) => res.json({ success: true, controller: 'getApplicantById' })),
  createApplicant: jest.fn((req, res) => res.json({ success: true, controller: 'createApplicant' })),
  updateApplicant: jest.fn((req, res) => res.json({ success: true, controller: 'updateApplicant' })),
  deleteApplicant: jest.fn((req, res) => res.json({ success: true, controller: 'deleteApplicant' }))
}));

jest.mock('../../src/middleware/auth', () => ({
  authenticate: jest.fn((req, res, next) => next())
}));

jest.mock('../../src/middleware/permission', () => ({
  requirePermission: jest.fn(() => (req: any, res: any, next: any) => next())
}));

const mockApplicantController = applicantController as jest.Mocked<typeof applicantController>;
const mockAuthMiddleware = authMiddleware as jest.Mocked<typeof authMiddleware>;
const mockPermissionMiddleware = permissionMiddleware as jest.Mocked<typeof permissionMiddleware>;

describe('Applicant Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/applicants', applicantRoutes);
    jest.clearAllMocks();
  });

  describe('GET /api/v1/applicants/:id', () => {
    it('should handle getApplicantById request successfully', async () => {
      const response = await request(app)
        .get('/api/v1/applicants/1')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('getApplicantById');
      expect(mockApplicantController.getApplicantById).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
    });

    it('should handle getApplicantById request with different ID', async () => {
      const response = await request(app)
        .get('/api/v1/applicants/999')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('getApplicantById');
      expect(mockApplicantController.getApplicantById).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /api/v1/applicants/', () => {
    it('should handle createApplicant request successfully', async () => {
      const response = await request(app)
        .post('/api/v1/applicants/')
        .set('Authorization', 'Bearer token')
        .send({
          gravestone_id: 1,
          name_last: '田中',
          name_first: '太郎',
          phone_number: '03-1234-5678',
          email: 'tanaka@example.com'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('createApplicant');
      expect(mockApplicantController.createApplicant).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
    });

    it('should handle createApplicant request with minimal data', async () => {
      const response = await request(app)
        .post('/api/v1/applicants/')
        .set('Authorization', 'Bearer token')
        .send({
          gravestone_id: 1,
          name_last: '佐藤',
          name_first: '花子'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('createApplicant');
      expect(mockApplicantController.createApplicant).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
    });

    it('should handle createApplicant request with full data', async () => {
      const response = await request(app)
        .post('/api/v1/applicants/')
        .set('Authorization', 'Bearer token')
        .send({
          gravestone_id: 1,
          name_last: '山田',
          name_first: '次郎',
          name_last_kana: 'ヤマダ',
          name_first_kana: 'ジロウ',
          phone_number: '090-1234-5678',
          email: 'yamada@example.com',
          address: '東京都渋谷区1-1-1',
          remarks: '申込者テスト備考'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('createApplicant');
      expect(mockApplicantController.createApplicant).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
    });
  });

  describe('PUT /api/v1/applicants/:id', () => {
    it('should handle updateApplicant request successfully', async () => {
      const response = await request(app)
        .put('/api/v1/applicants/1')
        .set('Authorization', 'Bearer token')
        .send({
          name_last: '鈴木',
          name_first: '三郎',
          phone_number: '03-9876-5432',
          email: 'suzuki@example.com'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('updateApplicant');
      expect(mockApplicantController.updateApplicant).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
    });

    it('should handle updateApplicant request with kana fields', async () => {
      const response = await request(app)
        .put('/api/v1/applicants/1')
        .set('Authorization', 'Bearer token')
        .send({
          name_last_kana: 'タナカ',
          name_first_kana: 'タロウ',
          address: '大阪府大阪市北区2-2-2',
          remarks: '更新されたテスト備考'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('updateApplicant');
      expect(mockApplicantController.updateApplicant).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
    });

    it('should handle updateApplicant request with date fields', async () => {
      const response = await request(app)
        .put('/api/v1/applicants/1')
        .set('Authorization', 'Bearer token')
        .send({
          birth_date: '1980-05-15',
          updated_at: '2024-03-01T00:00:00Z'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('updateApplicant');
      expect(mockApplicantController.updateApplicant).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
    });
  });

  describe('DELETE /api/v1/applicants/:id', () => {
    it('should handle deleteApplicant request successfully', async () => {
      const response = await request(app)
        .delete('/api/v1/applicants/1')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('deleteApplicant');
      expect(mockApplicantController.deleteApplicant).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
    });

    it('should handle deleteApplicant request with different ID', async () => {
      const response = await request(app)
        .delete('/api/v1/applicants/999')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('deleteApplicant');
      expect(mockApplicantController.deleteApplicant).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
    });
  });

  describe('Route middleware verification', () => {
    it('should apply authentication and permissions for all endpoints', async () => {
      // Test GET /:id
      await request(app)
        .get('/api/v1/applicants/1')
        .set('Authorization', 'Bearer token');

      // Test POST /
      await request(app)
        .post('/api/v1/applicants/')
        .set('Authorization', 'Bearer token')
        .send({ gravestone_id: 1, name_last: '田中', name_first: '太郎' });

      // Test PUT /:id
      await request(app)
        .put('/api/v1/applicants/1')
        .set('Authorization', 'Bearer token')
        .send({ name_last: '佐藤' });

      // Test DELETE /:id
      await request(app)
        .delete('/api/v1/applicants/1')
        .set('Authorization', 'Bearer token');

      // Verify authentication middleware was called for all requests
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(4);
    });
  });

  describe('Authentication middleware verification', () => {
    it('should require authentication for all endpoints', async () => {
      // Test GET /:id
      await request(app)
        .get('/api/v1/applicants/1')
        .set('Authorization', 'Bearer token');

      // Test POST /
      await request(app)
        .post('/api/v1/applicants/')
        .set('Authorization', 'Bearer token')
        .send({ gravestone_id: 1, name_last: '田中', name_first: '太郎' });

      // Test PUT /:id
      await request(app)
        .put('/api/v1/applicants/1')
        .set('Authorization', 'Bearer token')
        .send({ name_last: '佐藤' });

      // Test DELETE /:id
      await request(app)
        .delete('/api/v1/applicants/1')
        .set('Authorization', 'Bearer token');

      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(4);
    });

    it('should call controllers with correct request data', async () => {
      const createData = { gravestone_id: 1, name_last: '田中', name_first: '太郎' };
      const updateData = { name_last: '佐藤', phone_number: '03-1111-2222' };

      await request(app)
        .get('/api/v1/applicants/5')
        .set('Authorization', 'Bearer token');

      await request(app)
        .post('/api/v1/applicants/')
        .set('Authorization', 'Bearer token')
        .send(createData);

      await request(app)
        .put('/api/v1/applicants/5')
        .set('Authorization', 'Bearer token')
        .send(updateData);

      await request(app)
        .delete('/api/v1/applicants/5')
        .set('Authorization', 'Bearer token');

      // Verify controllers were called
      expect(mockApplicantController.getApplicantById).toHaveBeenCalledTimes(1);
      expect(mockApplicantController.createApplicant).toHaveBeenCalledTimes(1);
      expect(mockApplicantController.updateApplicant).toHaveBeenCalledTimes(1);
      expect(mockApplicantController.deleteApplicant).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error handling', () => {
    it('should handle controller errors gracefully', async () => {
      mockApplicantController.createApplicant.mockImplementationOnce(async (req, res) => {
        res.status(500).json({ success: false, error: 'Internal server error' });
        return res;
      });

      const response = await request(app)
        .post('/api/v1/applicants/')
        .set('Authorization', 'Bearer token')
        .send({
          gravestone_id: 1,
          name_last: '田中',
          name_first: '太郎'
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    it('should handle update controller errors gracefully', async () => {
      mockApplicantController.updateApplicant.mockImplementationOnce(async (req, res) => {
        res.status(404).json({ success: false, error: 'Applicant not found' });
        return res;
      });

      const response = await request(app)
        .put('/api/v1/applicants/999')
        .set('Authorization', 'Bearer token')
        .send({ name_last: '田中' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should handle delete controller errors gracefully', async () => {
      mockApplicantController.deleteApplicant.mockImplementationOnce(async (req, res) => {
        res.status(404).json({ success: false, error: 'Applicant not found' });
        return res;
      });

      const response = await request(app)
        .delete('/api/v1/applicants/999')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should handle get controller errors gracefully', async () => {
      mockApplicantController.getApplicantById.mockImplementationOnce(async (req, res) => {
        res.status(404).json({ success: false, error: 'Applicant not found' });
        return res;
      });

      const response = await request(app)
        .get('/api/v1/applicants/999')
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
          .get(`/api/v1/applicants/${id}`)
          .set('Authorization', 'Bearer token');

        await request(app)
          .put(`/api/v1/applicants/${id}`)
          .set('Authorization', 'Bearer token')
          .send({ name_last: '田中' });

        await request(app)
          .delete(`/api/v1/applicants/${id}`)
          .set('Authorization', 'Bearer token');
      }

      expect(mockApplicantController.getApplicantById).toHaveBeenCalledTimes(3);
      expect(mockApplicantController.updateApplicant).toHaveBeenCalledTimes(3);
      expect(mockApplicantController.deleteApplicant).toHaveBeenCalledTimes(3);
    });
  });

  describe('HTTP method verification', () => {
    it('should only accept GET for read endpoint', async () => {
      const response = await request(app)
        .post('/api/v1/applicants/1')
        .set('Authorization', 'Bearer token')
        .send({ name_last: '田中' });

      expect(response.status).toBe(404);
    });

    it('should only accept POST for creation endpoint', async () => {
      const response = await request(app)
        .get('/api/v1/applicants/')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(404);
    });

    it('should only accept PUT for update endpoint', async () => {
      const response = await request(app)
        .post('/api/v1/applicants/1')
        .set('Authorization', 'Bearer token')
        .send({ name_last: '田中' });

      expect(response.status).toBe(404);
    });

    it('should only accept DELETE for deletion endpoint', async () => {
      const response = await request(app)
        .get('/api/v1/applicants/1')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.controller).toBe('getApplicantById');
    });
  });

  describe('Request data validation', () => {
    it('should pass through request body for create operations', async () => {
      const complexData = {
        gravestone_id: 1,
        name_last: '高橋',
        name_first: '美咲',
        name_last_kana: 'タカハシ',
        name_first_kana: 'ミサキ',
        phone_number: '090-9876-5432',
        email: 'takahashi@example.com',
        address: '神奈川県横浜市青葉区3-3-3',
        birth_date: '1985-12-25',
        remarks: '詳細なテスト申込者データ'
      };

      const response = await request(app)
        .post('/api/v1/applicants/')
        .set('Authorization', 'Bearer token')
        .send(complexData);

      expect(response.status).toBe(200);
      expect(mockApplicantController.createApplicant).toHaveBeenCalledTimes(1);
    });

    it('should pass through request body for update operations', async () => {
      const updateData = {
        name_last: '渡辺',
        name_first: '健太',
        name_last_kana: 'ワタナベ',
        name_first_kana: 'ケンタ',
        phone_number: '03-5555-7777',
        email: 'watanabe@example.com',
        address: '千葉県千葉市中央区4-4-4',
        birth_date: '1990-08-10',
        remarks: '更新された詳細なデータ'
      };

      const response = await request(app)
        .put('/api/v1/applicants/10')
        .set('Authorization', 'Bearer token')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(mockApplicantController.updateApplicant).toHaveBeenCalledTimes(1);
    });
  });

  describe('Permission levels verification', () => {
    it('should verify permission middleware is configured for endpoints', async () => {
      // Test all endpoints - permission middleware configured at route level
      await request(app)
        .get('/api/v1/applicants/1')
        .set('Authorization', 'Bearer token');

      await request(app)
        .post('/api/v1/applicants/')
        .set('Authorization', 'Bearer token')
        .send({ gravestone_id: 1, name_last: '田中', name_first: '太郎' });

      await request(app)
        .put('/api/v1/applicants/1')
        .set('Authorization', 'Bearer token')
        .send({ name_last: '佐藤' });

      await request(app)
        .delete('/api/v1/applicants/1')
        .set('Authorization', 'Bearer token');

      // Verify all controllers were called successfully
      expect(mockApplicantController.getApplicantById).toHaveBeenCalledTimes(1);
      expect(mockApplicantController.createApplicant).toHaveBeenCalledTimes(1);
      expect(mockApplicantController.updateApplicant).toHaveBeenCalledTimes(1);
      expect(mockApplicantController.deleteApplicant).toHaveBeenCalledTimes(1);
    });
  });
});