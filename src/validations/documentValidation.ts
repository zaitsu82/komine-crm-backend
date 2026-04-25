/**
 * 書類 / PDF 生成 API の Zod バリデーション。
 *
 * スキーマ本体は `@komine/types/validations` に定義（フロントと共有）。
 * バックでは generatePdf / regeneratePdf エンドポイントで利用する。
 */

import {
  generatePdfRequestSchema,
  invoiceTemplateDataSchema,
  postcardTemplateDataSchema,
  permitTemplateDataSchema,
  paymentGuideTemplateDataSchema,
  type DocumentTemplateType,
  type GeneratePdfRequestInput,
  type PdfTemplateData,
} from '@komine/types';

export {
  generatePdfRequestSchema,
  invoiceTemplateDataSchema,
  postcardTemplateDataSchema,
  permitTemplateDataSchema,
  paymentGuideTemplateDataSchema,
};
export type { GeneratePdfRequestInput };

const TEMPLATE_DATA_SCHEMAS = {
  invoice: invoiceTemplateDataSchema,
  postcard: postcardTemplateDataSchema,
  permit: permitTemplateDataSchema,
  'payment-guide': paymentGuideTemplateDataSchema,
} as const;

/**
 * regeneratePdf で DB から復元した template_data を、
 * テンプレート種別に応じてパースする。
 * 不正なら ZodError をスロー。
 */
export function parseTemplateData(
  templateType: DocumentTemplateType,
  raw: unknown
): PdfTemplateData {
  const schema = TEMPLATE_DATA_SCHEMAS[templateType];
  return schema.parse(raw) as PdfTemplateData;
}
