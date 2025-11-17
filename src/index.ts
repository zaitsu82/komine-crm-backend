import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './auth/authRoutes';
import plotRoutes from './plots/plotRoutes';
import masterRoutes from './masters/masterRoutes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestLogger, securityHeaders } from './middleware/logger';
import {
  getCorsOptions,
  createRateLimiter,
  createAuthRateLimiter,
  getHelmetOptions,
  hppProtection,
  sanitizeInput,
} from './middleware/security';

// 環境変数の読み込み
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// セキュリティミドルウェアの設定（最初に適用）
app.use(getHelmetOptions()); // Helmet: セキュリティヘッダー
app.use(cors(getCorsOptions())); // CORS設定（厳格化）
app.use(hppProtection); // HTTP Parameter Pollution対策

// ボディパーサー
app.use(express.json({ limit: '10mb' })); // JSONパーサー（サイズ制限付き）
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // URLエンコードされたボディのパーサー

// 入力サニタイゼーション（パーサーの後に適用）
app.use(sanitizeInput);

// Rate Limiting（全体）
app.use(createRateLimiter());

// リクエストログ
app.use(requestLogger);
app.use(securityHeaders); // 追加のセキュリティヘッダー

// ヘルスチェックエンドポイント
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
    },
  });
});

// APIルート
app.use('/api/v1/auth', authRoutes); // 認証ルート
app.use('/api/v1/plots', plotRoutes); // 区画情報ルート
app.use('/api/v1/masters', masterRoutes); // マスタデータルート

// 404エラーハンドラー（すべてのルートの後に配置）
app.use(notFoundHandler);

// グローバルエラーハンドラー（最後に配置）
app.use(errorHandler);

// サーバー起動処理
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║   Cemetery CRM Backend Server                          ║
╠════════════════════════════════════════════════════════╣
║   Status: Running                                      ║
║   Port: ${PORT}                                           ║
║   Environment: ${process.env.NODE_ENV || 'development'}                               ║
║   URL: http://localhost:${PORT}                           ║
║   Health Check: http://localhost:${PORT}/health           ║
╚════════════════════════════════════════════════════════╝
  `);
});
