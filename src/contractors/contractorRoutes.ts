import { Router } from 'express';
import {
  getContractorById,
  searchContractors,
  createContractor,
  updateContractor,
  deleteContractor,
  transferContractor,
} from './contractorController';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';

const router = Router();

// 契約者検索（:idより前に定義）
router.get('/search',
  authenticate,
  requirePermission(['viewer', 'operator', 'manager', 'admin']),
  searchContractors
);

// 契約者情報詳細取得
router.get('/:id',
  authenticate,
  requirePermission(['viewer', 'operator', 'manager', 'admin']),
  getContractorById
);

// 契約者情報登録
router.post('/',
  authenticate,
  requirePermission(['operator', 'manager', 'admin']),
  createContractor
);

// 契約者情報更新
router.put('/:id',
  authenticate,
  requirePermission(['operator', 'manager', 'admin']),
  updateContractor
);

// 契約者情報削除
router.delete('/:id',
  authenticate,
  requirePermission(['manager', 'admin']),
  deleteContractor
);

// 契約者変更（業務固有API）
router.post('/:id/transfer',
  authenticate,
  requirePermission(['manager', 'admin']),
  transferContractor
);

export default router;