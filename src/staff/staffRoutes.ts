/**
 * スタッフ管理APIルート
 * 認証必須・権限制御付き
 */
import { Router } from 'express';
import {
  getStaffList,
  getStaffById,
  createStaff,
  updateStaff,
  deleteStaff,
  toggleStaffActive,
  resendStaffInvitation,
} from './staffController';
import { authenticate } from '../middleware/auth';
import { requirePermission, ROLES } from '../middleware/permission';

const router = Router();

/**
 * @route GET /api/v1/staff
 * @desc スタッフ一覧取得
 * @access 認証必須 - manager以上
 */
router.get('/', authenticate, requirePermission([ROLES.MANAGER, ROLES.ADMIN]), getStaffList);

/**
 * @route POST /api/v1/staff
 * @desc スタッフ新規作成
 * @access 認証必須 - admin のみ
 */
router.post('/', authenticate, requirePermission([ROLES.ADMIN]), createStaff);

/**
 * @route GET /api/v1/staff/:id
 * @desc スタッフ詳細取得
 * @access 認証必須 - manager以上
 */
router.get('/:id', authenticate, requirePermission([ROLES.MANAGER, ROLES.ADMIN]), getStaffById);

/**
 * @route PUT /api/v1/staff/:id
 * @desc スタッフ更新
 * @access 認証必須 - admin のみ
 */
router.put('/:id', authenticate, requirePermission([ROLES.ADMIN]), updateStaff);

/**
 * @route DELETE /api/v1/staff/:id
 * @desc スタッフ削除（論理削除）
 * @access 認証必須 - admin のみ
 */
router.delete('/:id', authenticate, requirePermission([ROLES.ADMIN]), deleteStaff);

/**
 * @route PUT /api/v1/staff/:id/toggle-active
 * @desc スタッフ有効/無効切り替え
 * @access 認証必須 - admin のみ
 */
router.put('/:id/toggle-active', authenticate, requirePermission([ROLES.ADMIN]), toggleStaffActive);

/**
 * @route POST /api/v1/staff/:id/resend-invitation
 * @desc 招待メール再送信
 * @access 認証必須 - admin のみ
 */
router.post(
  '/:id/resend-invitation',
  authenticate,
  requirePermission([ROLES.ADMIN]),
  resendStaffInvitation
);

export default router;
