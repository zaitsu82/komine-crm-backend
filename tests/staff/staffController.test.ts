import { Request, Response, NextFunction } from 'express';

// Express.Request型を拡張
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

// Supabase Adminモックの作成
const mockSupabaseAdminAuth = {
  inviteUserByEmail: jest.fn(),
  createUser: jest.fn(),
  deleteUser: jest.fn(),
  updateUserById: jest.fn(),
};

const mockSupabase = {
  auth: {
    admin: mockSupabaseAdminAuth,
  },
};

// @supabase/supabase-jsモジュールをモック化
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

// Prismaモックの作成
const mockPrisma = {
  staff: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

// 環境変数をモック化
const originalEnv = process.env;

describe('Staff Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let consoleWarnSpy: jest.SpyInstance;

  describe('Supabase環境変数が設定されている場合', () => {
    beforeAll(() => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
      process.env.FRONTEND_URL = 'https://example.com';
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    beforeEach(() => {
      jest.resetModules();

      mockRequest = {
        body: {},
        params: {},
        query: {},
        user: {
          id: 1,
          email: 'admin@example.com',
          name: 'Admin',
          role: 'admin',
          is_active: true,
          supabase_uid: 'admin-uid',
        },
      };
      mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      mockNext = jest.fn();
      consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      jest.clearAllMocks();
    });

    afterEach(() => {
      consoleWarnSpy.mockRestore();
    });

    describe('createStaff', () => {
      let createStaff: any;

      beforeEach(async () => {
        const staffController = await import('../../src/staff/staffController');
        createStaff = staffController.createStaff;
      });

      it('Supabaseユーザーを作成し、スタッフを登録する', async () => {
        mockRequest.body = {
          name: 'New Staff',
          email: 'newstaff@example.com',
          role: 'viewer',
        };

        const mockSupabaseUser = { id: 'new-supabase-uid' };
        mockSupabaseAdminAuth.inviteUserByEmail.mockResolvedValue({
          data: { user: mockSupabaseUser },
          error: null,
        });

        const mockCreatedStaff = {
          id: 2,
          name: 'New Staff',
          email: 'newstaff@example.com',
          role: 'viewer',
          supabase_uid: 'new-supabase-uid',
          is_active: true,
          last_login_at: null,
          created_at: new Date(),
          updated_at: new Date(),
        };
        mockPrisma.staff.findFirst.mockResolvedValue(null);
        mockPrisma.staff.create.mockResolvedValue(mockCreatedStaff);

        await createStaff(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockSupabaseAdminAuth.inviteUserByEmail).toHaveBeenCalledWith(
          'newstaff@example.com',
          expect.objectContaining({
            data: { name: 'New Staff', role: 'viewer' },
          })
        );
        expect(mockPrisma.staff.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              supabase_uid: 'new-supabase-uid',
            }),
          })
        );
        expect(mockResponse.status).toHaveBeenCalledWith(201);
        expect(mockResponse.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            invitationSent: true,
          })
        );
      });

      it('skipSupabase=trueの場合、Supabaseアカウントを作成しない', async () => {
        mockRequest.body = {
          name: 'Test Staff',
          email: 'test@example.com',
          role: 'viewer',
          skipSupabase: true,
        };

        const mockCreatedStaff = {
          id: 3,
          name: 'Test Staff',
          email: 'test@example.com',
          role: 'viewer',
          supabase_uid: 'pending_123',
          is_active: true,
          last_login_at: null,
          created_at: new Date(),
          updated_at: new Date(),
        };
        mockPrisma.staff.findFirst.mockResolvedValue(null);
        mockPrisma.staff.create.mockResolvedValue(mockCreatedStaff);

        await createStaff(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockSupabaseAdminAuth.inviteUserByEmail).not.toHaveBeenCalled();
        expect(mockPrisma.staff.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              supabase_uid: expect.stringMatching(/^pending_/),
            }),
          })
        );
        expect(mockResponse.status).toHaveBeenCalledWith(201);
        expect(mockResponse.json).toHaveBeenCalledWith(
          expect.objectContaining({
            invitationSent: false,
          })
        );
      });

      it('名前が空の場合、ValidationErrorを返す', async () => {
        mockRequest.body = {
          name: '',
          email: 'test@example.com',
          role: 'viewer',
        };

        await createStaff(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockNext).toHaveBeenCalled();
        const error = (mockNext as jest.Mock).mock.calls[0][0];
        expect(error.message).toBe('名前は必須です');
      });

      it('メールアドレスが重複している場合、ConflictErrorを返す', async () => {
        mockRequest.body = {
          name: 'Test Staff',
          email: 'existing@example.com',
          role: 'viewer',
        };

        mockPrisma.staff.findFirst.mockResolvedValue({
          id: 1,
          email: 'existing@example.com',
        });

        await createStaff(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockNext).toHaveBeenCalled();
        const error = (mockNext as jest.Mock).mock.calls[0][0];
        expect(error.message).toBe('このメールアドレスは既に使用されています');
      });

      it('Supabaseアカウント作成に失敗した場合、エラーを返す', async () => {
        mockRequest.body = {
          name: 'Test Staff',
          email: 'test@example.com',
          role: 'viewer',
        };

        mockPrisma.staff.findFirst.mockResolvedValue(null);
        mockSupabaseAdminAuth.inviteUserByEmail.mockResolvedValue({
          data: { user: null },
          error: { message: 'User already registered' },
        });

        await createStaff(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockNext).toHaveBeenCalled();
        const error = (mockNext as jest.Mock).mock.calls[0][0];
        expect(error.message).toContain('Supabase');
      });
    });

    describe('deleteStaff', () => {
      let deleteStaff: any;

      beforeEach(async () => {
        const staffController = await import('../../src/staff/staffController');
        deleteStaff = staffController.deleteStaff;
      });

      it('スタッフとSupabaseユーザーを削除する', async () => {
        mockRequest.params = { id: '2' };
        mockRequest.query = {};

        const mockExistingStaff = {
          id: 2,
          name: 'Staff to Delete',
          email: 'delete@example.com',
          supabase_uid: 'delete-uid',
          is_active: true,
        };
        mockPrisma.staff.findFirst.mockResolvedValue(mockExistingStaff);
        mockPrisma.staff.update.mockResolvedValue({
          ...mockExistingStaff,
          deleted_at: new Date(),
          is_active: false,
        });
        mockSupabaseAdminAuth.deleteUser.mockResolvedValue({ error: null });

        await deleteStaff(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockSupabaseAdminAuth.deleteUser).toHaveBeenCalledWith('delete-uid');
        expect(mockPrisma.staff.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              deleted_at: expect.any(Date),
              is_active: false,
            }),
          })
        );
        expect(mockResponse.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            data: expect.objectContaining({
              supabaseAccountDeleted: true,
            }),
          })
        );
      });

      it('deleteSupabaseAccount=falseの場合、Supabaseユーザーを削除しない', async () => {
        mockRequest.params = { id: '2' };
        mockRequest.query = { deleteSupabaseAccount: 'false' };

        const mockExistingStaff = {
          id: 2,
          name: 'Staff',
          email: 'staff@example.com',
          supabase_uid: 'staff-uid',
          is_active: true,
        };
        mockPrisma.staff.findFirst.mockResolvedValue(mockExistingStaff);
        mockPrisma.staff.update.mockResolvedValue({
          ...mockExistingStaff,
          deleted_at: new Date(),
          is_active: false,
        });

        await deleteStaff(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockSupabaseAdminAuth.deleteUser).not.toHaveBeenCalled();
        expect(mockResponse.json).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              supabaseAccountDeleted: false,
            }),
          })
        );
      });

      it('pending_で始まるUIDの場合、Supabase削除をスキップする', async () => {
        mockRequest.params = { id: '2' };
        mockRequest.query = {};

        const mockExistingStaff = {
          id: 2,
          name: 'Staff',
          email: 'staff@example.com',
          supabase_uid: 'pending_123456',
          is_active: true,
        };
        mockPrisma.staff.findFirst.mockResolvedValue(mockExistingStaff);
        mockPrisma.staff.update.mockResolvedValue({
          ...mockExistingStaff,
          deleted_at: new Date(),
          is_active: false,
        });

        await deleteStaff(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockSupabaseAdminAuth.deleteUser).not.toHaveBeenCalled();
      });

      it('自分自身を削除しようとした場合、ValidationErrorを返す', async () => {
        mockRequest.params = { id: '1' };
        mockRequest.query = {};
        mockRequest.user = {
          id: 1,
          email: 'admin@example.com',
          name: 'Admin',
          role: 'admin',
          is_active: true,
          supabase_uid: 'admin-uid',
        };

        const mockExistingStaff = {
          id: 1,
          name: 'Admin',
          email: 'admin@example.com',
          supabase_uid: 'admin-uid',
          is_active: true,
        };
        mockPrisma.staff.findFirst.mockResolvedValue(mockExistingStaff);

        await deleteStaff(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockNext).toHaveBeenCalled();
        const error = (mockNext as jest.Mock).mock.calls[0][0];
        expect(error.message).toBe('自分自身を削除することはできません');
      });
    });

    describe('updateStaff', () => {
      let updateStaff: any;

      beforeEach(async () => {
        const staffController = await import('../../src/staff/staffController');
        updateStaff = staffController.updateStaff;
      });

      it('メールアドレス変更時にSupabaseも更新する', async () => {
        mockRequest.params = { id: '2' };
        mockRequest.body = { email: 'newemail@example.com' };

        const mockExistingStaff = {
          id: 2,
          name: 'Staff',
          email: 'old@example.com',
          role: 'viewer',
          supabase_uid: 'staff-uid',
          is_active: true,
          last_login_at: null,
          created_at: new Date(),
          updated_at: new Date(),
        };
        mockPrisma.staff.findFirst
          .mockResolvedValueOnce(mockExistingStaff)
          .mockResolvedValueOnce(null);
        mockSupabaseAdminAuth.updateUserById.mockResolvedValue({
          data: { user: { id: 'staff-uid' } },
          error: null,
        });
        mockPrisma.staff.update.mockResolvedValue({
          ...mockExistingStaff,
          email: 'newemail@example.com',
        });

        await updateStaff(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockSupabaseAdminAuth.updateUserById).toHaveBeenCalledWith('staff-uid', {
          email: 'newemail@example.com',
        });
        expect(mockResponse.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
          })
        );
      });
    });

    describe('resendStaffInvitation', () => {
      let resendStaffInvitation: any;

      beforeEach(async () => {
        const staffController = await import('../../src/staff/staffController');
        resendStaffInvitation = staffController.resendStaffInvitation;
      });

      it('招待メールを再送信する', async () => {
        mockRequest.params = { id: '2' };

        const mockExistingStaff = {
          id: 2,
          name: 'Staff',
          email: 'staff@example.com',
          supabase_uid: 'pending_123',
          is_active: true,
        };
        mockPrisma.staff.findFirst.mockResolvedValue(mockExistingStaff);
        mockSupabaseAdminAuth.inviteUserByEmail.mockResolvedValue({
          data: { user: { id: 'new-uid' } },
          error: null,
        });
        mockPrisma.staff.update.mockResolvedValue({
          ...mockExistingStaff,
          supabase_uid: 'new-uid',
        });

        await resendStaffInvitation(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockSupabaseAdminAuth.inviteUserByEmail).toHaveBeenCalledWith(
          'staff@example.com',
          expect.any(Object)
        );
        expect(mockPrisma.staff.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: { supabase_uid: 'new-uid' },
          })
        );
        expect(mockResponse.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            data: expect.objectContaining({
              message: '招待メールを再送信しました',
            }),
          })
        );
      });

      it('スタッフが見つからない場合、NotFoundErrorを返す', async () => {
        mockRequest.params = { id: '999' };
        mockPrisma.staff.findFirst.mockResolvedValue(null);

        await resendStaffInvitation(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockNext).toHaveBeenCalled();
        const error = (mockNext as jest.Mock).mock.calls[0][0];
        expect(error.message).toBe('スタッフが見つかりません');
      });
    });
  });

  describe('getStaffList', () => {
    let getStaffList: any;

    beforeEach(async () => {
      jest.resetModules();
      const staffController = await import('../../src/staff/staffController');
      getStaffList = staffController.getStaffList;

      mockRequest = {
        query: {},
      };
      mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      mockNext = jest.fn();
      jest.clearAllMocks();
    });

    it('スタッフ一覧を取得する', async () => {
      mockPrisma.staff.count.mockResolvedValue(2);
      mockPrisma.staff.findMany.mockResolvedValue([
        {
          id: 1,
          name: 'Staff 1',
          email: 'staff1@example.com',
          role: 'admin',
          is_active: true,
          last_login_at: null,
          created_at: new Date(),
        },
        {
          id: 2,
          name: 'Staff 2',
          email: 'staff2@example.com',
          role: 'viewer',
          is_active: true,
          last_login_at: null,
          created_at: new Date(),
        },
      ]);

      await getStaffList(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            items: expect.arrayContaining([
              expect.objectContaining({ id: 1, name: 'Staff 1' }),
              expect.objectContaining({ id: 2, name: 'Staff 2' }),
            ]),
            pagination: expect.objectContaining({
              total: 2,
            }),
          }),
        })
      );
    });

    it('ロールでフィルタリングできる', async () => {
      mockRequest.query = { role: 'admin' };
      mockPrisma.staff.count.mockResolvedValue(1);
      mockPrisma.staff.findMany.mockResolvedValue([
        {
          id: 1,
          name: 'Admin',
          email: 'admin@example.com',
          role: 'admin',
          is_active: true,
          last_login_at: null,
          created_at: new Date(),
        },
      ]);

      await getStaffList(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockPrisma.staff.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            role: 'admin',
          }),
        })
      );
    });
  });

  describe('getStaffById', () => {
    let getStaffById: any;

    beforeEach(async () => {
      jest.resetModules();
      const staffController = await import('../../src/staff/staffController');
      getStaffById = staffController.getStaffById;

      mockRequest = {
        params: { id: '1' },
      };
      mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      mockNext = jest.fn();
      jest.clearAllMocks();
    });

    it('スタッフ詳細を取得する', async () => {
      const mockStaff = {
        id: 1,
        name: 'Staff',
        email: 'staff@example.com',
        role: 'viewer',
        is_active: true,
        last_login_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockPrisma.staff.findFirst.mockResolvedValue(mockStaff);

      await getStaffById(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            id: 1,
            name: 'Staff',
          }),
        })
      );
    });

    it('スタッフが見つからない場合、NotFoundErrorを返す', async () => {
      mockPrisma.staff.findFirst.mockResolvedValue(null);

      await getStaffById(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      const error = (mockNext as jest.Mock).mock.calls[0][0];
      expect(error.message).toBe('スタッフが見つかりません');
    });

    it('無効なIDの場合、ValidationErrorを返す', async () => {
      mockRequest.params = { id: 'invalid' };

      await getStaffById(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      const error = (mockNext as jest.Mock).mock.calls[0][0];
      expect(error.message).toBe('無効なスタッフIDです');
    });
  });

  describe('toggleStaffActive', () => {
    let toggleStaffActive: any;

    beforeEach(async () => {
      jest.resetModules();
      const staffController = await import('../../src/staff/staffController');
      toggleStaffActive = staffController.toggleStaffActive;

      mockRequest = {
        params: { id: '2' },
        user: {
          id: 1,
          email: 'admin@example.com',
          name: 'Admin',
          role: 'admin',
          is_active: true,
          supabase_uid: 'admin-uid',
        },
      };
      mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      mockNext = jest.fn();
      jest.clearAllMocks();
    });

    it('スタッフの有効/無効を切り替える', async () => {
      const mockExistingStaff = {
        id: 2,
        name: 'Staff',
        email: 'staff@example.com',
        is_active: true,
      };
      mockPrisma.staff.findFirst.mockResolvedValue(mockExistingStaff);
      mockPrisma.staff.update.mockResolvedValue({
        ...mockExistingStaff,
        is_active: false,
      });

      await toggleStaffActive(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockPrisma.staff.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { is_active: false },
        })
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            isActive: false,
          }),
        })
      );
    });

    it('自分自身を無効化しようとした場合、ValidationErrorを返す', async () => {
      mockRequest.params = { id: '1' };

      const mockExistingStaff = {
        id: 1,
        name: 'Admin',
        email: 'admin@example.com',
        is_active: true,
      };
      mockPrisma.staff.findFirst.mockResolvedValue(mockExistingStaff);

      await toggleStaffActive(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      const error = (mockNext as jest.Mock).mock.calls[0][0];
      expect(error.message).toBe('自分自身を無効化することはできません');
    });
  });
});
