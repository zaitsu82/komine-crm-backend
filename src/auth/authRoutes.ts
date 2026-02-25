import { Router } from 'express';
import { login, logout, getCurrentUser, changePassword, refreshToken } from './authController';
import { authenticate } from '../middleware/auth';
import { createAuthRateLimiter } from '../middleware/security';
import { validate } from '../middleware/validation';
import { withLogging } from '../middleware/controllerLogger';
import { loginSchema, changePasswordSchema } from '../validations/authValidation';

const router = Router();

// ログイン（認証不要、厳格なRate Limiting適用、バリデーション）
router.post(
  '/login',
  createAuthRateLimiter(),
  validate({ body: loginSchema }),
  withLogging('Auth', 'login', login)
);

// トークンリフレッシュ（認証不要、Rate Limiting適用）
router.post('/refresh', createAuthRateLimiter(), withLogging('Auth', 'refreshToken', refreshToken));

// ログアウト（認証必要）
router.post('/logout', authenticate, withLogging('Auth', 'logout', logout));

// 現在のユーザー情報取得（認証必要）
router.get('/me', authenticate, withLogging('Auth', 'getCurrentUser', getCurrentUser));

// パスワード変更（認証必要、バリデーション）
router.put(
  '/password',
  authenticate,
  validate({ body: changePasswordSchema }),
  withLogging('Auth', 'changePassword', changePassword)
);

export default router;
