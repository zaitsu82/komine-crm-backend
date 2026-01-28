/**
 * 書類管理サービス
 * S3連携とPDF生成機能を提供
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

// S3クライアント設定
const s3Config = {
  region: process.env['AWS_REGION'] || 'ap-northeast-1',
  credentials: {
    accessKeyId: process.env['AWS_ACCESS_KEY_ID'] || '',
    secretAccessKey: process.env['AWS_SECRET_ACCESS_KEY'] || '',
  },
};

const s3Client = new S3Client(s3Config);
const BUCKET_NAME = process.env['S3_BUCKET_NAME'] || 'komine-cemetery-documents';

// ローカルストレージ設定
const LOCAL_UPLOAD_DIR = process.env['LOCAL_UPLOAD_DIR'] || path.join(process.cwd(), 'uploads');

// 許可されるMIMEタイプ
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

// 最大ファイルサイズ（10MB）
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * S3が設定されているかチェック
 */
export function isS3Configured(): boolean {
  return !!(
    process.env['AWS_ACCESS_KEY_ID'] &&
    process.env['AWS_SECRET_ACCESS_KEY'] &&
    process.env['S3_BUCKET_NAME']
  );
}

/**
 * MIMEタイプを検証
 */
export function isAllowedMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.includes(mimeType);
}

/**
 * ファイルサイズを検証
 */
export function isAllowedFileSize(size: number): boolean {
  return size <= MAX_FILE_SIZE;
}

/**
 * S3ファイルキーを生成
 */
export function generateFileKey(
  documentId: string,
  originalFileName: string,
  prefix = 'documents'
): string {
  const ext = path.extname(originalFileName);
  const timestamp = Date.now();
  return `${prefix}/${documentId}/${timestamp}${ext}`;
}

/**
 * ファイルをS3にアップロード
 */
export async function uploadFileToS3(
  fileKey: string,
  buffer: Buffer,
  mimeType: string,
  originalFileName: string
): Promise<{ success: boolean; fileKey?: string; error?: string }> {
  if (!isS3Configured()) {
    return { success: false, error: 'S3が設定されていません' };
  }

  if (!isAllowedMimeType(mimeType)) {
    return { success: false, error: '許可されていないファイル形式です' };
  }

  if (!isAllowedFileSize(buffer.length)) {
    return { success: false, error: 'ファイルサイズが10MBを超えています' };
  }

  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileKey,
      Body: buffer,
      ContentType: mimeType,
      Metadata: {
        'original-filename': encodeURIComponent(originalFileName),
      },
    });

    await s3Client.send(command);
    return { success: true, fileKey };
  } catch (error) {
    console.error('S3 upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'アップロードに失敗しました',
    };
  }
}

/**
 * S3からファイルを取得
 */
export async function downloadFileFromS3(
  fileKey: string
): Promise<{ success: boolean; buffer?: Buffer; mimeType?: string; error?: string }> {
  if (!isS3Configured()) {
    return { success: false, error: 'S3が設定されていません' };
  }

  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileKey,
    });

    const response = await s3Client.send(command);

    if (!response.Body) {
      return { success: false, error: 'ファイルが見つかりません' };
    }

    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }

    const buffer = Buffer.concat(chunks);
    return {
      success: true,
      buffer,
      mimeType: response.ContentType || 'application/octet-stream',
    };
  } catch (error) {
    console.error('S3 download error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'ダウンロードに失敗しました',
    };
  }
}

/**
 * S3ファイルの署名付きURLを取得（15分有効）
 */
export async function getPresignedDownloadUrl(
  fileKey: string,
  expiresInSeconds = 900
): Promise<{ success: boolean; url?: string; error?: string }> {
  if (!isS3Configured()) {
    return { success: false, error: 'S3が設定されていません' };
  }

  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileKey,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
    return { success: true, url };
  } catch (error) {
    console.error('S3 presigned URL error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '署名付きURL生成に失敗しました',
    };
  }
}

/**
 * S3からファイルを削除
 */
export async function deleteFileFromS3(
  fileKey: string
): Promise<{ success: boolean; error?: string }> {
  if (!isS3Configured()) {
    return { success: false, error: 'S3が設定されていません' };
  }

  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileKey,
    });

    await s3Client.send(command);
    return { success: true };
  } catch (error) {
    console.error('S3 delete error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '削除に失敗しました',
    };
  }
}

/**
 * S3ファイルの存在確認
 */
export async function checkFileExistsInS3(
  fileKey: string
): Promise<{ exists: boolean; size?: number; error?: string }> {
  if (!isS3Configured()) {
    return { exists: false, error: 'S3が設定されていません' };
  }

  try {
    const command = new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileKey,
    });

    const response = await s3Client.send(command);
    return { exists: true, size: response.ContentLength };
  } catch (error) {
    // NotFound は正常なケース
    if ((error as { name?: string }).name === 'NotFound') {
      return { exists: false };
    }
    console.error('S3 head object error:', error);
    return {
      exists: false,
      error: error instanceof Error ? error.message : 'ファイル確認に失敗しました',
    };
  }
}

// =============================================================================
// ローカルファイルストレージ（S3未設定時のフォールバック）
// =============================================================================

/**
 * ローカルアップロードディレクトリを取得（なければ作成）
 */
function getLocalUploadDir(): string {
  if (!fs.existsSync(LOCAL_UPLOAD_DIR)) {
    fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
  }
  return LOCAL_UPLOAD_DIR;
}

/**
 * ファイルをローカルにアップロード
 */
