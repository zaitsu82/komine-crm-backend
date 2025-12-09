import { Router } from 'express';
import {
  getCemeteryTypeMaster,
  getPaymentMethodMaster,
  getTaxTypeMaster,
  getCalcTypeMaster,
  getBillingTypeMaster,
  getAccountTypeMaster,
  getRecipientTypeMaster,
  getConstructionTypeMaster,
  getAllMasters,
} from './masterController';
import { authenticate } from '../middleware/auth';
import { checkApiPermission } from '../middleware/permission';

const router = Router();

// 全マスタデータ一括取得
router.get('/all', authenticate, checkApiPermission(), getAllMasters);

// 墓地タイプマスタ
router.get('/cemetery-type', authenticate, checkApiPermission(), getCemeteryTypeMaster);

// 支払方法マスタ
router.get('/payment-method', authenticate, checkApiPermission(), getPaymentMethodMaster);

// 税タイプマスタ
router.get('/tax-type', authenticate, checkApiPermission(), getTaxTypeMaster);

// 計算タイプマスタ
router.get('/calc-type', authenticate, checkApiPermission(), getCalcTypeMaster);

// 請求タイプマスタ
router.get('/billing-type', authenticate, checkApiPermission(), getBillingTypeMaster);

// 口座タイプマスタ
router.get('/account-type', authenticate, checkApiPermission(), getAccountTypeMaster);

// 受取人タイプマスタ
router.get('/recipient-type', authenticate, checkApiPermission(), getRecipientTypeMaster);

// 工事タイプマスタ
router.get('/construction-type', authenticate, checkApiPermission(), getConstructionTypeMaster);

export default router;
