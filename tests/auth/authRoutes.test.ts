import request from 'supertest';
import express from 'express';
import authRoutes from '../../src/auth/authRoutes';
import * as authController from '../../src/auth/authController';
import * as authMiddleware from '../../src/middleware/auth';

// コントローラーのモック
jest.mock('../../src/auth/authController', () => ({
  login: jest.fn((req, res) => res.json({ success: true, controller: 'login' })),
  getCurrentUser: jest.fn((req, res) => res.json({ success: true, controller: 'getCurrentUser' })),
  register: jest.fn((req, res) => res.json({ success: true, controller: 'register' })),
  logout: jest.fn((req, res) => res.json({ success: true, controller: 'logout' })),
  updatePassword: jest.fn((req, res) => res.json({ success: true, controller: 'updatePassword' })),
  getPermissions: jest.fn((req, res) => res.json({ success: true, controller: 'getPermissions' })),
  checkPermission: jest.fn((req, res) => res.json({ success: true, controller: 'checkPermission' })),
  canResourceAction: jest.fn((req, res) => res.json({ success: true, controller: 'canResourceAction' }))
}));

// ミドルウェアのモック
jest.mock('../../src/middleware/auth', () => ({
  authenticate: jest.fn((req, res, next) => next())
}));

const mockAuthController = authController as jest.Mocked<typeof authController>;
const mockAuthMiddleware = authMiddleware as jest.Mocked<typeof authMiddleware>;

describe('Auth Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/auth', authRoutes);
    jest.clearAllMocks();
  });

  describe('POST /auth/login', () => {
    it('should handle login request', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'password' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('login');
      expect(mockAuthController.login).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /auth/register', () => {
    it('should handle register request', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123',
          role: 'viewer'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('register');
      expect(mockAuthController.register).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /auth/me', () => {
    it('should handle getCurrentUser request', async () => {
      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('getCurrentUser');
      expect(mockAuthController.getCurrentUser).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /auth/logout', () => {
    it('should handle logout request', async () => {
      const response = await request(app)
        .post('/auth/logout')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('logout');
      expect(mockAuthController.logout).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
    });
  });

  describe('PUT /auth/password', () => {
    it('should handle updatePassword request', async () => {
      const response = await request(app)
        .put('/auth/password')
        .set('Authorization', 'Bearer token')
        .send({
          currentPassword: 'oldpassword123',
          newPassword: 'newpassword123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('updatePassword');
      expect(mockAuthController.updatePassword).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /auth/permissions', () => {
    it('should handle getPermissions request', async () => {
      const response = await request(app)
        .get('/auth/permissions')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('getPermissions');
      expect(mockAuthController.getPermissions).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /auth/check-permission', () => {
    it('should handle checkPermission request', async () => {
      const response = await request(app)
        .post('/auth/check-permission')
        .set('Authorization', 'Bearer token')
        .send({
          resource: 'gravestone',
          action: 'read'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('checkPermission');
      expect(mockAuthController.checkPermission).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /auth/can/:resource/:action', () => {
    it('should handle canResourceAction request', async () => {
      const response = await request(app)
        .get('/auth/can/gravestone/read')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.controller).toBe('canResourceAction');
      expect(mockAuthController.canResourceAction).toHaveBeenCalledTimes(1);
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledTimes(1);
    });
  });
});