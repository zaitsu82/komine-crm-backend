/**
 * 書類管理ルート定義
 */

import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import {
  getDocuments,
  getDocumentById,
  createDocument,
  updateDocument,
  deleteDocument,
  uploadDocumentFile,
  getDocumentDownloadUrl,
  generatePdf,
  downloadLocalFile,
} from './documentController';

const router = Router();

// multerの設定（メモリストレージ）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (_req, file, cb) => {
    // 許可されるMIMEタイプ
    const allowedMimeTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('許可されていないファイル形式です'));
    }
  },
});

// 書類一覧取得
router.get(
  '/',
  authenticate,
  requirePermission(['viewer', 'operator', 'manager', 'admin']),
  getDocuments
);

// PDF生成（一覧より先に定義）
router.post(
  '/generate-pdf',
  authenticate,
  requirePermission(['operator', 'manager', 'admin']),
  generatePdf
);

// 書類詳細取得
router.get(
  '/:id',
  authenticate,
  requirePermission(['viewer', 'operator', 'manager', 'admin']),
  getDocumentById
);

// 書類作成
router.post('/', authenticate, requirePermission(['operator', 'manager', 'admin']), createDocument);

// 書類更新
router.put(
  '/:id',
  authenticate,
  requirePermission(['operator', 'manager', 'admin']),
  updateDocument
);

// 書類削除
router.delete('/:id', authenticate, requirePermission(['manager', 'admin']), deleteDocument);

// ファイルアップロード
router.post(
  '/:id/upload',
  authenticate,
  requirePermission(['operator', 'manager', 'admin']),
  upload.single('file'),
  uploadDocumentFile
);

// ダウンロードURL取得
router.get(
  '/:id/download',
  authenticate,
  requirePermission(['viewer', 'operator', 'manager', 'admin']),
  getDocumentDownloadUrl
);

// ローカルファイルダウンロード（ローカルストレージ用）
router.get(
  '/file/:fileKey',
  authenticate,
  requirePermission(['viewer', 'operator', 'manager', 'admin']),
  downloadLocalFile
);

export default router;
