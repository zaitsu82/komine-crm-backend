/**
 * documentValidation.parseTemplateData の単体テスト
 *
 * regeneratePdf で DB から復元した template_data を、テンプレ種別ごとの
 * Zod スキーマでパースする。正常系と不正系（ZodError スロー）を検証する。
 *
 * generatePdfRequestSchema（POST /documents/generate-pdf の入口検証）も
 * ここで検証する。discriminated union から envelope-letter/envelope-base が
 * 欠落していた回帰を防ぐ（types#32）。
 */
import {
  parseTemplateData,
  generatePdfRequestSchema,
} from '../../src/validations/documentValidation';
import { DOCUMENT_TEMPLATE_TYPES } from '@komine/types';

const validPostcard = {
  recipientName: '受取 太郎',
  recipientAddress: '福岡県北九州市1-2-3',
  recipientPostalCode: '8000000',
  senderName: '小嶺霊園',
  senderAddress: '福岡県北九州市4-5-6',
  senderPostalCode: '8001111',
  message: 'お知らせ',
  date: '2026-05-26',
};

describe('parseTemplateData', () => {
  describe('invoice', () => {
    it('customerName があれば通る', () => {
      const r = parseTemplateData('invoice', { customerName: '山田', amount: 1000 });
      expect(r).toMatchObject({ customerName: '山田' });
    });
    it('customerName が無いと ZodError', () => {
      expect(() => parseTemplateData('invoice', {})).toThrow();
    });
    it('items の要素型が不正だと ZodError', () => {
      expect(() =>
        parseTemplateData('invoice', {
          customerName: '山田',
          items: [{ description: 'x', quantity: 'NaN', unitPrice: 1, amount: 1 }],
        })
      ).toThrow();
    });
  });

  describe('postcard', () => {
    it('必須フィールドが揃えば通る', () => {
      const r = parseTemplateData('postcard', validPostcard);
      expect(r).toMatchObject({ recipientName: '受取 太郎' });
    });
    it('必須フィールド欠落で ZodError', () => {
      const { message, ...missing } = validPostcard;
      void message;
      expect(() => parseTemplateData('postcard', missing)).toThrow();
    });
    it('型不一致（数値）で ZodError', () => {
      expect(() =>
        parseTemplateData('postcard', { ...validPostcard, recipientName: 123 })
      ).toThrow();
    });
  });

  describe('permit / envelope-letter / envelope-base（全フィールド任意）', () => {
    it.each(['permit', 'envelope-letter', 'envelope-base'] as const)(
      '%s は空オブジェクトでも通る',
      (type) => {
        expect(() => parseTemplateData(type, {})).not.toThrow();
      }
    );
    it('permit は値を保持する', () => {
      const r = parseTemplateData('permit', { permitNumber: 'P-1', plotNumber: 'A-56' });
      expect(r).toMatchObject({ permitNumber: 'P-1', plotNumber: 'A-56' });
    });
    it('permit の型不一致で ZodError', () => {
      expect(() => parseTemplateData('permit', { permitNumber: 123 })).toThrow();
    });
  });

  describe('payment-guide（全フィールド任意）', () => {
    it('空オブジェクトでも通る', () => {
      expect(() => parseTemplateData('payment-guide', {})).not.toThrow();
    });
    it('値を保持する', () => {
      const r = parseTemplateData('payment-guide', { orgName: '小嶺霊園' });
      expect(r).toMatchObject({ orgName: '小嶺霊園' });
    });
  });
});

describe('generatePdfRequestSchema（generate-pdf 入口検証）', () => {
  // テンプレートタイプごとの最小有効 templateData
  const MINIMAL_TEMPLATE_DATA: Record<string, unknown> = {
    invoice: { customerName: '山田太郎' },
    postcard: {
      recipientName: '受取 太郎',
      recipientAddress: '福岡県北九州市1-2-3',
      recipientPostalCode: '8000000',
      senderName: '小嶺霊園',
      senderAddress: '福岡県北九州市4-5-6',
      senderPostalCode: '8001111',
      message: 'お知らせ',
      date: '2026-06-05',
    },
    permit: {},
    'envelope-letter': { recipientName: '受取 太郎' },
    'envelope-base': { recipientName: '受取 太郎' },
    'payment-guide': {},
  };

  // envelope-letter/envelope-base が union から欠落していると
  // 'No matching discriminator' で封筒PDFが常時400になる（types#32 の回帰防止）
  it.each(DOCUMENT_TEMPLATE_TYPES.map((t) => [t]))(
    '全テンプレートタイプを受理する: %s',
    (templateType) => {
      const result = generatePdfRequestSchema.safeParse({
        templateType,
        templateData: MINIMAL_TEMPLATE_DATA[templateType],
      });
      expect(result.success).toBe(true);
    }
  );

  it('未知の templateType は拒否する', () => {
    const result = generatePdfRequestSchema.safeParse({
      templateType: 'unknown',
      templateData: {},
    });
    expect(result.success).toBe(false);
  });
});
