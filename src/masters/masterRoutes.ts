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
  createMaster,
  updateMaster,
  deleteMaster,
} from './masterController';
import { authenticate } from '../middleware/auth';
import { checkApiPermission } from '../middleware/permission';
import { withLogging } from '../middleware/controllerLogger';

const router = Router();

// 全マスタデータ一括取得
router.get(
  '/all',
  authenticate,
  checkApiPermission(),
  withLogging('Masters', 'getAllMasters', getAllMasters)
);

// 墓地タイプマスタ
router.get(
  '/cemetery-type',
  authenticate,
  checkApiPermission(),
  withLogging('Masters', 'getCemeteryTypeMaster', getCemeteryTypeMaster)
);

// 支払方法マスタ
router.get(
  '/payment-method',
  authenticate,
  checkApiPermission(),
  withLogging('Masters', 'getPaymentMethodMaster', getPaymentMethodMaster)
);

// 税タイプマスタ
router.get(
  '/tax-type',
  authenticate,
  checkApiPermission(),
  withLogging('Masters', 'getTaxTypeMaster', getTaxTypeMaster)
);

// 計算タイプマスタ
router.get(
  '/calc-type',
  authenticate,
  checkApiPermission(),
  withLogging('Masters', 'getCalcTypeMaster', getCalcTypeMaster)
);

// 請求タイプマスタ
router.get(
  '/billing-type',
  authenticate,
  checkApiPermission(),
  withLogging('Masters', 'getBillingTypeMaster', getBillingTypeMaster)
);

// 口座タイプマスタ
router.get(
  '/account-type',
  authenticate,
  checkApiPermission(),
  withLogging('Masters', 'getAccountTypeMaster', getAccountTypeMaster)
);

// 受取人タイプマスタ
router.get(
  '/recipient-type',
  authenticate,
  checkApiPermission(),
  withLogging('Masters', 'getRecipientTypeMaster', getRecipientTypeMaster)
);

// 工事タイプマスタ
router.get(
  '/construction-type',
  authenticate,
  checkApiPermission(),
  withLogging('Masters', 'getConstructionTypeMaster', getConstructionTypeMaster)
);

// マスタデータ CRUD（汎用）
router.post(
  '/:masterType',
  authenticate,
  checkApiPermission(),
  withLogging('Masters', 'createMaster', createMaster)
);
router.put(
  '/:masterType/:id',
  authenticate,
  checkApiPermission(),
  withLogging('Masters', 'updateMaster', updateMaster)
);
router.delete(
  '/:masterType/:id',
  authenticate,
  checkApiPermission(),
  withLogging('Masters', 'deleteMaster', deleteMaster)
);

export default router;
