import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requirePermission, ROLES } from '../middleware/permission';
import { withLogging } from '../middleware/controllerLogger';
import {
  getBillings,
  getBillingsSummary,
  getBillingById,
  createBilling,
  updateBilling,
  deleteBilling,
} from './billingController';

const router = Router();

// 一覧取得（viewer以上）
router.get(
  '/',
  authenticate,
  requirePermission([ROLES.VIEWER, ROLES.OPERATOR, ROLES.MANAGER, ROLES.ADMIN]),
  withLogging('Billings', 'getList', getBillings)
);

// サマリー集計（viewer以上）
// ※ '/:id' より先に登録すること（後だと 'summary' が :id にマッチする）
router.get(
  '/summary',
  authenticate,
  requirePermission([ROLES.VIEWER, ROLES.OPERATOR, ROLES.MANAGER, ROLES.ADMIN]),
  withLogging('Billings', 'getSummary', getBillingsSummary)
);

// 詳細取得（viewer以上）
router.get(
  '/:id',
  authenticate,
  requirePermission([ROLES.VIEWER, ROLES.OPERATOR, ROLES.MANAGER, ROLES.ADMIN]),
  withLogging('Billings', 'getById', getBillingById)
);

// 作成（operator以上）
router.post(
  '/',
  authenticate,
  requirePermission([ROLES.OPERATOR, ROLES.MANAGER, ROLES.ADMIN]),
  withLogging('Billings', 'create', createBilling)
);

// 更新（operator以上）
router.put(
  '/:id',
  authenticate,
  requirePermission([ROLES.OPERATOR, ROLES.MANAGER, ROLES.ADMIN]),
  withLogging('Billings', 'update', updateBilling)
);

// 削除（manager以上）
router.delete(
  '/:id',
  authenticate,
  requirePermission([ROLES.MANAGER, ROLES.ADMIN]),
  withLogging('Billings', 'delete', deleteBilling)
);

export default router;
