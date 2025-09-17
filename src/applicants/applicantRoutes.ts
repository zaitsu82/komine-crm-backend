import { Router } from 'express';
import {
  getApplicantById,
  createApplicant,
  updateApplicant,
  deleteApplicant,
} from './applicantController';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';

const router = Router();

// 申込者情報詳細取得
router.get('/:id',
  authenticate,
  requirePermission(['viewer', 'operator', 'manager', 'admin']),
  getApplicantById
);

// 申込者情報登録
router.post('/',
  authenticate,
  requirePermission(['operator', 'manager', 'admin']),
  createApplicant
);

// 申込者情報更新
router.put('/:id',
  authenticate,
  requirePermission(['operator', 'manager', 'admin']),
  updateApplicant
);

// 申込者情報削除
router.delete('/:id',
  authenticate,
  requirePermission(['manager', 'admin']),
  deleteApplicant
);

export default router;