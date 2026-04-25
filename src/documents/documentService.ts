/**
 * 書類管理サービス
 * PDF生成機能を提供（テンプレート + Puppeteer / pdf-lib）
 *
 * 設計方針:
 * - PDFファイルはサーバーに永続保存しない（オンデマンド再生成方式）
 * - DBにはメタデータ（template_data等）のみ保存し、必要時に再生成
 * - S3やローカルファイルストレージは不要
 *
 * 型・既定値・座標などフロントとバックで共有する定義は `@komine/types` を
 * 単一ソースとする。ここでは PDF 生成の実装のみ持つ。
 */

import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import {
  type DocumentTemplateType,
  type InvoiceTemplateData,
  type PostcardTemplateData,
  type PermitTemplateData,
  type PaymentGuideTemplateData,
  type PdfTemplateData,
  PAYMENT_GUIDE_DEFAULTS,
  getDefaultSeasonGreeting,
} from '@komine/types';
import { logger } from '../utils/logger';
import { generatePermitPdf } from './permitPdfService';

// 後方互換のため既存名で再エクスポート
export type TemplateType = DocumentTemplateType;
export type {
  InvoiceTemplateData,
  PostcardTemplateData,
  PermitTemplateData,
  PaymentGuideTemplateData,
  PdfTemplateData,
};
export { PAYMENT_GUIDE_DEFAULTS, getDefaultSeasonGreeting };

const PDF_TEXT_STYLE_PRESETS = new Set(['default', 'mincho', 'gothic_large', 'compact']);

/**
 * テンプレート埋め込み時に HTML エスケープせず、生 HTML としてそのまま挿入するキー。
 * サーバー側で生成し、ユーザー入力が混じらないキーだけをここに入れる。
 */
const RAW_HTML_KEYS = new Set(['textStyleBodyAttr']);

function normalizePdfTextStylePreset(raw: unknown): string {
  const s = String(raw ?? 'default');
  return PDF_TEXT_STYLE_PRESETS.has(s) ? s : 'default';
}

/**
 * HTMLテンプレートを読み込み、データを埋め込む
 */
function loadAndRenderTemplate(templateType: TemplateType, data: Record<string, unknown>): string {
  const templatePath = path.join(__dirname, 'templates', `${templateType}.html`);

  if (!fs.existsSync(templatePath)) {
    throw new Error(`テンプレートが見つかりません: ${templateType}`);
  }

  let html = fs.readFileSync(templatePath, 'utf-8');

  const preset = normalizePdfTextStylePreset(data['textStylePreset']);
  const dataForTemplate: Record<string, unknown> = {
    ...data,
    textStyleBodyAttr: preset === 'default' ? '' : ` class="doc-preset-${preset}"`,
  };

  // お支払い方法のご案内テンプレート：未入力フィールドに既定値を補完
  if (templateType === 'payment-guide') {
    for (const [key, value] of Object.entries(PAYMENT_GUIDE_DEFAULTS)) {
      if (
        dataForTemplate[key] === undefined ||
        dataForTemplate[key] === null ||
        String(dataForTemplate[key]).trim() === ''
      ) {
        dataForTemplate[key] = value;
      }
    }
  }

  // 護持費のお知らせテンプレート用：金額の桁区切り表示と季節挨拶のフォールバックを補完
  if (templateType === 'invoice') {
    const rawAmount = data['amount'] ?? data['total'];
    if (dataForTemplate['amountFormatted'] === undefined) {
      const amountNum =
        typeof rawAmount === 'number'
          ? rawAmount
          : typeof rawAmount === 'string' && rawAmount.trim() !== ''
            ? Number(rawAmount)
            : NaN;
      dataForTemplate['amountFormatted'] = Number.isFinite(amountNum)
        ? new Intl.NumberFormat('ja-JP').format(amountNum)
        : '';
    }
    if (
      !dataForTemplate['seasonGreeting'] ||
      String(dataForTemplate['seasonGreeting']).trim() === ''
    ) {
      dataForTemplate['seasonGreeting'] = getDefaultSeasonGreeting(new Date());
    }
  }

  // プレースホルダーを置換。
  // ユーザー入力を含むため HTMLエスケープは必須（XSS / `&` 等での表示崩壊対策）。
  // textStyleBodyAttr のみサーバーで生成した HTML 属性そのものを差し込むため allowlist で素通し。
  const flattenData = flattenObject(dataForTemplate);
  for (const [key, value] of Object.entries(flattenData)) {
    const placeholder = new RegExp(`{{\\s*${escapeRegex(key)}\\s*}}`, 'g');
    const stringValue = String(value ?? '');
    const replacement = RAW_HTML_KEYS.has(key) ? stringValue : escapeHtml(stringValue);
    // String.prototype.replace は第2引数文字列内の `$&` `$1` 等を特殊解釈するため、
    // 関数形式で渡してリテラル挿入にする。
    html = html.replace(placeholder, () => replacement);
  }

  // 残った未解決の {{ key }} プレースホルダーは空文字に置換
  html = html.replace(/\{\{\s*[\w.]+\s*\}\}/g, '');

  return html;
}

