/**
 * ゆうちょ連携ルート
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requirePermission, ROLES } from '../middleware/permission';
import { withLogging } from '../middleware/controllerLogger';
import { getYuchoBilling, exportYuchoCsv } from './yuchoController';

const router = Router();

// 請求対象データ取得（manager以上）
router.get(
  '/billing',
  authenticate,
  requirePermission([ROLES.MANAGER, ROLES.ADMIN]),
  withLogging('Yucho', 'getBilling', getYuchoBilling)
);

// CSV エクスポート（manager以上）
router.get(
  '/export',
  authenticate,
  requirePermission([ROLES.MANAGER, ROLES.ADMIN]),
  withLogging('Yucho', 'exportCsv', exportYuchoCsv)
);

export default router;
