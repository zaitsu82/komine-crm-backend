/**
 * 書類管理ルート定義
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { withLogging } from '../middleware/controllerLogger';
import {
  getDocuments,
  getDocumentById,
  createDocument,
  updateDocument,
  deleteDocument,
  generatePdf,
  regeneratePdf,
} from './documentController';

const router = Router();

// 書類一覧取得
router.get(
  '/',
  authenticate,
  requirePermission(['viewer', 'operator', 'manager', 'admin']),
  withLogging('Documents', 'getDocuments', getDocuments)
);

// PDF生成（一覧より先に定義）
router.post(
  '/generate-pdf',
  authenticate,
  requirePermission(['operator', 'manager', 'admin']),
  withLogging('Documents', 'generatePdf', generatePdf)
);

// 書類詳細取得
router.get(
  '/:id',
  authenticate,
  requirePermission(['viewer', 'operator', 'manager', 'admin']),
  withLogging('Documents', 'getDocumentById', getDocumentById)
);

// 書類作成
router.post(
  '/',
  authenticate,
  requirePermission(['operator', 'manager', 'admin']),
  withLogging('Documents', 'createDocument', createDocument)
);

// 書類更新
router.put(
  '/:id',
  authenticate,
  requirePermission(['operator', 'manager', 'admin']),
  withLogging('Documents', 'updateDocument', updateDocument)
);

// 書類削除
router.delete(
  '/:id',
  authenticate,
  requirePermission(['manager', 'admin']),
  withLogging('Documents', 'deleteDocument', deleteDocument)
);

// PDF再生成（保存されたtemplate_dataからオンデマンド再生成）
router.post(
  '/:id/regenerate-pdf',
  authenticate,
  requirePermission(['operator', 'manager', 'admin']),
  withLogging('Documents', 'regeneratePdf', regeneratePdf)
);

export default router;
