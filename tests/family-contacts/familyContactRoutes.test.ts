import request from 'supertest';
import express from 'express';
import familyContactRoutes from '../../src/family-contacts/familyContactRoutes';

// コントローラーのモック
jest.mock('../../src/family-contacts/familyContactController', () => ({
  getFamilyContacts: jest.fn((req, res) => res.json({ success: true })),
  createFamilyContact: jest.fn((req, res) => res.json({ success: true })),
  updateFamilyContact: jest.fn((req, res) => res.json({ success: true })),
  deleteFamilyContact: jest.fn((req, res) => res.json({ success: true }))
}));

// ミドルウェアのモック
jest.mock('../../src/middleware/auth', () => ({
  authenticate: jest.fn((req, res, next) => next())
}));

jest.mock('../../src/middleware/permission', () => ({
  requirePermission: jest.fn(() => (req: any, res: any, next: any) => next())
}));

describe('FamilyContact Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/family-contacts', familyContactRoutes);
  });

  describe('GET /api/v1/family-contacts/contracts/:contract_id/family-contacts', () => {
    it('should handle getFamilyContacts request (legacy route)', async () => {
      const response = await request(app)
        .get('/api/v1/family-contacts/contracts/1/family-contacts')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/v1/family-contacts/', () => {
    it('should handle createFamilyContact request', async () => {
      const response = await request(app)
        .post('/api/v1/family-contacts/')
        .set('Authorization', 'Bearer token')
        .send({ name: 'Test Contact' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/v1/family-contacts/contracts/:contract_id/family-contacts', () => {
    it('should handle createFamilyContact request (legacy route)', async () => {
      const response = await request(app)
        .post('/api/v1/family-contacts/contracts/1/family-contacts')
        .set('Authorization', 'Bearer token')
        .send({ name: 'Test Contact' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('PUT /api/v1/family-contacts/:id', () => {
    it('should handle updateFamilyContact request', async () => {
      const response = await request(app)
        .put('/api/v1/family-contacts/1')
        .set('Authorization', 'Bearer token')
        .send({ name: 'Updated Contact' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('DELETE /api/v1/family-contacts/:id', () => {
    it('should handle deleteFamilyContact request', async () => {
      const response = await request(app)
        .delete('/api/v1/family-contacts/1')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});