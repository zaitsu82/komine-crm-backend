import { Router } from 'express';
import {
  login,
  getCurrentUser,
  register,
  logout,
  updatePassword,
  getPermissions,
  checkPermission,
  canResourceAction
} from './authController';
import { authenticate } from '../middleware/auth';

const router = Router();

// 認証不要のルート
router.post('/login', login);
router.post('/register', register);

// 認証が必要なルート
router.get('/me', authenticate, getCurrentUser);
router.post('/logout', authenticate, logout);
router.put('/password', authenticate, updatePassword);
router.get('/permissions', authenticate, getPermissions);
router.post('/check-permission', authenticate, checkPermission);
router.get('/can/:resource/:action', authenticate, canResourceAction);

export default router;