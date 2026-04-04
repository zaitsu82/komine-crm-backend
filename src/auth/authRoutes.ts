import { Router } from 'express';
import {
  login,
  logout,
  getCurrentUser,
  changePassword,
  refreshToken,
  forgotPassword,
  resetPassword,
} from './authController';
import { authenticate } from '../middleware/auth';
import { createAuthRateLimiter, createForgotPasswordRateLimiter } from '../middleware/security';
import { validate } from '../middleware/validation';
import { withLogging } from '../middleware/controllerLogger';
import {
  loginSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../validations/authValidation';

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

// パスワードリセットメール送信（認証不要、厳格なRate Limiting: 3回/15分）
router.post(
  '/forgot-password',
  createForgotPasswordRateLimiter(),
  validate({ body: forgotPasswordSchema }),
  withLogging('Auth', 'forgotPassword', forgotPassword)
);

// パスワードリセット実行（認証不要 — 招待・リセット両方で使用）
router.post(
  '/reset-password',
  createAuthRateLimiter(),
  validate({ body: resetPasswordSchema }),
  withLogging('Auth', 'resetPassword', resetPassword)
);

export default router;