/**
 * オブジェクトをフラット化（ネストしたキーを.で連結）
 */
function flattenObject(
  obj: Record<string, unknown>,
  prefix = ''
): Record<string, string | number | boolean | null | undefined> {
  const result: Record<string, string | number | boolean | null | undefined> = {};

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (Array.isArray(value)) {
      // 配列は別途処理
      continue;
    } else if (value && typeof value === 'object') {
      Object.assign(result, flattenObject(value as Record<string, unknown>, newKey));
    } else {
      result[newKey] = value as string | number | boolean | null | undefined;
    }
  }

  return result;
}

/**
 * 正規表現の特殊文字をエスケープ
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * HTMLエスケープ
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * HTMLからPDFを生成
 */
export async function generatePdfFromHtml(
  html: string,
  options: {
    format?: 'A4' | 'Letter' | 'postcard';
    landscape?: boolean;
    margin?: {
      top?: string;
      right?: string;
      bottom?: string;
      left?: string;
    };
  } = {}
): Promise<{ success: boolean; buffer?: Buffer; error?: string }> {
  let browser = null;

  try {
    // puppeteerをサンドボックスモードで起動
    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env['PUPPETEER_EXECUTABLE_PATH'] || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      timeout: 60000,
    });

    const page = await browser.newPage();

    // ページ設定
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

    // PDF生成オプション
    const pdfOptions: Parameters<typeof page.pdf>[0] = {
      format: options.format === 'postcard' ? undefined : options.format || 'A4',
      landscape: options.landscape || false,
      margin: options.margin || {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm',
      },
      printBackground: true,
    };

    // はがきサイズの場合はカスタムサイズを設定
    if (options.format === 'postcard') {
      pdfOptions.width = '100mm';
      pdfOptions.height = '148mm';
    }

    const pdfBuffer = await page.pdf(pdfOptions);

    return { success: true, buffer: Buffer.from(pdfBuffer) };
  } catch (error) {
    logger.error({ err: error }, 'PDF generation error');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'PDF生成に失敗しました',
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * テンプレートからPDFを生成
 */
export async function generatePdfFromTemplate(
  templateType: TemplateType,
  data: PdfTemplateData,
  options?: {
    landscape?: boolean;
  }
): Promise<{ success: boolean; buffer?: Buffer; error?: string }> {
  try {
    // 許可証は既存のテンプレートPDFに pdf-lib で文字を重ねる
    if (templateType === 'permit') {
      return await generatePermitPdf(data as PermitTemplateData);
    }

    const html = loadAndRenderTemplate(templateType, data as unknown as Record<string, unknown>);

    const pdfOptions = {
      format: templateType === 'postcard' ? ('postcard' as const) : ('A4' as const),
      landscape: options?.landscape || false,
      margin:
        templateType === 'postcard'
          ? { top: '5mm', right: '5mm', bottom: '5mm', left: '5mm' }
          : undefined,
    };

    return await generatePdfFromHtml(html, pdfOptions);
  } catch (error) {
    logger.error({ err: error }, 'Template PDF generation error');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'テンプレートPDF生成に失敗しました',
    };
  }
}
