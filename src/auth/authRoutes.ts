import { Router } from 'express';
import { login, logout, getCurrentUser, changePassword } from './authController';
import { authenticate } from '../middleware/auth';

const router = Router();

// ログイン（認証不要）
router.post('/login', login);

// ログアウト（認証必要）
router.post('/logout', authenticate, logout);

// 現在のユーザー情報取得（認証必要）
router.get('/me', authenticate, getCurrentUser);

// パスワード変更（認証必要）
router.put('/password', authenticate, changePassword);

export default router;
