import { Request, Response } from 'express';

// Express.Request型を拡張（認証ミドルウェアで使用される型定義）
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        name: string;
        role: string;
        is_active: boolean;
        supabase_uid: string;
      };
    }
  }
}

// モックプリズマインスタンスの作成
const mockPrisma: any = {
  plot: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  applicant: {
    create: jest.fn(),
    update: jest.fn(),
  },
  contractor: {
    create: jest.fn(),
    update: jest.fn(),
  },
  usageFee: {
    create: jest.fn(),
    update: jest.fn(),
  },
  managementFee: {
    create: jest.fn(),
    update: jest.fn(),
  },
  gravestoneInfo: {
    create: jest.fn(),
    update: jest.fn(),
  },
  constructionInfo: {
    create: jest.fn(),
    update: jest.fn(),
  },
  emergencyContact: {
    create: jest.fn(),
    update: jest.fn(),
  },
  familyContact: {
    create: jest.fn(),
    update: jest.fn(),
  },
  buriedPerson: {
    create: jest.fn(),
    update: jest.fn(),
  },
  workInfo: {
    create: jest.fn(),
    update: jest.fn(),
  },
  billingInfo: {
    create: jest.fn(),
    update: jest.fn(),
  },
  history: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  $transaction: jest.fn((callback: any) => callback(mockPrisma)),
};

// PrismaClientをモック化
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

import { getPlots, getPlotById, createPlot, updatePlot } from '../../src/plots/plotController';

