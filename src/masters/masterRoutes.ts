import { Router } from 'express';
import {
  getUsageStatusMaster,
  getCemeteryTypeMaster,
  getDenominationMaster,
  getGenderMaster,
  getPaymentMethodMaster,
  getTaxTypeMaster,
  getCalcTypeMaster,
  getBillingTypeMaster,
  getAccountTypeMaster,
  getRecipientTypeMaster,
  getRelationMaster,
  getConstructionTypeMaster,
  getUpdateTypeMaster,
  getPrefectureMaster,
  getAllMasters,
} from './masterController';
import { authenticate } from '../middleware/auth';
import { checkApiPermission } from '../middleware/permission';

const router = Router();

// 全マスタデータ一括取得
router.get('/all', authenticate, checkApiPermission(), getAllMasters);

// 使用状況マスタ
router.get('/usage-status', authenticate, checkApiPermission(), getUsageStatusMaster);

// 墓地タイプマスタ
router.get('/cemetery-type', authenticate, checkApiPermission(), getCemeteryTypeMaster);

// 宗派マスタ
router.get('/denomination', authenticate, checkApiPermission(), getDenominationMaster);

// 性別マスタ
router.get('/gender', authenticate, checkApiPermission(), getGenderMaster);

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

// 続柄マスタ
router.get('/relation', authenticate, checkApiPermission(), getRelationMaster);

// 工事タイプマスタ
router.get('/construction-type', authenticate, checkApiPermission(), getConstructionTypeMaster);

// 更新タイプマスタ
router.get('/update-type', authenticate, checkApiPermission(), getUpdateTypeMaster);

// 都道府県マスタ
router.get('/prefecture', authenticate, checkApiPermission(), getPrefectureMaster);

export default router;
