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

describe('FamilyContact Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api', familyContactRoutes);
  });

  describe('GET /api/contracts/:contract_id/family-contacts', () => {
    it('should handle getFamilyContacts request', async () => {
      const response = await request(app)
        .get('/api/contracts/1/family-contacts')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/contracts/:contract_id/family-contacts', () => {
    it('should handle createFamilyContact request', async () => {
      const response = await request(app)
        .post('/api/contracts/1/family-contacts')
        .set('Authorization', 'Bearer token')
        .send({ name: 'Test Contact' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('PUT /api/family-contacts/:contact_id', () => {
    it('should handle updateFamilyContact request', async () => {
      const response = await request(app)
        .put('/api/family-contacts/1')
        .set('Authorization', 'Bearer token')
        .send({ name: 'Updated Contact' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('DELETE /api/family-contacts/:contact_id', () => {
    it('should handle deleteFamilyContact request', async () => {
      const response = await request(app)
        .delete('/api/family-contacts/1')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});