import { Router } from 'express';
import {
  getGravestones,
  getGravestoneById,
  searchGravestones,
  createGravestone,
  updateGravestone,
  deleteGravestone,
} from './gravestoneController';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';

const router = Router();

// 墓石情報一覧取得
router.get('/',
  authenticate,
  requirePermission(['viewer', 'operator', 'manager', 'admin']),
  getGravestones
);

// 墓石情報検索（一覧より前に定義して、searchが:idより先に評価されるようにする）
router.get('/search',
  authenticate,
  requirePermission(['viewer', 'operator', 'manager', 'admin']),
  searchGravestones
);

// 墓石情報詳細取得
router.get('/:id',
  authenticate,
  requirePermission(['viewer', 'operator', 'manager', 'admin']),
  getGravestoneById
);

// 墓石情報登録
router.post('/',
  authenticate,
  requirePermission(['operator', 'manager', 'admin']),
  createGravestone
);

// 墓石情報更新
router.put('/:id',
  authenticate,
  requirePermission(['operator', 'manager', 'admin']),
  updateGravestone
);

// 墓石情報削除
router.delete('/:id',
  authenticate,
  requirePermission(['manager', 'admin']),
  deleteGravestone
);

export default router;