describe('Plot Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockRequest = {
      params: {},
      body: {},
      query: {},
      user: {
        id: 1,
        name: 'テストユーザー',
        email: 'test@example.com',
        role: 'admin',
        is_active: true,
        supabase_uid: 'test-uid',
      },
      ip: '127.0.0.1',
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    jest.clearAllMocks();

    // console.errorをモック化してログ出力を抑制
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ========================================
  // Phase 1: 基本テスト - updatePlot
  // ========================================
  describe('updatePlot', () => {
    const existingPlot = {
      id: 'plot-uuid-1',
      plot_number: 'A-001',
      section: 'A',
      usage: 'in_use',
      size: '3.0㎡',
      price: '1000000',
      contract_date: new Date('2024-01-01'),
      status: 'active',
      notes: 'テスト区画',
      deleted_at: null,
      created_at: new Date('2024-01-01'),
      updated_at: new Date('2024-01-01'),
      Applicant: null,
      Contractors: [],
      UsageFee: null,
      ManagementFee: null,
      GravestoneInfo: null,
      ConstructionInfo: null,
      EmergencyContact: null,
      FamilyContacts: [],
      BuriedPersons: [],
    };

    describe('基本動作', () => {
      it('should return 404 when plot not found', async () => {
        mockRequest.params = { id: 'non-existent-id' };
        mockRequest.body = { plot: { price: '1200000' } };
        mockPrisma.plot.findUnique.mockResolvedValue(null);

        await updatePlot(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(404);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: '指定された区画が見つかりません',
          },
        });
      });

      it('should return 404 when plot is soft deleted', async () => {
        mockRequest.params = { id: 'deleted-plot-id' };
        mockRequest.body = { plot: { price: '1200000' } };
        mockPrisma.plot.findUnique.mockResolvedValue({
          ...existingPlot,
          deleted_at: new Date(),
        });

        await updatePlot(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(404);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: '指定された区画が見つかりません',
          },
        });
      });

      it('should handle database error', async () => {
        mockRequest.params = { id: 'plot-uuid-1' };
        mockRequest.body = { plot: { price: '1200000' } };
        mockPrisma.plot.findUnique.mockRejectedValue(new Error('Database error'));

        await updatePlot(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: '区画情報の更新に失敗しました',
            details: [],
          },
        });
      });

      it('should handle Prisma unique constraint error (P2002)', async () => {
        mockRequest.params = { id: 'plot-uuid-1' };
        mockRequest.body = { plot: { price: '1500000' } }; // plotNumber以外のフィールドで更新

        mockPrisma.plot.findUnique.mockResolvedValue(existingPlot);

        // トランザクション内でP2002エラーが発生
        const prismaError: any = new Error('Unique constraint failed');
        prismaError.code = 'P2002';
        mockPrisma.$transaction.mockRejectedValue(prismaError);

        await updatePlot(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(409);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'DUPLICATE_ERROR',
            message: '重複するデータが存在します',
            details: [],
          },
        });
      });
    });

    describe('区画情報（plot）の更新', () => {
      it('should update basic plot fields successfully', async () => {
        mockRequest.params = { id: 'plot-uuid-1' };
        mockRequest.body = {
          plot: {
            section: 'B',
            usage: 'available',
            size: '4.0㎡',
            price: '1500000',
          },
        };

        mockPrisma.plot.findUnique
          .mockResolvedValueOnce(existingPlot) // 存在確認
          .mockResolvedValueOnce({ ...existingPlot, section: 'B' }); // トランザクション後の取得

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          await callback(mockPrisma);
          return { ...existingPlot, section: 'B' };
        });

        await updatePlot(mockRequest as Request, mockResponse as Response);

        expect(mockPrisma.plot.update).toHaveBeenCalledWith({
          where: { id: 'plot-uuid-1' },
          data: {
            section: 'B',
            usage: 'available',
            size: '4.0㎡',
            price: '1500000',
          },
        });

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          data: {
            id: existingPlot.id,
            plotNumber: existingPlot.plot_number,
            message: '区画情報を更新しました',
          },
        });
      });

      it('should update plotNumber when not duplicate', async () => {
        mockRequest.params = { id: 'plot-uuid-1' };
        mockRequest.body = {
          plot: {
            plotNumber: 'A-002',
          },
        };

        mockPrisma.plot.findUnique
          .mockResolvedValueOnce(existingPlot) // 存在確認
          .mockResolvedValueOnce(null) // 重複チェック（重複なし）
          .mockResolvedValueOnce({ ...existingPlot, plot_number: 'A-002' }); // トランザクション後

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          await callback(mockPrisma);
          return { ...existingPlot, plot_number: 'A-002' };
        });

        await updatePlot(mockRequest as Request, mockResponse as Response);

        expect(mockPrisma.plot.update).toHaveBeenCalledWith({
          where: { id: 'plot-uuid-1' },
          data: {
            plot_number: 'A-002',
          },
        });

        expect(mockResponse.status).toHaveBeenCalledWith(200);
      });

      it('should return 409 when plotNumber is duplicate', async () => {
        mockRequest.params = { id: 'plot-uuid-1' };
        mockRequest.body = {
          plot: {
            plotNumber: 'A-002',
          },
        };

        mockPrisma.plot.findUnique
          .mockResolvedValueOnce(existingPlot) // 存在確認
          .mockResolvedValueOnce({ id: 'other-plot-id', plot_number: 'A-002' }); // 重複チェック（重複あり）

        await updatePlot(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(409);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'DUPLICATE_PLOT_NUMBER',
            message: '区画番号が既に存在します',
            details: [{ field: 'plotNumber', message: '区画番号 A-002 は既に使用されています' }],
          },
        });
      });

      it('should allow updating plotNumber to same value', async () => {
        mockRequest.params = { id: 'plot-uuid-1' };
        mockRequest.body = {
          plot: {
            plotNumber: 'A-001', // 同じ区画番号
            price: '1200000',
          },
        };

        mockPrisma.plot.findUnique
          .mockResolvedValueOnce(existingPlot)
          .mockResolvedValueOnce({ ...existingPlot, price: '1200000' });

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          await callback(mockPrisma);
          return { ...existingPlot, price: '1200000' };
        });

        await updatePlot(mockRequest as Request, mockResponse as Response);

        // 重複チェックは実行されない（同じ値なので）
        expect(mockPrisma.plot.findUnique).toHaveBeenCalledTimes(2); // 存在確認とトランザクション後のみ
        expect(mockResponse.status).toHaveBeenCalledWith(200);
      });

      it('should update contractDate field', async () => {
        mockRequest.params = { id: 'plot-uuid-1' };
        mockRequest.body = {
          plot: {
            contractDate: '2024-06-15',
          },
        };

        mockPrisma.plot.findUnique
          .mockResolvedValueOnce(existingPlot)
          .mockResolvedValueOnce(existingPlot);

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          await callback(mockPrisma);
          return existingPlot;
        });

        await updatePlot(mockRequest as Request, mockResponse as Response);

        expect(mockPrisma.plot.update).toHaveBeenCalledWith({
          where: { id: 'plot-uuid-1' },
          data: {
            contract_date: new Date('2024-06-15'),
          },
        });

        expect(mockResponse.status).toHaveBeenCalledWith(200);
      });

      it('should update status field', async () => {
        mockRequest.params = { id: 'plot-uuid-1' };
        mockRequest.body = {
          plot: {
            status: 'inactive',
          },
        };

        mockPrisma.plot.findUnique
          .mockResolvedValueOnce(existingPlot)
          .mockResolvedValueOnce(existingPlot);

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          await callback(mockPrisma);
          return existingPlot;
        });

        await updatePlot(mockRequest as Request, mockResponse as Response);

        expect(mockPrisma.plot.update).toHaveBeenCalledWith({
          where: { id: 'plot-uuid-1' },
          data: {
            status: 'inactive',
          },
        });

        expect(mockResponse.status).toHaveBeenCalledWith(200);
      });

      it('should update notes field', async () => {
        mockRequest.params = { id: 'plot-uuid-1' };
        mockRequest.body = {
          plot: {
            notes: '更新されたメモ',
          },
        };

        mockPrisma.plot.findUnique
          .mockResolvedValueOnce(existingPlot)
          .mockResolvedValueOnce(existingPlot);

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          await callback(mockPrisma);
          return existingPlot;
        });

        await updatePlot(mockRequest as Request, mockResponse as Response);

        expect(mockPrisma.plot.update).toHaveBeenCalledWith({
          where: { id: 'plot-uuid-1' },
          data: {
            notes: '更新されたメモ',
          },
        });

        expect(mockResponse.status).toHaveBeenCalledWith(200);
      });

      it('should record history when plot basic info is updated', async () => {
        const updatedPlot = {
          ...existingPlot,
          plot_number: 'A-999',
          price: '1500000',
        };

        mockRequest = {
          params: { id: 'plot-uuid-1' },
          body: {
            plot: {
              plotNumber: 'A-999',
              price: '1500000',
            },
            changeReason: 'Plot number and price update',
          },
          user: {
            id: 3,
            email: 'test@example.com',
            name: 'Test User',
            role: 'operator',
            is_active: true,
            supabase_uid: 'test-uid',
          },
          ip: '192.168.1.100',
        };

        mockPrisma.plot.findUnique
          .mockResolvedValueOnce(existingPlot) // 存在確認
          .mockResolvedValueOnce(null) // 重複チェック（重複なし）
          .mockResolvedValueOnce(updatedPlot); // トランザクション後の更新データ

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          await callback(mockPrisma);
          return updatedPlot;
        });

        await updatePlot(mockRequest as Request, mockResponse as Response);

        expect(mockPrisma.history.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              entity_type: 'Plot',
              entity_id: 'plot-uuid-1',
              plot_id: 'plot-uuid-1',
              action_type: 'UPDATE',
              changed_fields: expect.objectContaining({
                plot_number: expect.objectContaining({
                  before: 'A-001',
                  after: 'A-999',
                }),
                price: expect.objectContaining({
                  before: '1000000',
                  after: '1500000',
                }),
              }),
              changed_by: '3',
              change_reason: 'Plot number and price update',
              ip_address: '192.168.1.100',
            }),
          })
        );

        expect(mockResponse.status).toHaveBeenCalledWith(200);
      });

      it('should not record history when no plot fields are changed', async () => {
        mockRequest.params = { id: 'plot-uuid-1' };
        mockRequest.body = {
          applicant: {
            name: 'New applicant',
          },
        };

        mockPrisma.plot.findUnique
          .mockResolvedValueOnce(existingPlot)
          .mockResolvedValueOnce(existingPlot); // 変更なし

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          await callback(mockPrisma);
          return existingPlot;
        });

        await updatePlot(mockRequest as Request, mockResponse as Response);

        // Plotテーブルの変更がないため、履歴は記録されない
        expect(mockPrisma.history.create).not.toHaveBeenCalled();

        expect(mockResponse.status).toHaveBeenCalledWith(200);
      });
    });

    describe('契約者依存バリデーション', () => {
      it('should return 400 when trying to add workInfo without contractor', async () => {
        mockRequest.params = { id: 'plot-uuid-1' };
        mockRequest.body = {
          workInfo: {
            companyName: '株式会社テスト',
          },
        };

        mockPrisma.plot.findUnique.mockResolvedValue(existingPlot);

        await updatePlot(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '契約者情報がない場合、勤務先・請求情報は登録できません',
            details: [],
          },
        });
      });

      it('should return 400 when trying to add billingInfo without contractor', async () => {
        mockRequest.params = { id: 'plot-uuid-1' };
        mockRequest.body = {
          billingInfo: {
            billingType: 'individual',
          },
        };

        mockPrisma.plot.findUnique.mockResolvedValue(existingPlot);

        await updatePlot(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '契約者情報がない場合、勤務先・請求情報は登録できません',
            details: [],
          },
        });
      });
    });

    // ========================================
    // Phase 2: 1:1リレーション - applicant upsert
    // ========================================
    describe('Applicant upsert', () => {
      it('should create new applicant when not exists', async () => {
        mockRequest.params = { id: 'plot-uuid-1' };
        mockRequest.body = {
          applicant: {
            name: '新規申込者',
            nameKana: 'シンキモウシコミシャ',
            phoneNumber: '03-1234-5678',
            address: '東京都渋谷区1-1-1',
            applicationDate: '2024-01-15',
            staffName: '担当者A',
            postalCode: '150-0001',
          },
        };

        mockPrisma.plot.findUnique
          .mockResolvedValueOnce(existingPlot)
          .mockResolvedValueOnce(existingPlot);

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          await callback(mockPrisma);
          return existingPlot;
        });

        await updatePlot(mockRequest as Request, mockResponse as Response);

        expect(mockPrisma.applicant.create).toHaveBeenCalledWith({
          data: {
            plot_id: 'plot-uuid-1',
            name: '新規申込者',
            name_kana: 'シンキモウシコミシャ',
            phone_number: '03-1234-5678',
            address: '東京都渋谷区1-1-1',
            application_date: new Date('2024-01-15'),
            staff_name: '担当者A',
            postal_code: '150-0001',
          },
        });

        // 新しい仕様では、Applicantの作成のみでは履歴は記録されない
        // （Plotテーブルの変更がないため）
        expect(mockPrisma.history.create).not.toHaveBeenCalled();

        expect(mockResponse.status).toHaveBeenCalledWith(200);
      });

      it('should update existing applicant', async () => {
        const plotWithApplicant = {
          ...existingPlot,
          Applicant: {
            id: 'applicant-uuid-1',
            name: '既存申込者',
            name_kana: 'キゾンモウシコミシャ',
            phone_number: '03-1111-2222',
            address: '東京都新宿区2-2-2',
            application_date: new Date('2024-01-01'),
            staff_name: '担当者B',
            postal_code: '160-0001',
          },
        };

        mockRequest.params = { id: 'plot-uuid-1' };
        mockRequest.body = {
          applicant: {
            name: '更新申込者',
            phoneNumber: '03-9999-8888',
          },
        };

        mockPrisma.plot.findUnique
          .mockResolvedValueOnce(plotWithApplicant)
          .mockResolvedValueOnce(plotWithApplicant);

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          await callback(mockPrisma);
          return plotWithApplicant;
        });

        await updatePlot(mockRequest as Request, mockResponse as Response);

        expect(mockPrisma.applicant.update).toHaveBeenCalledWith({
          where: { id: 'applicant-uuid-1' },
          data: {
            name: '更新申込者',
            phone_number: '03-9999-8888',
          },
        });

        // 新しい仕様では、Applicantの更新のみでは履歴は記録されない
        // （Plotテーブルの変更がないため）
        expect(mockPrisma.history.create).not.toHaveBeenCalled();

        expect(mockResponse.status).toHaveBeenCalledWith(200);
      });

      it('should soft delete applicant when null is specified', async () => {
        const plotWithApplicant = {
          ...existingPlot,
          Applicant: {
            id: 'applicant-uuid-1',
            name: '既存申込者',
          },
        };

        mockRequest.params = { id: 'plot-uuid-1' };
        mockRequest.body = {
          applicant: null,
        };

        mockPrisma.plot.findUnique
          .mockResolvedValueOnce(plotWithApplicant)
          .mockResolvedValueOnce(plotWithApplicant);

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          await callback(mockPrisma);
          return plotWithApplicant;
        });

        await updatePlot(mockRequest as Request, mockResponse as Response);

        expect(mockPrisma.applicant.update).toHaveBeenCalledWith({
          where: { id: 'applicant-uuid-1' },
          data: { deleted_at: expect.any(Date) },
        });

        // 新しい仕様では、Applicantの削除のみでは履歴は記録されない
        // （Plotテーブルの変更がないため）
        expect(mockPrisma.history.create).not.toHaveBeenCalled();

        expect(mockResponse.status).toHaveBeenCalledWith(200);
      });

      it('should not delete applicant when it does not exist and null is specified', async () => {
        mockRequest.params = { id: 'plot-uuid-1' };
        mockRequest.body = {
          applicant: null,
        };

        mockPrisma.plot.findUnique
          .mockResolvedValueOnce(existingPlot)
          .mockResolvedValueOnce(existingPlot);

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          await callback(mockPrisma);
          return existingPlot;
        });

        await updatePlot(mockRequest as Request, mockResponse as Response);

        // 既存のapplicantがない場合、削除は実行されない
        expect(mockPrisma.applicant.update).not.toHaveBeenCalled();
        expect(mockResponse.status).toHaveBeenCalledWith(200);
      });
    });

    // ========================================
    // Phase 2: 1:1リレーション - constructionInfo upsert
    // ========================================
    describe('ConstructionInfo upsert', () => {
      it('should create new constructionInfo when not exists', async () => {
        mockRequest.params = { id: 'plot-uuid-1' };
        mockRequest.body = {
          constructionInfo: {
            constructionType: '新規建立',
            startDate: '2024-04-01',
            completionDate: '2024-06-30',
            contractor: '石材工業株式会社',
            supervisor: '監督太郎',
            progress: '着工前',
            workItem1: '基礎工事',
            workAmount1: 500000,
            workStatus1: '予定',
            permitStatus: '申請中',
          },
        };

        mockPrisma.plot.findUnique
          .mockResolvedValueOnce(existingPlot)
          .mockResolvedValueOnce(existingPlot);

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          await callback(mockPrisma);
          return existingPlot;
        });

        await updatePlot(mockRequest as Request, mockResponse as Response);

        expect(mockPrisma.constructionInfo.create).toHaveBeenCalledWith({
          data: {
            plot_id: 'plot-uuid-1',
            construction_type: '新規建立',
            start_date: new Date('2024-04-01'),
            completion_date: new Date('2024-06-30'),
            contractor: '石材工業株式会社',
            supervisor: '監督太郎',
            progress: '着工前',
            work_item_1: '基礎工事',
            work_amount_1: 500000,
            work_status_1: '予定',
            permit_status: '申請中',
          },
        });

        expect(mockResponse.status).toHaveBeenCalledWith(200);
      });

      it('should update existing constructionInfo', async () => {
        const plotWithConstructionInfo = {
          ...existingPlot,
          ConstructionInfo: {
            id: 'construction-uuid-1',
            construction_type: '新規建立',
            progress: '着工前',
            work_amount_1: 500000,
          },
        };

        mockRequest.params = { id: 'plot-uuid-1' };
        mockRequest.body = {
          constructionInfo: {
            progress: '工事中',
            workAmount1: 600000,
            workStatus1: '完了',
          },
        };

        mockPrisma.plot.findUnique
          .mockResolvedValueOnce(plotWithConstructionInfo)
          .mockResolvedValueOnce(plotWithConstructionInfo);

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          await callback(mockPrisma);
          return plotWithConstructionInfo;
        });

        await updatePlot(mockRequest as Request, mockResponse as Response);

        expect(mockPrisma.constructionInfo.update).toHaveBeenCalledWith({
          where: { id: 'construction-uuid-1' },
          data: {
            progress: '工事中',
            work_amount_1: 600000,
            work_status_1: '完了',
          },
        });

        // 新しい仕様では、関連エンティティの変更のみでは履歴は記録されない
        // （Plotテーブルの変更がないため）
        expect(mockPrisma.history.create).not.toHaveBeenCalled();

        expect(mockResponse.status).toHaveBeenCalledWith(200);
      });

      it('should soft delete constructionInfo when null is specified', async () => {
        const plotWithConstructionInfo = {
          ...existingPlot,
          ConstructionInfo: {
            id: 'construction-uuid-1',
            construction_type: '新規建立',
          },
        };

        mockRequest.params = { id: 'plot-uuid-1' };
        mockRequest.body = {
          constructionInfo: null,
        };

        mockPrisma.plot.findUnique
          .mockResolvedValueOnce(plotWithConstructionInfo)
          .mockResolvedValueOnce(plotWithConstructionInfo);

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          await callback(mockPrisma);
          return plotWithConstructionInfo;
        });

        await updatePlot(mockRequest as Request, mockResponse as Response);

        expect(mockPrisma.constructionInfo.update).toHaveBeenCalledWith({
          where: { id: 'construction-uuid-1' },
          data: { deleted_at: expect.any(Date) },
        });

        // 新しい仕様では、関連エンティティの変更のみでは履歴は記録されない
        // （Plotテーブルの変更がないため）
        expect(mockPrisma.history.create).not.toHaveBeenCalled();

        expect(mockResponse.status).toHaveBeenCalledWith(200);
      });

      it('should create new constructionInfo when provided', async () => {
        mockRequest.params = { id: 'plot-uuid-1' };
        mockRequest.body = {
          constructionInfo: {
            constructionType: '新規建立',
            startDate: '2024-04-01',
            completionDate: '2024-06-30',
            contractor: '石材工業株式会社',
            supervisor: '監督太郎',
            progress: '完工',
            workItem1: '基礎工事',
            workDate1: '2024-04-15',
            workAmount1: 500000,
            workStatus1: '完了',
            workItem2: '墓石設置',
            workDate2: '2024-05-20',
            workAmount2: 1200000,
            workStatus2: '完了',
            permitNumber: 'P-2024-001',
            applicationDate: '2024-03-01',
            permitDate: '2024-03-15',
            permitStatus: '許可済み',
            paymentType1: '銀行振込',
            paymentAmount1: 500000,
            paymentDate1: '2024-04-01',
            paymentStatus1: '支払済み',
            paymentType2: '銀行振込',
            paymentAmount2: 1200000,
            paymentScheduledDate2: '2024-06-01',
            paymentStatus2: '支払済み',
            constructionNotes: '順調に完了しました',
          },
        };

        mockPrisma.plot.findUnique
          .mockResolvedValueOnce(existingPlot)
          .mockResolvedValueOnce(existingPlot);

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          await callback(mockPrisma);
          return existingPlot;
        });

        await updatePlot(mockRequest as Request, mockResponse as Response);

        expect(mockPrisma.constructionInfo.create).toHaveBeenCalledWith({
          data: {
            plot_id: 'plot-uuid-1',
            construction_type: '新規建立',
            start_date: new Date('2024-04-01'),
            completion_date: new Date('2024-06-30'),
            contractor: '石材工業株式会社',
            supervisor: '監督太郎',
            progress: '完工',
            work_item_1: '基礎工事',
            work_date_1: new Date('2024-04-15'),
            work_amount_1: 500000,
            work_status_1: '完了',
            work_item_2: '墓石設置',
            work_date_2: new Date('2024-05-20'),
            work_amount_2: 1200000,
            work_status_2: '完了',
            permit_number: 'P-2024-001',
            application_date: new Date('2024-03-01'),
            permit_date: new Date('2024-03-15'),
            permit_status: '許可済み',
            payment_type_1: '銀行振込',
            payment_amount_1: 500000,
            payment_date_1: new Date('2024-04-01'),
            payment_status_1: '支払済み',
            payment_type_2: '銀行振込',
            payment_amount_2: 1200000,
            payment_scheduled_date_2: new Date('2024-06-01'),
            payment_status_2: '支払済み',
            construction_notes: '順調に完了しました',
          },
        });

        // 新しい仕様では、関連エンティティの変更のみでは履歴は記録されない
        // （Plotテーブルの変更がないため）
        expect(mockPrisma.history.create).not.toHaveBeenCalled();

        expect(mockResponse.status).toHaveBeenCalledWith(200);
      });
    });

    // ========================================
    // Phase 3: 1:Nリレーション - familyContacts差分更新
    // ========================================
    describe('FamilyContacts differential update', () => {
      it('should create new familyContact when id is not provided', async () => {
        mockRequest.params = { id: 'plot-uuid-1' };
        mockRequest.body = {
          familyContacts: [
            {
              name: '家族太郎',
              birthDate: '1980-05-20',
              relationship: '息子',
              address: '東京都渋谷区1-1-1',
              phoneNumber: '090-1234-5678',
            },
          ],
        };

        mockPrisma.plot.findUnique
          .mockResolvedValueOnce(existingPlot)
          .mockResolvedValueOnce(existingPlot);

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          await callback(mockPrisma);
          return existingPlot;
        });

        await updatePlot(mockRequest as Request, mockResponse as Response);

        expect(mockPrisma.familyContact.create).toHaveBeenCalledWith({
          data: {
            plot_id: 'plot-uuid-1',
            name: '家族太郎',
            birth_date: new Date('1980-05-20'),
            relationship: '息子',
            address: '東京都渋谷区1-1-1',
            phone_number: '090-1234-5678',
            fax_number: null,
            email: null,
            registered_address: null,
            mailing_type: null,
            company_name: null,
            company_name_kana: null,
            company_address: null,
            company_phone: null,
            notes: null,
          },
        });

        // 新しい仕様では、関連エンティティの変更のみでは履歴は記録されない
        // （Plotテーブルの変更がないため）
        expect(mockPrisma.history.create).not.toHaveBeenCalled();

        expect(mockResponse.status).toHaveBeenCalledWith(200);
      });

      it('should update existing familyContact when id is provided', async () => {
        const plotWithFamilyContact = {
          ...existingPlot,
          FamilyContacts: [
            {
              id: 'family-uuid-1',
              name: '家族太郎',
              phone_number: '090-1111-2222',
            },
          ],
        };

        mockRequest.params = { id: 'plot-uuid-1' };
        mockRequest.body = {
          familyContacts: [
            {
              id: 'family-uuid-1',
              phoneNumber: '090-9999-8888',
              email: 'family@example.com',
              registeredAddress: '東京都目黒区7-7-7',
            },
          ],
        };

        mockPrisma.plot.findUnique
          .mockResolvedValueOnce(plotWithFamilyContact)
          .mockResolvedValueOnce(plotWithFamilyContact);

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          await callback(mockPrisma);
          return plotWithFamilyContact;
        });

        await updatePlot(mockRequest as Request, mockResponse as Response);

        expect(mockPrisma.familyContact.update).toHaveBeenCalledWith({
          where: { id: 'family-uuid-1' },
          data: {
            phone_number: '090-9999-8888',
            email: 'family@example.com',
            registered_address: '東京都目黒区7-7-7',
          },
        });

        // 新しい仕様では、関連エンティティの変更のみでは履歴は記録されない
        // （Plotテーブルの変更がないため）
        expect(mockPrisma.history.create).not.toHaveBeenCalled();

        expect(mockResponse.status).toHaveBeenCalledWith(200);
      });

      it('should soft delete familyContact when _delete flag is true', async () => {
        const plotWithFamilyContact = {
          ...existingPlot,
          FamilyContacts: [
            {
              id: 'family-uuid-1',
              name: '家族太郎',
            },
          ],
        };

        mockRequest.params = { id: 'plot-uuid-1' };
        mockRequest.body = {
          familyContacts: [
            {
              id: 'family-uuid-1',
              _delete: true,
            },
          ],
        };

        mockPrisma.plot.findUnique
          .mockResolvedValueOnce(plotWithFamilyContact)
          .mockResolvedValueOnce(plotWithFamilyContact);

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          await callback(mockPrisma);
          return plotWithFamilyContact;
        });

        await updatePlot(mockRequest as Request, mockResponse as Response);

        expect(mockPrisma.familyContact.update).toHaveBeenCalledWith({
          where: { id: 'family-uuid-1' },
          data: { deleted_at: expect.any(Date) },
        });

        // 新しい仕様では、関連エンティティの変更のみでは履歴は記録されない
        // （Plotテーブルの変更がないため）
        expect(mockPrisma.history.create).not.toHaveBeenCalled();

        expect(mockResponse.status).toHaveBeenCalledWith(200);
      });

      it('should handle complex operations (create, update, delete) in one request', async () => {
        const plotWithFamilyContacts = {
          ...existingPlot,
          FamilyContacts: [
            { id: 'family-uuid-1', name: '家族太郎' },
            { id: 'family-uuid-2', name: '家族花子' },
          ],
        };

        mockRequest.params = { id: 'plot-uuid-1' };
        mockRequest.body = {
          familyContacts: [
            // 新規作成（idなし）
            {
              name: '家族次郎',
              birthDate: '1985-03-10',
              relationship: '息子',
              address: '東京都新宿区2-2-2',
              phoneNumber: '090-2222-3333',
            },
            // 更新（idあり）
            {
              id: 'family-uuid-1',
              phoneNumber: '090-1111-9999',
            },
            // 削除（_delete: true）
            {
              id: 'family-uuid-2',
              _delete: true,
            },
          ],
        };

        mockPrisma.plot.findUnique
          .mockResolvedValueOnce(plotWithFamilyContacts)
          .mockResolvedValueOnce(plotWithFamilyContacts);

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          await callback(mockPrisma);
          return plotWithFamilyContacts;
        });

        await updatePlot(mockRequest as Request, mockResponse as Response);

        // 新規作成
        expect(mockPrisma.familyContact.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              name: '家族次郎',
            }),
          })
        );

        // 更新
        expect(mockPrisma.familyContact.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'family-uuid-1' },
            data: expect.objectContaining({
              phone_number: '090-1111-9999',
            }),
          })
        );

        // 削除
        expect(mockPrisma.familyContact.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'family-uuid-2' },
            data: { deleted_at: expect.any(Date) },
          })
        );

        expect(mockResponse.status).toHaveBeenCalledWith(200);
      });
    });

    // ========================================
    // Phase 3: 1:Nリレーション - buriedPersons差分更新
    // ========================================
    describe('BuriedPersons differential update', () => {
      it('should create new buriedPerson when id is not provided', async () => {
        mockRequest.params = { id: 'plot-uuid-1' };
        mockRequest.body = {
          buriedPersons: [
            {
              name: '故人太郎',
              nameKana: 'コジンタロウ',
              relationship: '祖父',
              deathDate: '2023-12-31',
              age: 85,
              gender: 'male',
              burialDate: '2024-01-05',
              memo: '安らかに',
            },
          ],
        };

        mockPrisma.plot.findUnique
          .mockResolvedValueOnce(existingPlot)
          .mockResolvedValueOnce(existingPlot);

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          await callback(mockPrisma);
          return existingPlot;
        });

        await updatePlot(mockRequest as Request, mockResponse as Response);

        expect(mockPrisma.buriedPerson.create).toHaveBeenCalledWith({
          data: {
            plot_id: 'plot-uuid-1',
            name: '故人太郎',
            name_kana: 'コジンタロウ',
            relationship: '祖父',
            death_date: new Date('2023-12-31'),
            age: 85,
            gender: 'male',
            burial_date: new Date('2024-01-05'),
            memo: '安らかに',
          },
        });

        // 新しい仕様では、関連エンティティの変更のみでは履歴は記録されない
        // （Plotテーブルの変更がないため）
        expect(mockPrisma.history.create).not.toHaveBeenCalled();

        expect(mockResponse.status).toHaveBeenCalledWith(200);
      });

      it('should update existing buriedPerson when id is provided', async () => {
        const plotWithBuriedPerson = {
          ...existingPlot,
          BuriedPersons: [
            {
              id: 'buried-uuid-1',
              name: '故人太郎',
              age: 85,
            },
          ],
        };

        mockRequest.params = { id: 'plot-uuid-1' };
        mockRequest.body = {
          buriedPersons: [
            {
              id: 'buried-uuid-1',
              age: 86,
              memo: '更新されたメモ',
            },
          ],
        };

        mockPrisma.plot.findUnique
          .mockResolvedValueOnce(plotWithBuriedPerson)
          .mockResolvedValueOnce(plotWithBuriedPerson);

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          await callback(mockPrisma);
          return plotWithBuriedPerson;
        });

        await updatePlot(mockRequest as Request, mockResponse as Response);

        expect(mockPrisma.buriedPerson.update).toHaveBeenCalledWith({
          where: { id: 'buried-uuid-1' },
          data: {
            age: 86,
            memo: '更新されたメモ',
          },
        });

        // 新しい仕様では、関連エンティティの変更のみでは履歴は記録されない
        // （Plotテーブルの変更がないため）
        expect(mockPrisma.history.create).not.toHaveBeenCalled();

        expect(mockResponse.status).toHaveBeenCalledWith(200);
      });

      it('should soft delete buriedPerson when _delete flag is true', async () => {
        const plotWithBuriedPerson = {
          ...existingPlot,
          BuriedPersons: [
            {
              id: 'buried-uuid-1',
              name: '故人太郎',
            },
          ],
        };

        mockRequest.params = { id: 'plot-uuid-1' };
        mockRequest.body = {
          buriedPersons: [
            {
              id: 'buried-uuid-1',
              _delete: true,
            },
          ],
        };

        mockPrisma.plot.findUnique
          .mockResolvedValueOnce(plotWithBuriedPerson)
          .mockResolvedValueOnce(plotWithBuriedPerson);

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          await callback(mockPrisma);
          return plotWithBuriedPerson;
        });

        await updatePlot(mockRequest as Request, mockResponse as Response);

        expect(mockPrisma.buriedPerson.update).toHaveBeenCalledWith({
          where: { id: 'buried-uuid-1' },
          data: { deleted_at: expect.any(Date) },
        });

        // 新しい仕様では、関連エンティティの変更のみでは履歴は記録されない
        // （Plotテーブルの変更がないため）
        expect(mockPrisma.history.create).not.toHaveBeenCalled();

        expect(mockResponse.status).toHaveBeenCalledWith(200);
      });
    });

    // ========================================
    // Phase 4: トランザクション・History記録テスト
    // ========================================
    // ========================================
    // updatePlot - その他のリレーション更新テスト
    // ========================================
    describe('Other relations update', () => {
      it('should create usageFee when not exists', async () => {
        mockRequest.params = { id: 'plot-uuid-1' };
        mockRequest.body = {
          usageFee: {
            calculationType: 'calc1',
            taxType: 'tax1',
            billingType: 'billing1',
            billingYears: '5',
            area: '10',
            unitPrice: '1000',
            usageFee: '50000',
            paymentMethod: 'bank',
          },
        };

        mockPrisma.plot.findUnique
          .mockResolvedValueOnce(existingPlot)
          .mockResolvedValueOnce(existingPlot);

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          await callback(mockPrisma);
          return existingPlot;
        });

        await updatePlot(mockRequest as Request, mockResponse as Response);

        expect(mockPrisma.usageFee.create).toHaveBeenCalled();
        expect(mockResponse.status).toHaveBeenCalledWith(200);
      });

      it('should update existing usageFee', async () => {
        const plotWithUsageFee = {
          ...existingPlot,
          UsageFee: {
            id: 'usage-fee-uuid-1',
            usage_fee: '50000',
          },
        };

        mockRequest.params = { id: 'plot-uuid-1' };
        mockRequest.body = {
          usageFee: {
            usageFee: '60000',
            unitPrice: '1200',
          },
        };

        mockPrisma.plot.findUnique
          .mockResolvedValueOnce(plotWithUsageFee)
          .mockResolvedValueOnce(plotWithUsageFee);

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          await callback(mockPrisma);
          return plotWithUsageFee;
        });

        await updatePlot(mockRequest as Request, mockResponse as Response);

        expect(mockPrisma.usageFee.update).toHaveBeenCalled();
        expect(mockResponse.status).toHaveBeenCalledWith(200);
      });

      it('should soft delete usageFee when null is specified', async () => {
        const plotWithUsageFee = {
          ...existingPlot,
          UsageFee: {
            id: 'usage-fee-uuid-1',
          },
        };

        mockRequest.params = { id: 'plot-uuid-1' };
        mockRequest.body = {
          usageFee: null,
        };

        mockPrisma.plot.findUnique
          .mockResolvedValueOnce(plotWithUsageFee)
          .mockResolvedValueOnce(plotWithUsageFee);

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          await callback(mockPrisma);
          return plotWithUsageFee;
        });

        await updatePlot(mockRequest as Request, mockResponse as Response);

        expect(mockPrisma.usageFee.update).toHaveBeenCalled();
        expect(mockResponse.status).toHaveBeenCalledWith(200);
      });

      it('should create managementFee when not exists', async () => {
        mockRequest.params = { id: 'plot-uuid-1' };
        mockRequest.body = {
          managementFee: {
            calculationType: 'calc2',
            taxType: 'tax2',
            billingType: 'billing2',
            billingYears: '3',
            area: '15',
            billingMonth: '4',
            managementFee: '30000',
            unitPrice: '2000',
            lastBillingMonth: '2024年3月',
            paymentMethod: 'cash',
          },
        };

        mockPrisma.plot.findUnique
          .mockResolvedValueOnce(existingPlot)
          .mockResolvedValueOnce(existingPlot);

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          await callback(mockPrisma);
          return existingPlot;
        });

        await updatePlot(mockRequest as Request, mockResponse as Response);

        expect(mockPrisma.managementFee.create).toHaveBeenCalled();
        expect(mockResponse.status).toHaveBeenCalledWith(200);
      });

      it('should update existing managementFee', async () => {
        const plotWithManagementFee = {
          ...existingPlot,
          ManagementFee: {
            id: 'management-fee-uuid-1',
          },
        };

        mockRequest.params = { id: 'plot-uuid-1' };
        mockRequest.body = {
          managementFee: {
            managementFee: '35000',
            billingMonth: '5',
          },
        };

        mockPrisma.plot.findUnique
          .mockResolvedValueOnce(plotWithManagementFee)
          .mockResolvedValueOnce(plotWithManagementFee);

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          await callback(mockPrisma);
          return plotWithManagementFee;
        });

        await updatePlot(mockRequest as Request, mockResponse as Response);

        expect(mockPrisma.managementFee.update).toHaveBeenCalled();
        expect(mockResponse.status).toHaveBeenCalledWith(200);
      });

      it('should soft delete managementFee when null is specified', async () => {
        const plotWithManagementFee = {
          ...existingPlot,
          ManagementFee: {
            id: 'management-fee-uuid-1',
          },
        };

        mockRequest.params = { id: 'plot-uuid-1' };
        mockRequest.body = {
          managementFee: null,
        };

        mockPrisma.plot.findUnique
          .mockResolvedValueOnce(plotWithManagementFee)
          .mockResolvedValueOnce(plotWithManagementFee);

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          await callback(mockPrisma);
          return plotWithManagementFee;
        });

        await updatePlot(mockRequest as Request, mockResponse as Response);

        expect(mockPrisma.managementFee.update).toHaveBeenCalled();
        expect(mockResponse.status).toHaveBeenCalledWith(200);
      });

      it('should create gravestoneInfo when not exists', async () => {
        mockRequest.params = { id: 'plot-uuid-1' };
        mockRequest.body = {
          gravestoneInfo: {
            gravestoneBase: 'base1',
            enclosurePosition: 'pos1',
            gravestoneDealer: 'dealer1',
            gravestoneType: 'type1',
            surroundingArea: 'area1',
          },
        };

        mockPrisma.plot.findUnique
          .mockResolvedValueOnce(existingPlot)
          .mockResolvedValueOnce(existingPlot);

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          await callback(mockPrisma);
          return existingPlot;
        });

        await updatePlot(mockRequest as Request, mockResponse as Response);

        expect(mockPrisma.gravestoneInfo.create).toHaveBeenCalled();
        expect(mockResponse.status).toHaveBeenCalledWith(200);
      });

      it('should update existing gravestoneInfo', async () => {
        const plotWithGravestoneInfo = {
          ...existingPlot,
          GravestoneInfo: {
            id: 'gravestone-uuid-1',
          },
        };

        mockRequest.params = { id: 'plot-uuid-1' };
        mockRequest.body = {
          gravestoneInfo: {
            gravestoneBase: 'base2',
            gravestoneType: 'type2',
          },
        };

        mockPrisma.plot.findUnique
          .mockResolvedValueOnce(plotWithGravestoneInfo)
          .mockResolvedValueOnce(plotWithGravestoneInfo);

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          await callback(mockPrisma);
          return plotWithGravestoneInfo;
        });

        await updatePlot(mockRequest as Request, mockResponse as Response);

        expect(mockPrisma.gravestoneInfo.update).toHaveBeenCalled();
        expect(mockResponse.status).toHaveBeenCalledWith(200);
      });

      it('should soft delete gravestoneInfo when null is specified', async () => {
        const plotWithGravestoneInfo = {
          ...existingPlot,
          GravestoneInfo: {
            id: 'gravestone-uuid-1',
          },
        };

        mockRequest.params = { id: 'plot-uuid-1' };
        mockRequest.body = {
          gravestoneInfo: null,
        };

        mockPrisma.plot.findUnique
          .mockResolvedValueOnce(plotWithGravestoneInfo)
          .mockResolvedValueOnce(plotWithGravestoneInfo);

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          await callback(mockPrisma);
          return plotWithGravestoneInfo;
        });

        await updatePlot(mockRequest as Request, mockResponse as Response);

        expect(mockPrisma.gravestoneInfo.update).toHaveBeenCalled();
        expect(mockResponse.status).toHaveBeenCalledWith(200);
      });

      it('should create emergencyContact when not exists', async () => {
        mockRequest.params = { id: 'plot-uuid-1' };
        mockRequest.body = {
          emergencyContact: {
            name: '緊急連絡先太郎',
            relationship: '息子',
            phoneNumber: '090-9999-0000',
          },
        };

        mockPrisma.plot.findUnique
          .mockResolvedValueOnce(existingPlot)
          .mockResolvedValueOnce(existingPlot);

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          await callback(mockPrisma);
          return existingPlot;
        });

        await updatePlot(mockRequest as Request, mockResponse as Response);

        expect(mockPrisma.emergencyContact.create).toHaveBeenCalled();
        expect(mockResponse.status).toHaveBeenCalledWith(200);
      });

      it('should update existing emergencyContact', async () => {
        const plotWithEmergencyContact = {
          ...existingPlot,
          EmergencyContact: {
            id: 'emergency-uuid-1',
          },
        };

        mockRequest.params = { id: 'plot-uuid-1' };
        mockRequest.body = {
          emergencyContact: {
            phoneNumber: '090-8888-0000',
            name: '緊急連絡先次郎',
          },
        };

        mockPrisma.plot.findUnique
          .mockResolvedValueOnce(plotWithEmergencyContact)
          .mockResolvedValueOnce(plotWithEmergencyContact);

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          await callback(mockPrisma);
          return plotWithEmergencyContact;
        });

        await updatePlot(mockRequest as Request, mockResponse as Response);

        expect(mockPrisma.emergencyContact.update).toHaveBeenCalled();
        expect(mockResponse.status).toHaveBeenCalledWith(200);
      });

      it('should soft delete emergencyContact when null is specified', async () => {
        const plotWithEmergencyContact = {
          ...existingPlot,
          EmergencyContact: {
            id: 'emergency-uuid-1',
          },
        };

        mockRequest.params = { id: 'plot-uuid-1' };
        mockRequest.body = {
          emergencyContact: null,
        };

        mockPrisma.plot.findUnique
          .mockResolvedValueOnce(plotWithEmergencyContact)
          .mockResolvedValueOnce(plotWithEmergencyContact);

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          await callback(mockPrisma);
          return plotWithEmergencyContact;
        });

        await updatePlot(mockRequest as Request, mockResponse as Response);

        expect(mockPrisma.emergencyContact.update).toHaveBeenCalled();
        expect(mockResponse.status).toHaveBeenCalledWith(200);
      });

      it('should create workInfo for existing contractor', async () => {
        const plotWithContractor = {
          ...existingPlot,
          Contractors: [{ id: 'contractor-uuid-1', WorkInfo: null }],
        };

        mockRequest.params = { id: 'plot-uuid-1' };
        mockRequest.body = {
          workInfo: {
            companyName: 'テスト株式会社',
            companyNameKana: 'テストカブシキガイシャ',
            workAddress: '東京都新宿区4-4-4',
            workPostalCode: '160-0001',
            workPhoneNumber: '03-1111-2222',
            dmSetting: 'allow',
            addressType: 'work',
          },
        };

        mockPrisma.plot.findUnique
          .mockResolvedValueOnce(plotWithContractor)
          .mockResolvedValueOnce(plotWithContractor);

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          await callback(mockPrisma);
          return plotWithContractor;
        });

        await updatePlot(mockRequest as Request, mockResponse as Response);

        expect(mockPrisma.workInfo.create).toHaveBeenCalled();
        expect(mockResponse.status).toHaveBeenCalledWith(200);
      });

      it('should update existing workInfo', async () => {
        const plotWithContractorAndWorkInfo = {
          ...existingPlot,
          Contractors: [
            {
              id: 'contractor-uuid-1',
              WorkInfo: { id: 'work-info-uuid-1' },
            },
          ],
        };

        mockRequest.params = { id: 'plot-uuid-1' };
        mockRequest.body = {
          workInfo: {
            companyName: '更新株式会社',
            dmSetting: 'deny',
          },
        };

        mockPrisma.plot.findUnique
          .mockResolvedValueOnce(plotWithContractorAndWorkInfo)
          .mockResolvedValueOnce(plotWithContractorAndWorkInfo);

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          await callback(mockPrisma);
          return plotWithContractorAndWorkInfo;
        });

        await updatePlot(mockRequest as Request, mockResponse as Response);

        expect(mockPrisma.workInfo.update).toHaveBeenCalled();
        expect(mockResponse.status).toHaveBeenCalledWith(200);
      });

      it('should soft delete workInfo when null is specified', async () => {
        const plotWithContractorAndWorkInfo = {
          ...existingPlot,
          Contractors: [
            {
              id: 'contractor-uuid-1',
              WorkInfo: { id: 'work-info-uuid-1' },
            },
          ],
        };

        mockRequest.params = { id: 'plot-uuid-1' };
        mockRequest.body = {
          workInfo: null,
        };

        mockPrisma.plot.findUnique
          .mockResolvedValueOnce(plotWithContractorAndWorkInfo)
          .mockResolvedValueOnce(plotWithContractorAndWorkInfo);

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          await callback(mockPrisma);
          return plotWithContractorAndWorkInfo;
        });

        await updatePlot(mockRequest as Request, mockResponse as Response);

        expect(mockPrisma.workInfo.update).toHaveBeenCalled();
        expect(mockResponse.status).toHaveBeenCalledWith(200);
      });

      it('should create billingInfo for existing contractor', async () => {
        const plotWithContractor = {
          ...existingPlot,
          Contractors: [{ id: 'contractor-uuid-1', BillingInfo: null }],
        };

        mockRequest.params = { id: 'plot-uuid-1' };
        mockRequest.body = {
          billingInfo: {
            billingType: 'individual',
            bankName: 'テスト銀行',
            branchName: '渋谷支店',
            accountType: 'ordinary',
            accountNumber: '1234567',
            accountHolder: 'テストタロウ',
          },
        };

        mockPrisma.plot.findUnique
          .mockResolvedValueOnce(plotWithContractor)
          .mockResolvedValueOnce(plotWithContractor);

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          await callback(mockPrisma);
          return plotWithContractor;
        });

        await updatePlot(mockRequest as Request, mockResponse as Response);

        expect(mockPrisma.billingInfo.create).toHaveBeenCalled();
        expect(mockResponse.status).toHaveBeenCalledWith(200);
      });

      it('should update existing billingInfo', async () => {
        const plotWithContractorAndBillingInfo = {
          ...existingPlot,
          Contractors: [
            {
              id: 'contractor-uuid-1',
              BillingInfo: { id: 'billing-info-uuid-1' },
            },
          ],
        };

        mockRequest.params = { id: 'plot-uuid-1' };
        mockRequest.body = {
          billingInfo: {
            bankName: '更新銀行',
            accountNumber: '9999999',
          },
        };

        mockPrisma.plot.findUnique
          .mockResolvedValueOnce(plotWithContractorAndBillingInfo)
          .mockResolvedValueOnce(plotWithContractorAndBillingInfo);

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          await callback(mockPrisma);
          return plotWithContractorAndBillingInfo;
        });

        await updatePlot(mockRequest as Request, mockResponse as Response);

        expect(mockPrisma.billingInfo.update).toHaveBeenCalled();
        expect(mockResponse.status).toHaveBeenCalledWith(200);
      });

      it('should soft delete billingInfo when null is specified', async () => {
        const plotWithContractorAndBillingInfo = {
          ...existingPlot,
          Contractors: [
            {
              id: 'contractor-uuid-1',
              BillingInfo: { id: 'billing-info-uuid-1' },
            },
          ],
        };

        mockRequest.params = { id: 'plot-uuid-1' };
        mockRequest.body = {
          billingInfo: null,
        };

        mockPrisma.plot.findUnique
          .mockResolvedValueOnce(plotWithContractorAndBillingInfo)
          .mockResolvedValueOnce(plotWithContractorAndBillingInfo);

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          await callback(mockPrisma);
          return plotWithContractorAndBillingInfo;
        });

        await updatePlot(mockRequest as Request, mockResponse as Response);

        expect(mockPrisma.billingInfo.update).toHaveBeenCalled();
        expect(mockResponse.status).toHaveBeenCalledWith(200);
      });

      it('should update gravestoneInfo with date fields', async () => {
        const plotWithGravestoneInfo = {
          ...existingPlot,
          GravestoneInfo: {
            id: 'gravestone-uuid-1',
          },
        };

        mockRequest.params = { id: 'plot-uuid-1' };
        mockRequest.body = {
          gravestoneInfo: {
            establishmentDeadline: '2024-12-31',
            establishmentDate: '2024-06-01',
          },
        };

        mockPrisma.plot.findUnique
          .mockResolvedValueOnce(plotWithGravestoneInfo)
          .mockResolvedValueOnce(plotWithGravestoneInfo);

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          await callback(mockPrisma);
          return plotWithGravestoneInfo;
        });

        await updatePlot(mockRequest as Request, mockResponse as Response);

        expect(mockPrisma.gravestoneInfo.update).toHaveBeenCalled();
        expect(mockResponse.status).toHaveBeenCalledWith(200);
      });

      it('should update all contractor fields individually', async () => {
        const plotWithContractor = {
          ...existingPlot,
          Contractors: [
            {
              id: 'contractor-uuid-1',
              name: '既存契約者',
            },
          ],
        };

        mockRequest.params = { id: 'plot-uuid-1' };
        mockRequest.body = {
          contractor: {
            reservationDate: '2024-02-01',
            acceptanceNumber: 'ACC123',
            permitDate: '2024-02-15',
            startDate: '2024-03-01',
            name: '更新契約者',
            nameKana: 'コウシンケイヤクシャ',
            birthDate: '1980-05-15',
            gender: 'female',
            phoneNumber: '090-4444-5555',
            faxNumber: '03-9999-8888',
            email: 'updated@example.com',
            address: '東京都品川区5-5-5',
            registeredAddress: '東京都目黒区6-6-6',
          },
        };

        mockPrisma.plot.findUnique
          .mockResolvedValueOnce(plotWithContractor)
          .mockResolvedValueOnce(plotWithContractor);

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          await callback(mockPrisma);
          return plotWithContractor;
        });

        await updatePlot(mockRequest as Request, mockResponse as Response);

        expect(mockPrisma.contractor.update).toHaveBeenCalled();
        expect(mockResponse.status).toHaveBeenCalledWith(200);
      });

      it('should create new contractor when not exists', async () => {
        const plotWithoutContractor = {
          ...existingPlot,
          Contractors: [],
        };

        mockRequest.params = { id: 'plot-uuid-1' };
        mockRequest.body = {
          contractor: {
            name: '新規契約者',
            nameKana: 'シンキケイヤクシャ',
            phoneNumber: '090-1111-1111',
            address: '東京都渋谷区1-1-1',
            reservationDate: '2024-01-01',
            startDate: '2024-02-01',
            gender: 'male',
          },
        };

        mockPrisma.plot.findUnique
          .mockResolvedValueOnce(plotWithoutContractor)
          .mockResolvedValueOnce(plotWithoutContractor);

        mockPrisma.contractor.create.mockResolvedValue({
          id: 'new-contractor-id',
          name: '新規契約者',
        });

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          await callback(mockPrisma);
          return plotWithoutContractor;
        });

        await updatePlot(mockRequest as Request, mockResponse as Response);

        expect(mockPrisma.contractor.create).toHaveBeenCalled();
        expect(mockResponse.status).toHaveBeenCalledWith(200);
      });
    });

    describe('Transaction and History logging', () => {
      it('should create history record with all changed fields', async () => {
        const updatedPlot = {
          ...existingPlot,
          section: 'B区',
          price: '1500000',
        };

        mockRequest = {
          params: { id: 'plot-uuid-1' },
          body: {
            plot: {
              section: 'B区',
              price: '1500000',
            },
            changeReason: '区画情報更新',
          },
          user: {
            id: 3,
            email: 'test@example.com',
            name: 'テストユーザー',
            role: 'operator',
            is_active: true,
            supabase_uid: 'test-uid',
          },
          ip: '127.0.0.1',
        };

        mockPrisma.plot.findUnique
          .mockResolvedValueOnce(existingPlot)
          .mockResolvedValueOnce(updatedPlot);

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          await callback(mockPrisma);
          return updatedPlot;
        });

        await updatePlot(mockRequest as Request, mockResponse as Response);

        // 新しい仕様では、Plotテーブルの変更のみ履歴に記録（before/after形式）
        expect(mockPrisma.history.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              entity_type: 'Plot',
              entity_id: 'plot-uuid-1',
              plot_id: 'plot-uuid-1',
              action_type: 'UPDATE',
              changed_fields: expect.objectContaining({
                section: expect.objectContaining({
                  before: 'A',
                  after: 'B区',
                }),
                price: expect.objectContaining({
                  before: '1000000',
                  after: '1500000',
                }),
              }),
              changed_by: '3',
              change_reason: '区画情報更新',
              ip_address: '127.0.0.1',
            }),
          })
        );

        expect(mockResponse.status).toHaveBeenCalledWith(200);
      });

      it('should not create history record when no fields are changed', async () => {
        mockRequest.params = { id: 'plot-uuid-1' };
        mockRequest.body = {}; // 空のbody

        mockPrisma.plot.findUnique
          .mockResolvedValueOnce(existingPlot)
          .mockResolvedValueOnce(existingPlot);

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          await callback(mockPrisma);
          return existingPlot;
        });

        await updatePlot(mockRequest as Request, mockResponse as Response);

        // changedFieldsが空の場合、historyは作成されない
        expect(mockPrisma.history.create).not.toHaveBeenCalled();
        expect(mockResponse.status).toHaveBeenCalledWith(200);
      });

      it('should rollback all changes on transaction error', async () => {
        mockRequest.params = { id: 'plot-uuid-1' };
        mockRequest.body = {
          plot: { price: '1500000' },
        };

        mockPrisma.plot.findUnique.mockResolvedValue(existingPlot);

        // トランザクション内でエラー発生
        mockPrisma.$transaction.mockRejectedValue(new Error('Transaction error'));

        await updatePlot(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: '区画情報の更新に失敗しました',
            details: [],
          },
        });
      });
    });
  });

  // ========================================
  // Phase 5: getPlots テスト
  // ========================================
  describe('getPlots', () => {
    it('should return plot list successfully', async () => {
      const mockPlots = [
        {
          id: 'plot-1',
          plot_number: 'A-001',
          notes: 'テスト区画1',
          Applicant: {
            name: '申込者1',
          },
          Contractors: [
            {
              name: '契約者1',
              address: '東京都渋谷区1-1-1',
              phone_number: '090-1111-1111',
            },
          ],
          BuriedPersons: [
            { id: 'buried-1', name: '故人1' },
            { id: 'buried-2', name: '故人2' },
          ],
          ManagementFee: {
            last_billing_month: '2024年3月',
          },
        },
        {
          id: 'plot-2',
          plot_number: 'A-002',
          notes: null,
          Applicant: null,
          Contractors: [],
          BuriedPersons: [],
          ManagementFee: null,
        },
      ];

      mockPrisma.plot.findMany.mockResolvedValue(mockPlots);

      await getPlots(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.plot.findMany).toHaveBeenCalledWith({
        where: {
          deleted_at: null,
        },
        include: {
          Applicant: true,
          Contractors: {
            where: { deleted_at: null },
            orderBy: { created_at: 'desc' },
            take: 1,
          },
          BuriedPersons: {
            where: { deleted_at: null },
          },
          ManagementFee: true,
        },
        orderBy: {
          plot_number: 'asc',
        },
      });

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            id: 'plot-1',
            plotNumber: 'A-001',
            contractorName: '契約者1',
            contractorAddress: '東京都渋谷区1-1-1',
            applicantName: '申込者1',
            buriedPersonCount: 2,
            contractorPhoneNumber: '090-1111-1111',
            nextBillingDate: expect.any(Date),
            notes: 'テスト区画1',
          }),
          expect.objectContaining({
            id: 'plot-2',
            plotNumber: 'A-002',
            contractorName: null,
            contractorAddress: null,
            applicantName: null,
            buriedPersonCount: 0,
            contractorPhoneNumber: null,
            nextBillingDate: null,
            notes: null,
          }),
        ]),
      });
    });

    it('should handle database error', async () => {
      mockPrisma.plot.findMany.mockRejectedValue(new Error('Database error'));

      await getPlots(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '区画情報の取得に失敗しました',
        },
      });
    });

    it('should calculate nextBillingDate correctly', async () => {
      const mockPlots = [
        {
          id: 'plot-1',
          plot_number: 'A-001',
          notes: null,
          Applicant: null,
          Contractors: [],
          BuriedPersons: [],
          ManagementFee: {
            last_billing_month: '2024年12月',
          },
        },
      ];

      mockPrisma.plot.findMany.mockResolvedValue(mockPlots);

      await getPlots(mockRequest as Request, mockResponse as Response);

      const responseData = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(responseData.data[0].nextBillingDate).toEqual(new Date(2024, 12, 1));
    });
  });

  // ========================================
  // Phase 6: getPlotById テスト
  // ========================================
  describe('getPlotById', () => {
    it('should return plot detail successfully', async () => {
      const mockPlot = {
        id: 'plot-uuid-1',
        plot_number: 'A-001',
        section: 'A',
        usage: 'in_use',
        size: '3.0㎡',
        price: '1000000',
        contract_date: new Date('2024-01-01'),
        status: 'active',
        notes: 'テスト区画',
        deleted_at: null,
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01'),
        Applicant: {
          id: 'applicant-1',
          application_date: new Date('2024-01-01'),
          staff_name: '担当者A',
          name: '申込者太郎',
          name_kana: 'モウシコミシャタロウ',
          postal_code: '150-0001',
          phone_number: '090-1111-2222',
          address: '東京都渋谷区1-1-1',
        },
        Contractors: [
          {
            id: 'contractor-1',
            name: '契約者太郎',
            name_kana: 'ケイヤクシャタロウ',
            phone_number: '090-3333-4444',
            address: '東京都新宿区2-2-2',
            reservation_date: new Date('2024-01-15'),
            acceptance_number: 'ACC001',
            permit_date: new Date('2024-01-20'),
            start_date: new Date('2024-02-01'),
            birth_date: new Date('1980-01-01'),
            gender: 'male',
            fax_number: '03-1234-5678',
            email: 'test@example.com',
            registered_address: '東京都世田谷区3-3-3',
            WorkInfo: {
              id: 'work-1',
              company_name: 'テスト株式会社',
              company_name_kana: 'テストカブシキガイシャ',
              work_address: '東京都港区4-4-4',
              work_postal_code: '106-0001',
              work_phone_number: '03-9999-8888',
              dm_setting: 'allow',
              address_type: 'work',
              notes: '備考テスト',
            },
            BillingInfo: {
              id: 'billing-1',
              billing_type: 'individual',
              bank_name: 'テスト銀行',
              branch_name: '渋谷支店',
              account_type: 'ordinary',
              account_number: '1234567',
              account_holder: 'テストタロウ',
            },
          },
        ],
        UsageFee: {
          id: 'usage-fee-1',
          calculation_type: 'calc1',
          tax_type: 'tax1',
          billing_type: 'billing1',
          billing_years: '5',
          area: '10',
          unit_price: '1000',
          usage_fee: '50000',
          payment_method: 'bank',
        },
        ManagementFee: {
          id: 'management-fee-1',
          calculation_type: 'calc2',
          tax_type: 'tax2',
          billing_type: 'billing2',
          billing_years: '3',
          area: '15',
          billing_month: '4',
          management_fee: '30000',
          unit_price: '2000',
          last_billing_month: '2024年3月',
          payment_method: 'cash',
        },
        GravestoneInfo: {
          id: 'gravestone-1',
          gravestone_base: 'base1',
          enclosure_position: 'pos1',
          gravestone_dealer: 'dealer1',
          gravestone_type: 'type1',
          surrounding_area: 'area1',
          establishment_deadline: new Date('2024-12-31'),
          establishment_date: new Date('2024-06-01'),
        },
        ConstructionInfo: {
          id: 'construction-1',
          construction_type: '新規建立',
          start_date: new Date('2024-04-01'),
          completion_date: new Date('2024-06-30'),
          contractor: '石材工業株式会社',
          supervisor: '監督太郎',
          progress: '完工',
          work_item_1: '基礎工事',
          work_date_1: new Date('2024-04-15'),
          work_amount_1: 500000,
          work_status_1: '完了',
          work_item_2: '墓石設置',
          work_date_2: new Date('2024-05-20'),
          work_amount_2: 1200000,
          work_status_2: '完了',
          permit_number: 'P-2024-001',
          application_date: new Date('2024-03-01'),
          permit_date: new Date('2024-03-15'),
          permit_status: '許可済み',
          payment_type_1: '銀行振込',
          payment_amount_1: 500000,
          payment_date_1: new Date('2024-04-01'),
          payment_status_1: '支払済み',
          payment_type_2: '銀行振込',
          payment_amount_2: 1200000,
          payment_scheduled_date_2: new Date('2024-06-01'),
          payment_status_2: '支払済み',
          construction_notes: '順調に完了しました',
        },
        FamilyContacts: [
          {
            id: 'family-1',
            name: '家族太郎',
            birth_date: new Date('1980-05-20'),
            relationship: '息子',
            address: '東京都渋谷区1-1-1',
            phone_number: '090-1234-5678',
            fax_number: '03-2222-3333',
            email: 'family@example.com',
            registered_address: '東京都世田谷区5-5-5',
            mailing_type: 'home',
            company_name: '家族会社',
            company_name_kana: 'カゾクカイシャ',
            company_address: '東京都品川区6-6-6',
            company_phone: '03-4444-5555',
            notes: '家族備考',
          },
        ],
        EmergencyContact: {
          id: 'emergency-1',
          name: '緊急連絡先太郎',
          relationship: '息子',
          phone_number: '090-9999-0000',
        },
        BuriedPersons: [
          {
            id: 'buried-1',
            name: '故人太郎',
            name_kana: 'コジンタロウ',
            relationship: '祖父',
            death_date: new Date('2023-12-31'),
            age: 85,
            gender: 'male',
            burial_date: new Date('2024-01-05'),
            memo: '安らかに',
          },
        ],
      };

      mockRequest.params = { id: 'plot-uuid-1' };
      mockPrisma.plot.findUnique.mockResolvedValue(mockPlot);

      await getPlotById(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.plot.findUnique).toHaveBeenCalledWith({
        where: { id: 'plot-uuid-1' },
        include: {
          Applicant: true,
          Contractors: {
            where: { deleted_at: null },
            include: {
              WorkInfo: true,
              BillingInfo: true,
            },
            orderBy: { created_at: 'desc' },
            take: 1,
          },
          UsageFee: true,
          ManagementFee: true,
          GravestoneInfo: true,
          ConstructionInfo: true,
          FamilyContacts: {
            where: { deleted_at: null },
          },
          EmergencyContact: true,
          BuriedPersons: {
            where: { deleted_at: null },
          },
        },
      });

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          id: 'plot-uuid-1',
          plotNumber: 'A-001',
          section: 'A',
          usage: 'in_use',
        }),
      });
    });

    it('should return 404 when plot not found', async () => {
      mockRequest.params = { id: 'non-existent-id' };
      mockPrisma.plot.findUnique.mockResolvedValue(null);

      await getPlotById(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '指定された区画が見つかりません',
        },
      });
    });

    it('should return 404 when plot is soft deleted', async () => {
      mockRequest.params = { id: 'deleted-plot-id' };
      mockPrisma.plot.findUnique.mockResolvedValue({
        id: 'deleted-plot-id',
        plot_number: 'A-999',
        deleted_at: new Date(),
      });

      await getPlotById(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '指定された区画が見つかりません',
        },
      });
    });

    it('should handle database error', async () => {
      mockRequest.params = { id: 'plot-uuid-1' };
      mockPrisma.plot.findUnique.mockRejectedValue(new Error('Database error'));

      await getPlotById(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '区画情報の取得に失敗しました',
        },
      });
    });

    it('should include history when includeHistory=true', async () => {
      const mockPlot = {
        id: 'plot-uuid-1',
        plot_number: 'A-001',
        section: 'A',
        usage: 'in_use',
        size: '3.0㎡',
        price: '1000000',
        contract_date: new Date('2024-01-01'),
        status: 'active',
        notes: 'テスト区画',
        deleted_at: null,
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01'),
        Applicant: null,
        Contractors: [],
        UsageFee: null,
        ManagementFee: null,
        GravestoneInfo: null,
        ConstructionInfo: null,
        FamilyContacts: [],
        EmergencyContact: null,
        BuriedPersons: [],
      };

      const mockHistories = [
        {
          id: 'history-1',
          entity_type: 'Plot',
          entity_id: 'plot-uuid-1',
          plot_id: 'plot-uuid-1',
          action_type: 'UPDATE',
          changed_fields: {
            price: { before: '900000', after: '1000000' },
          },
          changed_by: '1',
          change_reason: 'Price adjustment',
          ip_address: '192.168.1.1',
          created_at: new Date('2024-01-15'),
        },
        {
          id: 'history-2',
          entity_type: 'Plot',
          entity_id: 'plot-uuid-1',
          plot_id: 'plot-uuid-1',
          action_type: 'CREATE',
          changed_fields: undefined,
          changed_by: '1',
          change_reason: undefined,
          ip_address: '192.168.1.1',
          created_at: new Date('2024-01-01'),
        },
      ];

      mockRequest.params = { id: 'plot-uuid-1' };
      mockRequest.query = { includeHistory: 'true', historyLimit: '10' };

      mockPrisma.plot.findUnique.mockResolvedValue(mockPlot as any);
      mockPrisma.history.findMany.mockResolvedValue(mockHistories as any);

      await getPlotById(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.history.findMany).toHaveBeenCalledWith({
        where: { plot_id: 'plot-uuid-1' },
        orderBy: { created_at: 'desc' },
        take: 10,
      });

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          id: 'plot-uuid-1',
          history: expect.arrayContaining([
            expect.objectContaining({
              id: 'history-1',
              action_type: 'UPDATE',
              changed_fields: {
                price: { before: '900000', after: '1000000' },
              },
            }),
            expect.objectContaining({
              id: 'history-2',
              action_type: 'CREATE',
            }),
          ]),
        }),
      });
    });

    it('should not include history when includeHistory is not specified', async () => {
      const mockPlot = {
        id: 'plot-uuid-1',
        plot_number: 'A-001',
        section: 'A',
        usage: 'in_use',
        size: '3.0㎡',
        price: '1000000',
        contract_date: new Date('2024-01-01'),
        status: 'active',
        notes: 'テスト区画',
        deleted_at: null,
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01'),
        Applicant: null,
        Contractors: [],
        UsageFee: null,
        ManagementFee: null,
        GravestoneInfo: null,
        ConstructionInfo: null,
        FamilyContacts: [],
        EmergencyContact: null,
        BuriedPersons: [],
      };

      mockRequest.params = { id: 'plot-uuid-1' };
      mockRequest.query = {};

      mockPrisma.plot.findUnique.mockResolvedValue(mockPlot as any);

      await getPlotById(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.history.findMany).not.toHaveBeenCalled();

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.not.objectContaining({
          history: expect.anything(),
        }),
      });
    });

    it('should use default limit of 50 when historyLimit is not specified', async () => {
      const mockPlot = {
        id: 'plot-uuid-1',
        plot_number: 'A-001',
        section: 'A',
        usage: 'in_use',
        size: '3.0㎡',
        price: '1000000',
        contract_date: new Date('2024-01-01'),
        status: 'active',
        notes: null,
        deleted_at: null,
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01'),
        Applicant: null,
        Contractors: [],
        UsageFee: null,
        ManagementFee: null,
        GravestoneInfo: null,
        ConstructionInfo: null,
        FamilyContacts: [],
        EmergencyContact: null,
        BuriedPersons: [],
      };

      mockRequest.params = { id: 'plot-uuid-1' };
      mockRequest.query = { includeHistory: 'true' };

      mockPrisma.plot.findUnique.mockResolvedValue(mockPlot as any);
      mockPrisma.history.findMany.mockResolvedValue([]);

      await getPlotById(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.history.findMany).toHaveBeenCalledWith({
        where: { plot_id: 'plot-uuid-1' },
        orderBy: { created_at: 'desc' },
        take: 50, // デフォルト値
      });

      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });
  });

  // ========================================
  // Phase 7: createPlot テスト
  // ========================================
  describe('createPlot', () => {
    it('should create plot with all data successfully', async () => {
      mockRequest.body = {
        plot: {
          plotNumber: 'A-100',
          section: 'A',
          usage: 'in_use',
          size: '3.0㎡',
          price: '1000000',
          contractDate: '2024-01-01',
          status: 'active',
          notes: 'テスト区画',
        },
        applicant: {
          applicationDate: '2024-01-15',
          staffName: '担当者A',
          name: '申込者太郎',
          nameKana: 'モウシコミシャタロウ',
          postalCode: '150-0001',
          phoneNumber: '090-1111-2222',
          address: '東京都渋谷区1-1-1',
        },
        contractor: {
          reservationDate: '2024-02-01',
          acceptanceNumber: 'ACC001',
          permitDate: '2024-02-15',
          startDate: '2024-03-01',
          name: '契約者太郎',
          nameKana: 'ケイヤクシャタロウ',
          birthDate: '1980-01-01',
          gender: 'male',
          phoneNumber: '090-3333-4444',
          faxNumber: '03-1234-5678',
          email: 'test@example.com',
          address: '東京都新宿区2-2-2',
          registeredAddress: '東京都世田谷区3-3-3',
        },
        usageFee: {
          calculationType: 'calc1',
          taxType: 'tax1',
          billingType: 'billing1',
          billingYears: '5',
          area: '10',
          unitPrice: '1000',
          usageFee: '50000',
          paymentMethod: 'bank',
        },
        managementFee: {
          calculationType: 'calc2',
          taxType: 'tax2',
          billingType: 'billing2',
          billingYears: '3',
          area: '15',
          billingMonth: '4',
          managementFee: '30000',
          unitPrice: '2000',
          lastBillingMonth: '2024年3月',
          paymentMethod: 'cash',
        },
        gravestoneInfo: {
          gravestoneBase: 'base1',
          enclosurePosition: 'pos1',
          gravestoneDealer: 'dealer1',
          gravestoneType: 'type1',
          surroundingArea: 'area1',
          establishmentDeadline: '2024-12-31',
          establishmentDate: '2024-06-01',
        },
        constructionInfo: {
          constructionType: '新規建立',
          startDate: '2024-04-01',
          completionDate: '2024-06-30',
          contractor: '石材工業株式会社',
          supervisor: '監督太郎',
          progress: '完工',
          workItem1: '基礎工事',
          workDate1: '2024-04-15',
          workAmount1: 500000,
          workStatus1: '完了',
          workItem2: '墓石設置',
          workDate2: '2024-05-20',
          workAmount2: 1200000,
          workStatus2: '完了',
          permitNumber: 'P-2024-001',
          applicationDate: '2024-03-01',
          permitDate: '2024-03-15',
          permitStatus: '許可済み',
          paymentType1: '銀行振込',
          paymentAmount1: 500000,
          paymentDate1: '2024-04-01',
          paymentStatus1: '支払済み',
          paymentType2: '銀行振込',
          paymentAmount2: 1200000,
          paymentScheduledDate2: '2024-06-01',
          paymentStatus2: '支払済み',
          constructionNotes: '順調に完了しました',
        },
        familyContacts: [
          {
            name: '家族太郎',
            birthDate: '1980-05-20',
            relationship: '息子',
            address: '東京都渋谷区1-1-1',
            phoneNumber: '090-1234-5678',
            faxNumber: '03-2222-3333',
            email: 'family@example.com',
            registeredAddress: '東京都世田谷区5-5-5',
            mailingType: 'home',
            companyName: '家族会社',
            companyNameKana: 'カゾクカイシャ',
            companyAddress: '東京都品川区6-6-6',
            companyPhone: '03-4444-5555',
            notes: '家族備考',
          },
        ],
        emergencyContact: {
          name: '緊急連絡先太郎',
          relationship: '息子',
          phoneNumber: '090-9999-0000',
        },
        buriedPersons: [
          {
            name: '故人太郎',
            nameKana: 'コジンタロウ',
            relationship: '祖父',
            deathDate: '2023-12-31',
            age: 85,
            gender: 'male',
            burialDate: '2024-01-05',
            memo: '安らかに',
          },
        ],
        workInfo: {
          companyName: 'テスト株式会社',
          companyNameKana: 'テストカブシキガイシャ',
          workAddress: '東京都港区4-4-4',
          workPostalCode: '106-0001',
          workPhoneNumber: '03-9999-8888',
          dmSetting: 'allow',
          addressType: 'work',
          notes: '備考テスト',
        },
        billingInfo: {
          billingType: 'individual',
          bankName: 'テスト銀行',
          branchName: '渋谷支店',
          accountType: 'ordinary',
          accountNumber: '1234567',
          accountHolder: 'テストタロウ',
        },
      };

      const createdPlot = {
        id: 'new-plot-uuid',
        plot_number: 'A-100',
      };

      mockPrisma.plot.findUnique.mockResolvedValue(null); // 重複チェック

      const mockContractor = { id: 'contractor-uuid-1' };

      // トランザクション内で呼び出される関数を外部で定義して追跡可能にする
      const plotCreateSpy = jest.fn().mockResolvedValue(createdPlot);
      const applicantCreateSpy = jest.fn().mockResolvedValue({ id: 'applicant-1' });
      const contractorCreateSpy = jest.fn().mockResolvedValue(mockContractor);
      const usageFeeCreateSpy = jest.fn().mockResolvedValue({ id: 'usage-fee-1' });
      const managementFeeCreateSpy = jest.fn().mockResolvedValue({ id: 'management-fee-1' });
      const gravestoneInfoCreateSpy = jest.fn().mockResolvedValue({ id: 'gravestone-1' });
      const constructionInfoCreateSpy = jest.fn().mockResolvedValue({ id: 'construction-1' });
      const familyContactCreateSpy = jest.fn().mockResolvedValue({ id: 'family-1' });
      const emergencyContactCreateSpy = jest.fn().mockResolvedValue({ id: 'emergency-1' });
      const buriedPersonCreateSpy = jest.fn().mockResolvedValue({ id: 'buried-1' });
      const workInfoCreateSpy = jest.fn().mockResolvedValue({ id: 'work-1' });
      const billingInfoCreateSpy = jest.fn().mockResolvedValue({ id: 'billing-1' });
      const historyCreateSpy = jest.fn().mockResolvedValue({ id: 'history-1' });

      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        const txMockPrisma = {
          plot: { create: plotCreateSpy },
          applicant: { create: applicantCreateSpy },
          contractor: { create: contractorCreateSpy },
          usageFee: { create: usageFeeCreateSpy },
          managementFee: { create: managementFeeCreateSpy },
          gravestoneInfo: { create: gravestoneInfoCreateSpy },
          constructionInfo: { create: constructionInfoCreateSpy },
          familyContact: { create: familyContactCreateSpy },
          emergencyContact: { create: emergencyContactCreateSpy },
          buriedPerson: { create: buriedPersonCreateSpy },
          workInfo: { create: workInfoCreateSpy },
          billingInfo: { create: billingInfoCreateSpy },
          history: { create: historyCreateSpy },
        };

        return await callback(txMockPrisma);
      });

      await createPlot(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.plot.findUnique).toHaveBeenCalledWith({
        where: { plot_number: 'A-100' },
      });

      expect(plotCreateSpy).toHaveBeenCalledWith({
        data: expect.objectContaining({
          plot_number: 'A-100',
          section: 'A',
          usage: 'in_use',
        }),
      });

      expect(applicantCreateSpy).toHaveBeenCalled();
      expect(contractorCreateSpy).toHaveBeenCalled();
      expect(usageFeeCreateSpy).toHaveBeenCalled();
      expect(managementFeeCreateSpy).toHaveBeenCalled();
      expect(gravestoneInfoCreateSpy).toHaveBeenCalled();
      expect(constructionInfoCreateSpy).toHaveBeenCalled();
      expect(familyContactCreateSpy).toHaveBeenCalled();
      expect(emergencyContactCreateSpy).toHaveBeenCalled();
      expect(buriedPersonCreateSpy).toHaveBeenCalled();
      expect(workInfoCreateSpy).toHaveBeenCalled();
      expect(billingInfoCreateSpy).toHaveBeenCalled();
      expect(historyCreateSpy).toHaveBeenCalled();

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          id: 'new-plot-uuid',
          plotNumber: 'A-100',
          message: '区画情報を登録しました',
        },
      });
    });

    it('should return 400 when plot data is missing', async () => {
      mockRequest.body = {};

      await createPlot(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '区画基本情報は必須です',
          details: [{ field: 'plot', message: '区画基本情報を入力してください' }],
        },
      });
    });

    it('should return 400 when required fields are missing', async () => {
      mockRequest.body = {
        plot: {
          plotNumber: 'A-100',
          // section, usage, size, price が不足
        },
      };

      await createPlot(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '区画基本情報の必須項目が不足しています',
          details: expect.arrayContaining([
            { field: 'plotNumber', message: '区画番号は必須です' },
            { field: 'section', message: '区域は必須です' },
            { field: 'usage', message: '利用状況は必須です' },
            { field: 'size', message: '面積は必須です' },
            { field: 'price', message: '金額は必須です' },
          ]),
        },
      });
    });

    it('should return 409 when plotNumber already exists', async () => {
      mockRequest.body = {
        plot: {
          plotNumber: 'A-001',
          section: 'A',
          usage: 'in_use',
          size: '3.0㎡',
          price: '1000000',
        },
      };

      mockPrisma.plot.findUnique.mockResolvedValue({
        id: 'existing-plot-id',
        plot_number: 'A-001',
      });

      await createPlot(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(409);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'DUPLICATE_PLOT_NUMBER',
          message: '区画番号が既に存在します',
          details: [{ field: 'plotNumber', message: '区画番号 A-001 は既に使用されています' }],
        },
      });
    });

    it('should return 400 when trying to add workInfo without contractor', async () => {
      mockRequest.body = {
        plot: {
          plotNumber: 'A-100',
          section: 'A',
          usage: 'in_use',
          size: '3.0㎡',
          price: '1000000',
        },
        workInfo: {
          companyName: 'テスト株式会社',
          companyNameKana: 'テストカブシキガイシャ',
          workAddress: '東京都港区4-4-4',
          workPostalCode: '106-0001',
          workPhoneNumber: '03-9999-8888',
          dmSetting: 'allow',
          addressType: 'work',
        },
      };

      mockPrisma.plot.findUnique.mockResolvedValue(null);

      await createPlot(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '契約者情報がない場合、勤務先・請求情報は登録できません',
          details: [],
        },
      });
    });

    it('should return 400 when trying to add billingInfo without contractor', async () => {
      mockRequest.body = {
        plot: {
          plotNumber: 'A-100',
          section: 'A',
          usage: 'in_use',
          size: '3.0㎡',
          price: '1000000',
        },
        billingInfo: {
          billingType: 'individual',
          bankName: 'テスト銀行',
          branchName: '渋谷支店',
          accountType: 'ordinary',
          accountNumber: '1234567',
          accountHolder: 'テストタロウ',
        },
      };

      mockPrisma.plot.findUnique.mockResolvedValue(null);

      await createPlot(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '契約者情報がない場合、勤務先・請求情報は登録できません',
          details: [],
        },
      });
    });

    it('should handle Prisma unique constraint error (P2002)', async () => {
      mockRequest.body = {
        plot: {
          plotNumber: 'A-100',
          section: 'A',
          usage: 'in_use',
          size: '3.0㎡',
          price: '1000000',
        },
      };

      mockPrisma.plot.findUnique.mockResolvedValue(null);

      const prismaError: any = new Error('Unique constraint failed');
      prismaError.code = 'P2002';
      mockPrisma.$transaction.mockRejectedValue(prismaError);

      await createPlot(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(409);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'DUPLICATE_ERROR',
          message: '重複するデータが存在します',
          details: [],
        },
      });
    });

    it('should handle general database error', async () => {
      mockRequest.body = {
        plot: {
          plotNumber: 'A-100',
          section: 'A',
          usage: 'in_use',
          size: '3.0㎡',
          price: '1000000',
        },
      };

      mockPrisma.plot.findUnique.mockResolvedValue(null);
      mockPrisma.$transaction.mockRejectedValue(new Error('Database error'));

      await createPlot(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '区画情報の登録に失敗しました',
          details: [],
        },
      });
    });

    it('should create plot with minimum required fields only', async () => {
      mockRequest.body = {
        plot: {
          plotNumber: 'A-200',
          section: 'A',
          usage: 'available',
          size: '5.0㎡',
          price: '1500000',
        },
      };

      const createdPlot = {
        id: 'new-plot-uuid-2',
        plot_number: 'A-200',
      };

      mockPrisma.plot.findUnique.mockResolvedValue(null);

      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        const txMockPrisma = {
          ...mockPrisma,
          plot: {
            ...mockPrisma.plot,
            create: jest.fn().mockResolvedValue(createdPlot),
          },
          history: {
            ...mockPrisma.history,
            create: jest.fn().mockResolvedValue({ id: 'history-1' }),
          },
        };

        const result = await callback(txMockPrisma);

        // トランザクション内で呼び出されたことをmockPrismaに記録する
        mockPrisma.plot.create = txMockPrisma.plot.create;
        mockPrisma.history.create = txMockPrisma.history.create;

        return result;
      });

      await createPlot(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.plot.create).toHaveBeenCalledWith({
        data: {
          plot_number: 'A-200',
          section: 'A',
          usage: 'available',
          size: '5.0㎡',
          price: '1500000',
          contract_date: null,
          status: 'active',
          notes: null,
        },
      });

      expect(mockPrisma.applicant.create).not.toHaveBeenCalled();
      expect(mockPrisma.contractor.create).not.toHaveBeenCalled();

      expect(mockResponse.status).toHaveBeenCalledWith(201);
    });
  });
});
