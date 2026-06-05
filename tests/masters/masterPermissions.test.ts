/**
 * マスタAPIの権限結合テスト（#207）
 *
 * masterRoutes は app.use('/api/v1/masters', router) のサブルーターのため、
 * req.route.path がマウントパスを含まない相対パス（/all 等）になる。
 * checkApiPermission を実物のまま通し、本番同様のマウント構成で
 * 各ロールのアクセス可否を検証する（masterRoutes.test.ts は権限を
 * 全面モックしているため本バグを検出できなかった）。
 */
import request from 'supertest';
import express from 'express';

// 認証ミドルウェアのみモックし、ロールを切り替え可能にする
let currentRole = 'viewer';

jest.mock('../../src/middleware/auth', () => ({
  authenticate: jest.fn((req: any, _res: any, next: () => void) => {
    req.user = {
      id: 1,
      email: `${currentRole}@example.com`,
      name: 'Test User',
      role: currentRole,
      is_active: true,
      supabase_uid: 'test-uid',
    };
    next();
  }),
}));

// コントローラーはモック（権限ミドルウェアは実物を通す）
jest.mock('../../src/masters/masterController', () => {
  const ok = (name: string) =>
    jest.fn((_req: any, res: any) => res.status(200).json({ success: true, controller: name }));
  return {
    getCemeteryTypeMaster: ok('getCemeteryTypeMaster'),
    getPaymentMethodMaster: ok('getPaymentMethodMaster'),
    getTaxTypeMaster: ok('getTaxTypeMaster'),
    getCalcTypeMaster: ok('getCalcTypeMaster'),
    getBillingTypeMaster: ok('getBillingTypeMaster'),
    getRecipientTypeMaster: ok('getRecipientTypeMaster'),
    getConstructionTypeMaster: ok('getConstructionTypeMaster'),
    getSectionNameMaster: ok('getSectionNameMaster'),
    getRelationshipMaster: ok('getRelationshipMaster'),
    getContractorMaster: ok('getContractorMaster'),
    getDirectionMaster: ok('getDirectionMaster'),
    getPositionMaster: ok('getPositionMaster'),
    getAllMasters: ok('getAllMasters'),
    createMaster: jest.fn((_req: any, res: any) =>
      res.status(201).json({ success: true, controller: 'createMaster' })
    ),
    updateMaster: ok('updateMaster'),
    deleteMaster: ok('deleteMaster'),
  };
});

import masterRoutes from '../../src/masters/masterRoutes';

describe('Master Routes 権限結合テスト (#207)', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    // 本番（src/index.ts）と同じサブルーターマウント
    app.use('/api/v1/masters', masterRoutes);
    jest.clearAllMocks();
  });

  describe.each(['viewer', 'operator', 'manager', 'admin'])('%s ロール', (role) => {
    it(`GET /api/v1/masters/all が 200 になる`, async () => {
      currentRole = role;
      const response = await request(app).get('/api/v1/masters/all');
      expect(response.status).toBe(200);
      expect(response.body.controller).toBe('getAllMasters');
    });

    it(`GET /api/v1/masters/cemetery-type が 200 になる`, async () => {
      currentRole = role;
      const response = await request(app).get('/api/v1/masters/cemetery-type');
      expect(response.status).toBe(200);
      expect(response.body.controller).toBe('getCemeteryTypeMaster');
    });
  });

  describe('変更系はadmin専用のまま', () => {
    it.each(['viewer', 'operator', 'manager'])(
      '%s の POST /api/v1/masters/:masterType は 403 になる',
      async (role) => {
        currentRole = role;
        const response = await request(app)
          .post('/api/v1/masters/cemetery-type')
          .send({ name: 'テスト' });
        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('FORBIDDEN');
      }
    );

    it('admin の POST /api/v1/masters/:masterType は許可される', async () => {
      currentRole = 'admin';
      const response = await request(app)
        .post('/api/v1/masters/cemetery-type')
        .send({ name: 'テスト' });
      expect(response.status).toBe(201);
    });

    it('admin の DELETE /api/v1/masters/:masterType/:id は許可される', async () => {
      currentRole = 'admin';
      const response = await request(app).delete('/api/v1/masters/cemetery-type/1');
      expect(response.status).toBe(200);
    });

    it('manager の DELETE /api/v1/masters/:masterType/:id は 403 になる', async () => {
      currentRole = 'manager';
      const response = await request(app).delete('/api/v1/masters/cemetery-type/1');
      expect(response.status).toBe(403);
    });
  });
});
