import { Router } from 'express';
import {
  createFamilyContact,
  updateFamilyContact,
  deleteFamilyContact,
  getFamilyContacts, // 後方互換性のため
} from './familyContactController';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';

const router = Router();

// 家族連絡先情報登録
router.post('/',
  authenticate,
  requirePermission(['operator', 'manager', 'admin']),
  createFamilyContact
);

// 家族連絡先情報更新
router.put('/:id',
  authenticate,
  requirePermission(['operator', 'manager', 'admin']),
  updateFamilyContact
);

// 家族連絡先情報削除
router.delete('/:id',
  authenticate,
  requirePermission(['manager', 'admin']),
  deleteFamilyContact
);

// 後方互換性のためのレガシールート（非推奨）
router.get('/contracts/:contract_id/family-contacts',
  authenticate,
  getFamilyContacts
);
router.post('/contracts/:contract_id/family-contacts',
  authenticate,
  createFamilyContact
);

export default router;