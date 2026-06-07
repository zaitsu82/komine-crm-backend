/**
 * 顧客（解約者参照）APIルート（#311）
 * 認証必須・権限制御付き
 */
import { Router } from 'express';
import { getTerminatedCustomers } from './customerController';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { validate } from '../middleware/validation';
import { withLogging } from '../middleware/controllerLogger';
import { terminatedCustomerQuerySchema } from '../validations/customerValidation';

const router = Router();

/**
 * @route GET /api/v1/customers/terminated
 * @desc 解約者（is_terminated=true 顧客）一覧・検索
 * @access 認証必須 - viewer 以上（読み取り専用）
 */
router.get(
  '/terminated',
  authenticate,
  requirePermission(['viewer', 'operator', 'manager', 'admin']),
  validate({ query: terminatedCustomerQuerySchema }),
  withLogging('Customers', 'getTerminatedCustomers', getTerminatedCustomers)
);

export default router;
