import { Router } from 'express';
import { login, getCurrentUser } from './authController';
import { authenticate } from '../middleware/auth';

const router = Router();

// 認証不要のルート
router.post('/login', login);

// 認証が必要なルート
router.get('/me', authenticate, getCurrentUser);

export default router;