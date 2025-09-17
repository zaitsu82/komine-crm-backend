import { Router } from 'express';
import {
  createManagementFee,
  updateManagementFee,
  deleteManagementFee,
  calculateManagementFee,
} from './managementFeeController';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';

const router = Router();

// 管理料計算（業務固有API）- :idより前に定義
router.post('/calculate',
  authenticate,
  requirePermission(['operator', 'manager', 'admin']),
  calculateManagementFee
);

// 管理料情報登録
router.post('/',
  authenticate,
  requirePermission(['operator', 'manager', 'admin']),
  createManagementFee
);

// 管理料情報更新
router.put('/:id',
  authenticate,
  requirePermission(['operator', 'manager', 'admin']),
  updateManagementFee
);

// 管理料情報削除
router.delete('/:id',
  authenticate,
  requirePermission(['manager', 'admin']),
  deleteManagementFee
);

export default router;