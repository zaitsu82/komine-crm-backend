import { Router } from 'express';
import {
  createBillingInfo,
  updateBillingInfo,
  deleteBillingInfo,
  generateBillingData,
} from './billingInfoController';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';

const router = Router();

// 請求データ生成（業務固有API）- :idより前に定義
router.post('/generate',
  authenticate,
  requirePermission(['manager', 'admin']),
  generateBillingData
);

// 請求情報登録
router.post('/',
  authenticate,
  requirePermission(['operator', 'manager', 'admin']),
  createBillingInfo
);

// 請求情報更新
router.put('/:id',
  authenticate,
  requirePermission(['operator', 'manager', 'admin']),
  updateBillingInfo
);

// 請求情報削除
router.delete('/:id',
  authenticate,
  requirePermission(['manager', 'admin']),
  deleteBillingInfo
);

export default router;