import { Router } from 'express';
import {
  searchBurials,
  createBurial,
  updateBurial,
  deleteBurial,
  getBurials, // 後方互換性のため
} from './burialController';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';

const router = Router();

// 埋葬者検索（:idより前に定義）
router.get('/search',
  authenticate,
  requirePermission(['viewer', 'operator', 'manager', 'admin']),
  searchBurials
);

// 埋葬者情報登録
router.post('/',
  authenticate,
  requirePermission(['operator', 'manager', 'admin']),
  createBurial
);

// 埋葬者情報更新
router.put('/:id',
  authenticate,
  requirePermission(['operator', 'manager', 'admin']),
  updateBurial
);

// 埋葬者情報削除
router.delete('/:id',
  authenticate,
  requirePermission(['manager', 'admin']),
  deleteBurial
);

// 後方互換性のためのレガシールート（非推奨）
router.get('/contracts/:contract_id/burials',
  authenticate,
  getBurials
);
router.post('/contracts/:contract_id/burials',
  authenticate,
  createBurial
);

export default router;