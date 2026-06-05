/**
 * 書類添付ファイルアップロード用 multer ミドルウェア
 *
 * - 10MB 制限、PDF / Word / Excel / 画像のみ許可
 * - multer 由来のエラーは 400 (VALIDATION_ERROR) へマップする
 *   （共通エラーハンドラに渡すと 500 になってしまうため）
 */

import { Request, Response, NextFunction } from 'express';
import multer from 'multer';

export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export const ALLOWED_UPLOAD_MIME_TYPES: readonly string[] = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

const UNSUPPORTED_FILE_TYPE = 'UNSUPPORTED_FILE_TYPE';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_SIZE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_UPLOAD_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
      return;
    }
    const error = new Error(UNSUPPORTED_FILE_TYPE);
    error.name = UNSUPPORTED_FILE_TYPE;
    cb(error);
  },
});

/** multipart の file フィールドを受け取り、multer エラーを 400 に変換する */
export const documentFileUpload = (req: Request, res: Response, next: NextFunction): void => {
  upload.single('file')(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof multer.MulterError) {
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'ファイルサイズが上限（10MB）を超えています'
          : 'ファイルのアップロード形式が不正です';
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message },
      });
      return;
    }
    if (err instanceof Error && err.name === UNSUPPORTED_FILE_TYPE) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '対応していないファイル形式です（PDF・Word・Excel・画像のみ）',
        },
      });
      return;
    }
    next(err);
  });
};