export async function uploadFileToLocal(
  fileKey: string,
  buffer: Buffer,
  mimeType: string,
  originalFileName: string
): Promise<{ success: boolean; fileKey?: string; error?: string }> {
  if (!isAllowedMimeType(mimeType)) {
    return { success: false, error: '許可されていないファイル形式です' };
  }

  if (!isAllowedFileSize(buffer.length)) {
    return { success: false, error: 'ファイルサイズが10MBを超えています' };
  }

  try {
    const uploadDir = getLocalUploadDir();
    const filePath = path.join(uploadDir, fileKey);
    const dirPath = path.dirname(filePath);

    // ディレクトリを作成
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    // メタデータファイルも保存
    const metaPath = `${filePath}.meta.json`;
    const metadata = {
      originalFileName,
      mimeType,
      size: buffer.length,
      uploadedAt: new Date().toISOString(),
    };

    fs.writeFileSync(filePath, buffer);
    fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2));

    return { success: true, fileKey };
  } catch (error) {
    console.error('Local upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'アップロードに失敗しました',
    };
  }
}

/**
 * ローカルからファイルを取得
 */
export async function downloadFileFromLocal(
  fileKey: string
): Promise<{ success: boolean; buffer?: Buffer; mimeType?: string; error?: string }> {
  try {
    const uploadDir = getLocalUploadDir();
    const filePath = path.join(uploadDir, fileKey);
    const metaPath = `${filePath}.meta.json`;

    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'ファイルが見つかりません' };
    }

    const buffer = fs.readFileSync(filePath);
    let mimeType = 'application/octet-stream';

    if (fs.existsSync(metaPath)) {
      const metadata = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      mimeType = metadata.mimeType || mimeType;
    }

    return { success: true, buffer, mimeType };
  } catch (error) {
    console.error('Local download error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'ダウンロードに失敗しました',
    };
  }
}

/**
 * ローカルからファイルを削除
 */
export async function deleteFileFromLocal(
  fileKey: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const uploadDir = getLocalUploadDir();
    const filePath = path.join(uploadDir, fileKey);
    const metaPath = `${filePath}.meta.json`;

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    if (fs.existsSync(metaPath)) {
      fs.unlinkSync(metaPath);
    }

    return { success: true };
  } catch (error) {
    console.error('Local delete error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '削除に失敗しました',
    };
  }
}

/**
 * ローカルファイルのダウンロードURL（APIエンドポイント経由）
 */
export function getLocalDownloadUrl(
  fileKey: string,
  baseUrl?: string
): { success: boolean; url?: string; error?: string } {
  const uploadDir = getLocalUploadDir();
  const filePath = path.join(uploadDir, fileKey);

  if (!fs.existsSync(filePath)) {
    return { success: false, error: 'ファイルが見つかりません' };
  }

  // ローカル開発環境ではAPIエンドポイント経由でダウンロード
  // 実際のURLはコントローラー側で生成
  const url = baseUrl
    ? `${baseUrl}/api/v1/documents/file/${encodeURIComponent(fileKey)}`
    : `/api/v1/documents/file/${encodeURIComponent(fileKey)}`;

  return { success: true, url };
}

// =============================================================================
// 統合ストレージAPI（S3またはローカルを自動選択）
// =============================================================================

/**
 * ストレージが利用可能かチェック（S3またはローカル）
 */
export function isStorageConfigured(): boolean {
  return isS3Configured() || true; // ローカルは常に利用可能
}

/**
 * ファイルをアップロード（S3またはローカル）
 */
export async function uploadFile(
  fileKey: string,
  buffer: Buffer,
  mimeType: string,
  originalFileName: string
): Promise<{ success: boolean; fileKey?: string; error?: string; storage: 's3' | 'local' }> {
  if (isS3Configured()) {
    const result = await uploadFileToS3(fileKey, buffer, mimeType, originalFileName);
    return { ...result, storage: 's3' };
  }

  const result = await uploadFileToLocal(fileKey, buffer, mimeType, originalFileName);
  return { ...result, storage: 'local' };
}

/**
 * ファイルをダウンロード（S3またはローカル）
 */
export async function downloadFile(fileKey: string): Promise<{
  success: boolean;
  buffer?: Buffer;
  mimeType?: string;
  error?: string;
  storage: 's3' | 'local';
}> {
  if (isS3Configured()) {
    const result = await downloadFileFromS3(fileKey);
    return { ...result, storage: 's3' };
  }

  const result = await downloadFileFromLocal(fileKey);
  return { ...result, storage: 'local' };
}

/**
 * ファイルを削除（S3またはローカル）
 */
export async function deleteFile(
  fileKey: string
): Promise<{ success: boolean; error?: string; storage: 's3' | 'local' }> {
  if (isS3Configured()) {
    const result = await deleteFileFromS3(fileKey);
    return { ...result, storage: 's3' };
  }

  const result = await deleteFileFromLocal(fileKey);
  return { ...result, storage: 'local' };
}

/**
 * ダウンロードURLを取得（S3またはローカル）
 */
export async function getDownloadUrl(
  fileKey: string,
  baseUrl?: string
): Promise<{ success: boolean; url?: string; error?: string; storage: 's3' | 'local' }> {
  if (isS3Configured()) {
    const result = await getPresignedDownloadUrl(fileKey);
    return { ...result, storage: 's3' };
  }

  const result = getLocalDownloadUrl(fileKey, baseUrl);
  return { ...result, storage: 'local' };
}

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
