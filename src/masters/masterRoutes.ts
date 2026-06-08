import { Router } from 'express';
import {
  getCemeteryTypeMaster,
  getPaymentMethodMaster,
  getTaxTypeMaster,
  getCalcTypeMaster,
  getBillingTypeMaster,
  getRecipientTypeMaster,
  getConstructionTypeMaster,
  getSectionNameMaster,
  getRelationshipMaster,
  getContractorMaster,
  getDirectionMaster,
  getPositionMaster,
  getValidityPeriodMaster,
  getChangeReasonMaster,
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

// 区画名マスタ
router.get(
  '/section-name',
  authenticate,
  checkApiPermission(),
  withLogging('Masters', 'getSectionNameMaster', getSectionNameMaster)
);

// 続柄マスタ
router.get(
  '/relationship',
  authenticate,
  checkApiPermission(),
  withLogging('Masters', 'getRelationshipMaster', getRelationshipMaster)
);

// 工事業者マスタ
router.get(
  '/contractor',
  authenticate,
  checkApiPermission(),
  withLogging('Masters', 'getContractorMaster', getContractorMaster)
);

// 方角マスタ
router.get(
  '/direction',
  authenticate,
  checkApiPermission(),
  withLogging('Masters', 'getDirectionMaster', getDirectionMaster)
);

// 位置マスタ
router.get(
  '/position',
  authenticate,
  checkApiPermission(),
  withLogging('Masters', 'getPositionMaster', getPositionMaster)
);

// 合祀年数マスタ（#343）
router.get(
  '/validity-period',
  authenticate,
  checkApiPermission(),
  withLogging('Masters', 'getValidityPeriodMaster', getValidityPeriodMaster)
);

// 変更理由マスタ（#344）
router.get(
  '/change-reason',
  authenticate,
  checkApiPermission(),
  withLogging('Masters', 'getChangeReasonMaster', getChangeReasonMaster)
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
