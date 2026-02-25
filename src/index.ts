// 環境変数の読み込み（最初に実行）
import dotenv from 'dotenv';
dotenv.config();

// Sentry初期化（すべてのimportとミドルウェアより前）
import { initializeSentry } from './utils/sentry';
import * as Sentry from '@sentry/node';
initializeSentry();

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import swaggerDocument from './swagger.json';
import authRoutes from './auth/authRoutes';
import plotRoutes from './plots/plotRoutes';
import masterRoutes from './masters/masterRoutes';
import staffRoutes from './staff/staffRoutes';
import collectiveBurialRoutes from './collective-burials/collectiveBurialRoutes';
import documentRoutes from './documents/documentRoutes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestLogger, securityHeaders } from './middleware/logger';
import {
  getCorsOptions,
  createRateLimiter,
  getHelmetOptions,
  hppProtection,
  sanitizeInput,
} from './middleware/security';
import { prisma } from './db/prisma';

const app = express();
const PORT = process.env['PORT'] || 4000;

// プロキシ信頼設定（Render等のリバースプロキシ環境で必要）
app.set('trust proxy', 1);

// セキュリティミドルウェアの設定（最初に適用）
app.use(getHelmetOptions()); // Helmet: セキュリティヘッダー
app.use(cors(getCorsOptions())); // CORS設定（厳格化）
app.use(hppProtection); // HTTP Parameter Pollution対策

// ボディパーサー
app.use(express.json({ limit: '10mb' })); // JSONパーサー（サイズ制限付き）
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // URLエンコードされたボディのパーサー

// Cookieパーサー（HttpOnly Cookie認証用）
app.use(cookieParser());

// 入力サニタイゼーション（パーサーの後に適用）
app.use(sanitizeInput);

// Rate Limiting（全体）
app.use(createRateLimiter());

// リクエストログ
app.use(requestLogger);
app.use(securityHeaders); // 追加のセキュリティヘッダー

// ヘルスチェックエンドポイント
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      success: true,
      data: {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env['NODE_ENV'] || 'development',
        database: 'connected',
      },
    });
  } catch {
    res.status(503).json({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'データベース接続に失敗しました',
        details: [],
      },
    });
  }
});

// Swagger UI（API仕様書）
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument, {
    customCss: '.swagger-ui .topbar { display: none }', // Swagger UIのトップバーを非表示
    customSiteTitle: '墓石管理システム API Documentation',
  })
);

// APIルート
app.use('/api/v1/auth', authRoutes); // 認証ルート
app.use('/api/v1/plots', plotRoutes); // 区画情報ルート
app.use('/api/v1/masters', masterRoutes); // マスタデータルート
app.use('/api/v1/staff', staffRoutes); // スタッフ管理ルート
app.use('/api/v1/collective-burials', collectiveBurialRoutes); // 合祀管理ルート
app.use('/api/v1/documents', documentRoutes); // 書類管理ルート

// 404エラーハンドラー（すべてのルートの後に配置）
app.use(notFoundHandler);

// Sentryエラーハンドラー（notFoundHandlerの後、errorHandlerの前）
Sentry.setupExpressErrorHandler(app);

// グローバルエラーハンドラー（最後に配置）
app.use(errorHandler);

// サーバー起動処理
const server = app.listen(PORT, () => {
  const baseUrl =
    process.env['BASE_URL'] || process.env['RENDER_EXTERNAL_URL'] || `http://localhost:${PORT}`;
  const env = process.env['NODE_ENV'] || 'development';

  const title = 'Cemetery CRM Backend Server';
  const contentLines = [
    `Status: Running`,
    `Port: ${PORT}`,
    `Environment: ${env}`,
    `URL: ${baseUrl}`,
    `Health Check: ${baseUrl}/health`,
    `API Docs: ${baseUrl}/api-docs`,
  ];
  const maxLen = Math.max(title.length, ...contentLines.map((l) => l.length));
  const innerWidth = maxLen + 6;
  const hr = '═'.repeat(innerWidth);
  const pad = (s: string) => `║   ${s.padEnd(innerWidth - 3)}║`;

  console.log(
    ['', `╔${hr}╗`, pad(title), `╠${hr}╣`, ...contentLines.map(pad), `╚${hr}╝`, ''].join('\n')
  );
});

// グレースフルシャットダウン
const gracefulShutdown = async (signal: string) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  server.close(async () => {
    console.log('HTTP server closed.');
    try {
      await prisma.$disconnect();
      console.log('Database connection closed.');
    } catch {
      console.error('Error disconnecting from database.');
    }
    console.log('Server shut down gracefully.');
    process.exit(0);
  });

  // 30秒後に強制終了
  setTimeout(() => {
    console.error('Forced shutdown due to timeout.');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
