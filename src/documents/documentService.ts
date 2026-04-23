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
import { logger } from '../utils/logger';
import { generatePermitPdf } from './permitPdfService';
import type { PermitTemplateData } from './templates/permit/fieldLayouts';

// テンプレートタイプ
export type TemplateType = 'invoice' | 'postcard' | 'permit' | 'payment-guide';

const PDF_TEXT_STYLE_PRESETS = new Set(['default', 'mincho', 'gothic_large', 'compact']);

function normalizePdfTextStylePreset(raw: unknown): string {
  const s = String(raw ?? 'default');
  return PDF_TEXT_STYLE_PRESETS.has(s) ? s : 'default';
}

/**
 * 月に応じた既定の季節挨拶（時候の挨拶）を返す。
 * ユーザーが未入力のときのフォールバックにのみ使用する。
 */
export function getDefaultSeasonGreeting(date: Date = new Date()): string {
  const m = date.getMonth() + 1;
  switch (m) {
    case 1:
      return '厳寒の候';
    case 2:
      return '晩冬の候';
    case 3:
      return '早春の候';
    case 4:
      return '春暖の候';
    case 5:
      return '新緑の候';
    case 6:
      return '初夏の候';
    case 7:
      return '盛夏の候';
    case 8:
      return '残暑の候';
    case 9:
      return '初秋の候';
    case 10:
      return '秋涼の候';
    case 11:
      return '晩秋の候';
    case 12:
      return '師走の候';
    default:
      return '時下';
  }
}

/**
 * 護持費のお知らせ（invoice テンプレート）のテンプレートデータ
 * 画像の黒崎小嶺霊園 管理事務所のフォーマットに合わせた構造。
 * 旧「請求書」形式向けフィールドは互換のため optional で残している。
 */
export interface InvoiceTemplateData {
  // 護持費のお知らせ用フィールド
  customerName: string;
  /** 護持費の更新年数（「◯年分」の◯） */
  yearCount?: number | string;
  /** お支払金額（円、数値） */
  amount?: number;
  /** 次回お預かり日（例: 2026年12月31日） */
  nextNoticeDate?: string;
  /** 季節の挨拶（例: 早春の候 / 盛夏の候 など） */
  seasonGreeting?: string;

  // 旧請求書テンプレート互換フィールド（任意）
  invoiceNumber?: string;
  issueDate?: string;
  dueDate?: string;
  customerAddress?: string;
  items?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
  subtotal?: number;
  tax?: number;
  total?: number;
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
 * お支払い方法のご案内テンプレートのデータ
 * 画像（黒崎小嶺霊園の支払い方法案内）の内容に沿ったフィールド。
 * 用紙内容は概ね固定だが、銀行情報や代表者名など変わりうる部分は編集可能。
 */
export interface PaymentGuideTemplateData {
  // 支払い方法の本文（通常は固定）
  option1?: string;
  option2?: string;
  notice1?: string;
  notice2?: string;
  notice3?: string;

  // 金融機関 1（信用金庫など）
  bank1Name?: string;
  bank1AccountType?: string;
  bank1AccountNumber?: string;

  // 金融機関 2（ゆうちょ）
  bank2Name?: string;
  bank2Symbol?: string;
  bank2Number?: string;

  // 名義・組織
  orgName?: string;
  orgNameKana?: string;
  repName?: string;
  repNameKana?: string;

  // 署名ブロック
  cemeteryName?: string;
  tel?: string;
  fax?: string;
}

/**
 * 未入力時に使う「お支払い方法のご案内」テンプレートの既定値。
 * 黒崎小嶺霊園の現状の案内内容を反映している。
 */
export const PAYMENT_GUIDE_DEFAULTS: Required<
  Pick<
    PaymentGuideTemplateData,
    | 'option1'
    | 'option2'
    | 'notice1'
    | 'notice2'
    | 'notice3'
    | 'bank1Name'
    | 'bank1AccountType'
    | 'bank1AccountNumber'
    | 'bank2Name'
    | 'bank2Symbol'
    | 'bank2Number'
    | 'orgName'
    | 'orgNameKana'
    | 'repName'
    | 'repNameKana'
    | 'cemeteryName'
    | 'tel'
    | 'fax'
  >
> = {
  option1: '当霊園事務所へご持参下さい。',
  option2: '又は、下記の銀行か郵便局へお振込み下さい。',
  notice1: 'お振込の場合の振込手数料はお客様の負担となりますので、ご了承下さいませ。',
  notice2:
    'お振込みの場合、当園からの領収書は発行されませんので、金融機関の受領書を大切に保管されて下さい。',
  notice3: 'お振込みの際、名義人様のお名前を必ず記載してください。',
  bank1Name: '福岡ひびき信用金庫 町上津役支店',
  bank1AccountType: '普通',
  bank1AccountNumber: '1165176',
  bank2Name: 'ゆうちょ銀行',
  bank2Symbol: '17470',
  bank2Number: '63945001',
  orgName: '長谷寺',
  orgNameKana: 'はせじ',
  repName: '渡辺 祐昭',
  repNameKana: 'わたなべ ゆうしょう',
  cemeteryName: '黒崎小嶺霊園',
  tel: '093-613-3868',
  fax: '093-613-3893',
};

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

  // プレースホルダーを置換
  const flattenData = flattenObject(dataForTemplate);
  for (const [key, value] of Object.entries(flattenData)) {
    const placeholder = new RegExp(`{{\\s*${escapeRegex(key)}\\s*}}`, 'g');
    html = html.replace(placeholder, String(value ?? ''));
  }

  // 残った未解決の {{ key }} プレースホルダーは空文字に置換
  html = html.replace(/\{\{\s*[\w.]+\s*\}\}/g, '');

  // items配列の特別処理（旧請求書テンプレート互換）
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
  data: InvoiceTemplateData | PostcardTemplateData | PermitTemplateData | PaymentGuideTemplateData,
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
