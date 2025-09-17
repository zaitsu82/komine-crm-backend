import { Router } from 'express';
import {
  createUsageFee,
  updateUsageFee,
  deleteUsageFee,
} from './usageFeeController';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';

const router = Router();

// 使用料情報登録
router.post('/',
  authenticate,
  requirePermission(['operator', 'manager', 'admin']),
  createUsageFee
);

// 使用料情報更新
router.put('/:id',
  authenticate,
  requirePermission(['operator', 'manager', 'admin']),
  updateUsageFee
);

// 使用料情報削除
router.delete('/:id',
  authenticate,
  requirePermission(['manager', 'admin']),
  deleteUsageFee
);

export default router;