/**
 * 合祀管理ルート
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requirePermission, ROLES } from '../middleware/permission';
import {
  getCollectiveBurialList,
  getCollectiveBurialById,
  createCollectiveBurial,
  updateCollectiveBurial,
  updateBillingStatus,
  deleteCollectiveBurial,
  syncBurialCount,
  getStatsByYear,
} from './collectiveBurialController';

const router = Router();

// 一覧取得（manager以上）
router.get(
  '/',
  authenticate,
  requirePermission([ROLES.MANAGER, ROLES.ADMIN]),
  getCollectiveBurialList
);

// 年別統計取得（manager以上）
router.get(
  '/stats/by-year',
  authenticate,
  requirePermission([ROLES.MANAGER, ROLES.ADMIN]),
  getStatsByYear
);

// 詳細取得（manager以上）
router.get(
  '/:id',
  authenticate,
  requirePermission([ROLES.MANAGER, ROLES.ADMIN]),
  getCollectiveBurialById
);

// 作成（admin）
router.post('/', authenticate, requirePermission([ROLES.ADMIN]), createCollectiveBurial);

// 更新（admin）
router.put('/:id', authenticate, requirePermission([ROLES.ADMIN]), updateCollectiveBurial);

// 請求ステータス更新（manager以上）
router.put(
  '/:id/billing-status',
  authenticate,
  requirePermission([ROLES.MANAGER, ROLES.ADMIN]),
  updateBillingStatus
);

// 埋葬人数同期（manager以上）
router.post(
  '/:id/sync-count',
  authenticate,
  requirePermission([ROLES.MANAGER, ROLES.ADMIN]),
  syncBurialCount
);

// 削除（admin）
router.delete('/:id', authenticate, requirePermission([ROLES.ADMIN]), deleteCollectiveBurial);

export default router;
