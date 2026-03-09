/**
 * 書類管理サービス
 * PDF生成機能を提供（テンプレート + Puppeteer）
 *
 * 設計方針:
 * - PDFファイルはサーバーに永続保存しない（オンデマンド再生成方式）
 * - DBにはメタデータ（template_data等）のみ保存し、必要時に再生成
 * - S3やローカルファイルストレージは不要
 */

import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

// テンプレートタイプ
export type TemplateType = 'invoice' | 'postcard';

// テンプレートデータ型
export interface InvoiceTemplateData {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  customerName: string;
  customerAddress: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
  subtotal: number;
  tax: number;
  total: number;
  notes?: string;
}

export interface PostcardTemplateData {
  recipientName: string;
  recipientAddress: string;
  recipientPostalCode: string;
  senderName: string;
  senderAddress: string;
  senderPostalCode: string;
  message: string;
  date: string;
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

  // プレースホルダーを置換
  const flattenData = flattenObject(data);
  for (const [key, value] of Object.entries(flattenData)) {
    const placeholder = new RegExp(`{{\\s*${escapeRegex(key)}\\s*}}`, 'g');
    html = html.replace(placeholder, String(value ?? ''));
  }

  // items配列の特別処理（請求書用）
  if ('items' in data && Array.isArray(data['items'])) {
    const items = data['items'] as Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      amount: number;
    }>;
    const itemsHtml = items
      .map(
        (item) => `
        <tr>
          <td>${escapeHtml(item.description)}</td>
          <td class="text-right">${item.quantity}</td>
          <td class="text-right">${formatCurrency(item.unitPrice)}</td>
          <td class="text-right">${formatCurrency(item.amount)}</td>
        </tr>
      `
      )
      .join('');
    html = html.replace(/{{#items}}[\s\S]*?{{\/items}}/g, itemsHtml);
  }

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
 * 通貨フォーマット
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
  }).format(amount);
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
    console.error('PDF generation error:', error);
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
  data: InvoiceTemplateData | PostcardTemplateData,
  options?: {
    landscape?: boolean;
  }
): Promise<{ success: boolean; buffer?: Buffer; error?: string }> {
  try {
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
    console.error('Template PDF generation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'テンプレートPDF生成に失敗しました',
    };
  }
}
