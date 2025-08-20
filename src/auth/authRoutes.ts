import express from 'express';
import { loginHandler } from './authController';

const router = express.Router();

// ログインルート
router.post('/login', loginHandler);

// ログアウトルート
router.post('/logout', loginHandler);

export default router;
