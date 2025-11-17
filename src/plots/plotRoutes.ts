import { Router } from 'express';
import { getPlots, getPlotById, createPlot, updatePlot } from './plotController';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { validate } from '../middleware/validation';
import {
  plotSearchQuerySchema,
  plotIdParamsSchema,
  createPlotSchema,
  updatePlotSchema,
} from '../validations/plotValidation';

const router = Router();

// 区画情報一覧取得
router.get(
  '/',
  authenticate,
  requirePermission(['viewer', 'operator', 'manager', 'admin']),
  validate({ query: plotSearchQuerySchema }),
  getPlots
);

// 区画情報詳細取得
router.get(
  '/:id',
  authenticate,
  requirePermission(['viewer', 'operator', 'manager', 'admin']),
  validate({ params: plotIdParamsSchema }),
  getPlotById
);

// 区画情報登録
router.post(
  '/',
  authenticate,
  requirePermission(['operator', 'manager', 'admin']),
  validate({ body: createPlotSchema }),
  createPlot
);

// 区画情報更新
router.put(
  '/:id',
  authenticate,
  requirePermission(['operator', 'manager', 'admin']),
  validate({ params: plotIdParamsSchema, body: updatePlotSchema }),
  updatePlot
);

export default router;
