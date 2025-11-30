import { Router } from 'express';
import {
  getPlots,
  getPlotById,
  createPlot,
  updatePlot,
  deletePlot,
  getPlotContracts,
  createPlotContract,
  getPlotInventory,
} from './controllers';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { validate } from '../middleware/validation';
import {
  plotSearchQuerySchema,
  plotIdParamsSchema,
  createPlotSchema,
  updatePlotSchema,
  createPlotContractSchema,
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

// 区画情報削除（論理削除）
router.delete(
  '/:id',
  authenticate,
  requirePermission(['manager', 'admin']),
  validate({ params: plotIdParamsSchema }),
  deletePlot
);

// 物理区画の契約一覧取得
router.get(
  '/:id/contracts',
  authenticate,
  requirePermission(['viewer', 'operator', 'manager', 'admin']),
  validate({ params: plotIdParamsSchema }),
  getPlotContracts
);

// 物理区画に新規契約追加
router.post(
  '/:id/contracts',
  authenticate,
  requirePermission(['operator', 'manager', 'admin']),
  validate({ params: plotIdParamsSchema, body: createPlotContractSchema }),
  createPlotContract
);

// 物理区画の在庫状況取得
router.get(
  '/:id/inventory',
  authenticate,
  requirePermission(['viewer', 'operator', 'manager', 'admin']),
  validate({ params: plotIdParamsSchema }),
  getPlotInventory
);

export default router;
