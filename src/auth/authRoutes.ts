import { Router } from 'express';
import { login, logout, getCurrentUser, changePassword } from './authController';
import { authenticate } from '../middleware/auth';
import { createAuthRateLimiter } from '../middleware/security';
import { validate } from '../middleware/validation';
import { loginSchema, changePasswordSchema } from '../validations/authValidation';

const router = Router();

// ログイン（認証不要、厳格なRate Limiting適用、バリデーション）
router.post('/login', createAuthRateLimiter(), validate({ body: loginSchema }), login);

// ログアウト（認証必要）
router.post('/logout', authenticate, logout);

// 現在のユーザー情報取得（認証必要）
router.get('/me', authenticate, getCurrentUser);

// パスワード変更（認証必要、バリデーション）
router.put('/password', authenticate, validate({ body: changePasswordSchema }), changePassword);

export default router;
