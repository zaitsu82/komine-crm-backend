import request from 'supertest';
import express from 'express';
import authRoutes from '../../src/auth/authRoutes';

// コントローラーのモック
jest.mock('../../src/auth/authController', () => ({
  login: jest.fn((req, res) => res.json({ success: true })),
  getCurrentUser: jest.fn((req, res) => res.json({ success: true })),
  register: jest.fn((req, res) => res.json({ success: true })),
  logout: jest.fn((req, res) => res.json({ success: true })),
  updatePassword: jest.fn((req, res) => res.json({ success: true })),
  getPermissions: jest.fn((req, res) => res.json({ success: true })),
  checkPermission: jest.fn((req, res) => res.json({ success: true })),
  canResourceAction: jest.fn((req, res) => res.json({ success: true }))
}));

// ミドルウェアのモック
jest.mock('../../src/middleware/auth', () => ({
  authenticate: jest.fn((req, res, next) => next())
}));

describe('Auth Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/auth', authRoutes);
  });

  describe('POST /auth/login', () => {
    it('should handle login request', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'password' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /auth/me', () => {
    it('should handle getCurrentUser request', async () => {
      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});