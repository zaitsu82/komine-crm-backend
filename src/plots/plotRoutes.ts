import { Router } from 'express';
import { getPlots, getPlotById, createPlot } from './plotController';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';

const router = Router();

// 区画情報一覧取得
router.get(
  '/',
  authenticate,
  requirePermission(['viewer', 'operator', 'manager', 'admin']),
  getPlots
);

// 区画情報詳細取得
router.get(
  '/:id',
  authenticate,
  requirePermission(['viewer', 'operator', 'manager', 'admin']),
  getPlotById
);

// 区画情報登録
router.post(
  '/',
  authenticate,
  requirePermission(['operator', 'manager', 'admin']),
  createPlot
);

export default router;
