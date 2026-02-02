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
  getInventorySummary,
  getInventoryPeriods,
  getInventorySections,
  getInventoryAreas,
  getPlotHistory,
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
import {
  inventorySummaryQuerySchema,
  inventoryPeriodsQuerySchema,
  inventorySectionsQuerySchema,
  inventoryAreasQuerySchema,
} from '../validations/inventoryValidation';

const router = Router();

// 区画情報一覧取得
router.get(
  '/',
  authenticate,
  requirePermission(['viewer', 'operator', 'manager', 'admin']),
  validate({ query: plotSearchQuerySchema }),
  getPlots
);

// ==========================================
// 在庫管理API（/inventory/* は /:id より先に定義）
// ==========================================

// 在庫全体サマリー取得
router.get(
  '/inventory/summary',
  authenticate,
  requirePermission(['viewer', 'operator', 'manager', 'admin']),
  validate({ query: inventorySummaryQuerySchema }),
  getInventorySummary
);

// 期別サマリー取得
router.get(
  '/inventory/periods',
  authenticate,
  requirePermission(['viewer', 'operator', 'manager', 'admin']),
  validate({ query: inventoryPeriodsQuerySchema }),
  getInventoryPeriods
);

// セクション別集計取得
router.get(
  '/inventory/sections',
  authenticate,
  requirePermission(['viewer', 'operator', 'manager', 'admin']),
  validate({ query: inventorySectionsQuerySchema }),
  getInventorySections
);

// 面積別集計取得
router.get(
  '/inventory/areas',
  authenticate,
  requirePermission(['viewer', 'operator', 'manager', 'admin']),
  validate({ query: inventoryAreasQuerySchema }),
  getInventoryAreas
);

// ==========================================
// 区画情報CRUD
// ==========================================

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

// 区画の変更履歴取得
router.get(
  '/:id/history',
  authenticate,
  requirePermission(['viewer', 'operator', 'manager', 'admin']),
  validate({ params: plotIdParamsSchema }),
  getPlotHistory
);

export default router;
