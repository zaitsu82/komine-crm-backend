import request from 'supertest';
import express, { Express } from 'express';
import { z } from 'zod';
import plotRoutes from '../../src/plots/plotRoutes';

// モックミドルウェア
jest.mock('../../src/middleware/auth', () => ({
  authenticate: (req: any, res: any, next: any) => {
    req.user = {
      id: 1,
      email: 'test@example.com',
      name: 'テストユーザー',
      role: 'admin',
      is_active: true,
      supabase_uid: 'test-uid',
    };
    next();
  },
}));

jest.mock('../../src/middleware/permission', () => ({
  requirePermission: (roles: string[]) => (req: any, res: any, next: any) => next(),
}));

jest.mock('../../src/middleware/validation', () => ({
  validate: (schemas: any) => (req: any, res: any, next: any) => next(),
  uuidSchema: require('zod').z.string().uuid(),
  dateSchema: require('zod').z.string(),
  emailSchema: require('zod').z.string().email(),
  phoneSchema: require('zod').z.string().optional().or(require('zod').z.literal('')),
  paginationSchema: require('zod').z.object({
    page: require('zod').z.string().optional(),
    limit: require('zod').z.string().optional(),
  }),
  katakanaSchema: (fieldName?: string) => require('zod').z.string(),
  yearMonthSchema: require('zod').z.string().optional().or(require('zod').z.literal('')),
}));

// モックコントローラー
jest.mock('../../src/plots/controllers', () => ({
  getPlots: jest.fn((req, res) => res.status(200).json({ success: true, data: [] })),
  getPlotById: jest.fn((req, res) => res.status(200).json({ success: true, data: {} })),
  createPlot: jest.fn((req, res) => res.status(201).json({ success: true, data: {} })),
  updatePlot: jest.fn((req, res) => res.status(200).json({ success: true, data: {} })),
  deletePlot: jest.fn((req, res) => res.status(200).json({ success: true })),
  getPlotContracts: jest.fn((req, res) => res.status(200).json({ success: true, data: {} })),
  createPlotContract: jest.fn((req, res) => res.status(201).json({ success: true, data: {} })),
  getPlotInventory: jest.fn((req, res) => res.status(200).json({ success: true, data: {} })),
  // 在庫管理API
  getInventorySummary: jest.fn((req, res) => res.status(200).json({ success: true, data: {} })),
  getInventoryPeriods: jest.fn((req, res) =>
    res.status(200).json({ success: true, data: { periods: [] } })
  ),
  getInventorySections: jest.fn((req, res) =>
    res.status(200).json({ success: true, data: { items: [], pagination: {} } })
  ),
  getInventoryAreas: jest.fn((req, res) =>
    res.status(200).json({ success: true, data: { items: [], pagination: {} } })
  ),
}));

import {
  getPlots,
  getPlotById,
  createPlot,
  updatePlot,
  deletePlot,
  getPlotContracts,
  createPlotContract,
  getPlotInventory,
} from '../../src/plots/controllers';

describe('Plot Routes', () => {
  let app: Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/plots', plotRoutes);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/plots', () => {
    it('should call getPlots controller', async () => {
      const response = await request(app).get('/api/v1/plots');

      expect(response.status).toBe(200);
      expect(getPlots).toHaveBeenCalled();
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/v1/plots/:id', () => {
    it('should call getPlotById controller', async () => {
      const response = await request(app).get('/api/v1/plots/test-id');

      expect(response.status).toBe(200);
      expect(getPlotById).toHaveBeenCalled();
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/v1/plots', () => {
    it('should call createPlot controller', async () => {
      const mockData = {
        physicalPlot: {
          plotNumber: 'A-01',
          areaName: '一般墓地A',
          areaSqm: 3.6,
        },
        contractPlot: {
          contractAreaSqm: 3.6,
        },
        saleContract: {
          contractDate: '2024-01-01',
          price: 1000000,
        },
        customer: {
          name: '山田太郎',
          nameKana: 'ヤマダタロウ',
          postalCode: '150-0001',
          address: '東京都渋谷区',
          phoneNumber: '0312345678',
        },
      };

      const response = await request(app).post('/api/v1/plots').send(mockData);

      expect(response.status).toBe(201);
      expect(createPlot).toHaveBeenCalled();
      expect(response.body.success).toBe(true);
    });
  });

  describe('PUT /api/v1/plots/:id', () => {
    it('should call updatePlot controller', async () => {
      const mockData = {
        contractPlot: {
          saleStatus: 'completed',
        },
      };

      const response = await request(app).put('/api/v1/plots/test-id').send(mockData);

      expect(response.status).toBe(200);
      expect(updatePlot).toHaveBeenCalled();
      expect(response.body.success).toBe(true);
    });
  });

  describe('DELETE /api/v1/plots/:id', () => {
    it('should call deletePlot controller', async () => {
      const response = await request(app).delete('/api/v1/plots/test-id');

      expect(response.status).toBe(200);
      expect(deletePlot).toHaveBeenCalled();
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/v1/plots/:id/contracts', () => {
    it('should call getPlotContracts controller', async () => {
      const response = await request(app).get('/api/v1/plots/test-id/contracts');

      expect(response.status).toBe(200);
      expect(getPlotContracts).toHaveBeenCalled();
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/v1/plots/:id/contracts', () => {
    it('should call createPlotContract controller', async () => {
      const mockData = {
        contractPlot: {
          contractAreaSqm: 3.6,
        },
        saleContract: {
          contractDate: '2024-01-01',
          price: 1000000,
        },
        customer: {
          name: '田中花子',
          nameKana: 'タナカハナコ',
          postalCode: '150-0001',
          address: '東京都渋谷区',
          phoneNumber: '0312345678',
        },
      };

      const response = await request(app).post('/api/v1/plots/test-id/contracts').send(mockData);

      expect(response.status).toBe(201);
      expect(createPlotContract).toHaveBeenCalled();
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/v1/plots/:id/inventory', () => {
    it('should call getPlotInventory controller', async () => {
      const response = await request(app).get('/api/v1/plots/test-id/inventory');

      expect(response.status).toBe(200);
      expect(getPlotInventory).toHaveBeenCalled();
      expect(response.body.success).toBe(true);
    });
  });
});
