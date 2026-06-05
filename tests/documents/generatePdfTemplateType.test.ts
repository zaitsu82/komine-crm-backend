/**
 * generatePdf の documentId 指定更新テスト（#230）
 *
 * 旧実装は documentId 指定時に template_type を更新せず、種別不一致の
 * リクエストで template_data だけ新形状に書き換わり、以後 regeneratePdf が
 * ZodError（INVALID_TEMPLATE_DATA）で再生成不能になる破損データを作れた。
 */
import { Request, Response } from 'express';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
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

const mockPrisma = {
  document: {
    findFirst: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
  contractPlot: { findFirst: jest.fn() },
  customer: { findFirst: jest.fn() },
};

jest.mock('../../src/db/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

jest.mock('../../src/documents/documentService', () => ({
  generatePdfFromTemplate: jest
    .fn()
    .mockResolvedValue({ success: true, buffer: Buffer.from('pdf-bytes') }),
}));

jest.mock('../../src/plots/services/historyService', () => ({
  recordDocumentCreated: jest.fn(),
  recordDocumentUpdated: jest.fn(),
  recordDocumentDeleted: jest.fn(),
}));

import { generatePdf } from '../../src/documents/documentController';

const DOC_UUID = '11111111-1111-4111-8111-111111111111';

const buildResponse = (): Partial<Response> => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

const buildRequest = (body: unknown): Partial<Request> => ({
  body,
  params: {},
  query: {},
  user: {
    id: 1,
    email: 'operator@example.com',
    name: 'Operator',
    role: 'operator',
    is_active: true,
    supabase_uid: 'op-uid',
  },
});

// invoice テンプレートの最小有効データ
const invoiceBody = (documentId?: string) => ({
  templateType: 'invoice',
  documentId,
  templateData: {
    customerName: '山田太郎',
    amount: 12000,
  },
});

const buildDocumentRow = (overrides: Record<string, unknown> = {}) => ({
  id: DOC_UUID,
  contract_plot_id: null,
  customer_id: null,
  type: 'invoice',
  name: '護持費のお知らせ',
  status: 'generated',
  template_type: 'invoice',
  template_data: {},
  generated_at: new Date('2026-01-01'),
  sent_at: null,
  notes: null,
  deleted_at: null,
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-01'),
  ...overrides,
});

describe('generatePdf documentId 指定更新 (#230)', () => {
  let res: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('テンプレート種別が既存書類と不一致なら 400 TEMPLATE_TYPE_MISMATCH', async () => {
    res = buildResponse();
    // 既存は postcard、リクエストは invoice
    mockPrisma.document.findFirst.mockResolvedValue(
      buildDocumentRow({ template_type: 'postcard', type: 'postcard' })
    );

    await generatePdf(buildRequest(invoiceBody(DOC_UUID)) as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'TEMPLATE_TYPE_MISMATCH' }),
      })
    );
    // 破損データを作らない（update 未実行）
    expect(mockPrisma.document.update).not.toHaveBeenCalled();
  });

  it('種別一致時は template_type / type も含めて整合更新される', async () => {
    res = buildResponse();
    mockPrisma.document.findFirst.mockResolvedValue(buildDocumentRow());
    mockPrisma.document.update.mockResolvedValue(buildDocumentRow());

    await generatePdf(buildRequest(invoiceBody(DOC_UUID)) as Request, res as Response);

    expect(mockPrisma.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: DOC_UUID },
        data: expect.objectContaining({
          status: 'generated',
          template_type: 'invoice',
          type: 'invoice',
        }),
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('template_type 未設定の既存書類には種別を補完して更新する', async () => {
    res = buildResponse();
    mockPrisma.document.findFirst.mockResolvedValue(buildDocumentRow({ template_type: null }));
    mockPrisma.document.update.mockResolvedValue(buildDocumentRow());

    await generatePdf(buildRequest(invoiceBody(DOC_UUID)) as Request, res as Response);

    expect(mockPrisma.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ template_type: 'invoice' }),
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
