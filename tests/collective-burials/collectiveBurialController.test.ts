import { Request, Response, NextFunction } from 'express';

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

const mockPrisma: any = {
  collectiveBurial: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
  },
};

jest.mock('../../src/db/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

jest.mock('@prisma/client', () => ({
  BillingStatus: { pending: 'pending', billed: 'billed', paid: 'paid' },
  PrismaClient: jest.fn(),
}));

import {
  getCollectiveBurialList,
  getCollectiveBurialById,
} from '../../src/collective-burials/collectiveBurialController';

describe('collectiveBurialController — 契約者名フォールバック (issue #50)', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let responseJson: jest.Mock;
  let mockNext: jest.Mock;

  function buildBurial(
    roles: Array<{ role: 'applicant' | 'contractor'; name: string; name_kana: string }>
  ) {
    return {
      id: 'cb1',
      contract_plot_id: 'cp1',
      burial_capacity: 10,
      current_burial_count: 3,
      capacity_reached_date: null,
      validity_period_years: 33,
      billing_scheduled_date: null,
      billing_status: 'pending',
      billing_amount: null,
      notes: null,
      created_at: new Date('2026-01-01'),
      updated_at: new Date('2026-01-01'),
      contractPlot: {
        contract_date: new Date('2025-04-01'),
        physicalPlot: {
          plot_number: 'A-01',
          area_name: '合祀区画',
        },
        saleContractRoles: roles.map((r, idx) => ({
          role: r.role,
          customer: {
            id: `customer-${idx}`,
            name: r.name,
            name_kana: r.name_kana,
            phone_number: null,
            email: null,
            postal_code: null,
            address: null,
            billingInfo: null,
          },
        })),
        buriedPersons: [],
      },
    };
  }

  beforeEach(() => {
    responseJson = jest.fn().mockReturnThis();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: responseJson,
    };
    mockRequest = { params: {}, query: {} };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('getCollectiveBurialList', () => {
    it('applicantがいればapplicantの名前を返す', async () => {
      mockPrisma.collectiveBurial.findMany.mockResolvedValue([
        buildBurial([
          { role: 'applicant', name: '申込太郎', name_kana: 'モウシコミタロウ' },
          { role: 'contractor', name: '契約花子', name_kana: 'ケイヤクハナコ' },
        ]),
      ]);
      mockPrisma.collectiveBurial.count.mockResolvedValue(1);

      await getCollectiveBurialList(
        mockRequest as Request,
        mockResponse as Response,
        mockNext as NextFunction
      );

      const payload = responseJson.mock.calls[0][0];
      expect(payload.data.items[0].applicantName).toBe('申込太郎');
      expect(payload.data.items[0].applicantNameKana).toBe('モウシコミタロウ');
    });

    it('applicantがいなくてもcontractorがいればcontractorの名前を返す', async () => {
      mockPrisma.collectiveBurial.findMany.mockResolvedValue([
        buildBurial([{ role: 'contractor', name: '契約花子', name_kana: 'ケイヤクハナコ' }]),
      ]);
      mockPrisma.collectiveBurial.count.mockResolvedValue(1);

      await getCollectiveBurialList(
        mockRequest as Request,
        mockResponse as Response,
        mockNext as NextFunction
      );

      const payload = responseJson.mock.calls[0][0];
      expect(payload.data.items[0].applicantName).toBe('契約花子');
      expect(payload.data.items[0].applicantNameKana).toBe('ケイヤクハナコ');
    });

    it('どのロールも無い場合はnullを返す', async () => {
      mockPrisma.collectiveBurial.findMany.mockResolvedValue([buildBurial([])]);
      mockPrisma.collectiveBurial.count.mockResolvedValue(1);

      await getCollectiveBurialList(
        mockRequest as Request,
        mockResponse as Response,
        mockNext as NextFunction
      );

      const payload = responseJson.mock.calls[0][0];
      expect(payload.data.items[0].applicantName).toBeNull();
      expect(payload.data.items[0].applicantNameKana).toBeNull();
    });
  });

  describe('getCollectiveBurialById', () => {
    it('applicantがいなくてもcontractorをフォールバックに使う', async () => {
      mockPrisma.collectiveBurial.findFirst.mockResolvedValue(
        buildBurial([{ role: 'contractor', name: '契約花子', name_kana: 'ケイヤクハナコ' }])
      );
      mockRequest.params = { id: 'cb1' };

      await getCollectiveBurialById(
        mockRequest as Request,
        mockResponse as Response,
        mockNext as NextFunction
      );

      const payload = responseJson.mock.calls[0][0];
      expect(payload.data.applicant).not.toBeNull();
      expect(payload.data.applicant.name).toBe('契約花子');
    });

    it('applicantとcontractorの両方があればapplicantを優先する', async () => {
      mockPrisma.collectiveBurial.findFirst.mockResolvedValue(
        buildBurial([
          { role: 'contractor', name: '契約花子', name_kana: 'ケイヤクハナコ' },
          { role: 'applicant', name: '申込太郎', name_kana: 'モウシコミタロウ' },
        ])
      );
      mockRequest.params = { id: 'cb1' };

      await getCollectiveBurialById(
        mockRequest as Request,
        mockResponse as Response,
        mockNext as NextFunction
      );

      const payload = responseJson.mock.calls[0][0];
      expect(payload.data.applicant.name).toBe('申込太郎');
    });
  });
});
