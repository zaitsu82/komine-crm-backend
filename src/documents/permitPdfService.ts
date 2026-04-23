/**
 * 許可証PDF生成サービス
 * 既存のテンプレートPDF（permit-base-*.pdf）にテキストを重ねて出力する。
 */

import * as fs from 'fs';
import * as path from 'path';
import { PDFDocument, rgb, degrees, PDFFont } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { PERMIT_PAGES, PermitField, PermitTemplateData } from './templates/permit/fieldLayouts';
import { logger } from '../utils/logger';

const TEMPLATE_DIR = path.join(__dirname, 'templates', 'permit');
const FONT_REGULAR_PATH = path.join(TEMPLATE_DIR, 'NotoSansJP-Regular.ttf');
const FONT_BOLD_PATH = path.join(TEMPLATE_DIR, 'NotoSansJP-Bold.ttf');

let _fontCache: { regular: Buffer; bold: Buffer } | null = null;
function loadFonts(): { regular: Buffer; bold: Buffer } {
  if (!_fontCache) {
    _fontCache = {
      regular: fs.readFileSync(FONT_REGULAR_PATH),
      bold: fs.readFileSync(FONT_BOLD_PATH),
    };
  }
  return _fontCache;
}

function getValue(data: PermitTemplateData, id: string): string {
  const v = (data as unknown as Record<string, unknown>)[id];
  if (v === undefined || v === null) return '';
  return String(v);
}

/**
 * 指定のフィールドにテキストを描画
 * pdf-lib の座標系（原点: 左下）で計算。
 */
function drawField(
  page: import('pdf-lib').PDFPage,
  field: PermitField,
  value: string,
  fontRegular: PDFFont,
  fontBold: PDFFont
): void {
  if (!value) return;
  const font = field.bold ? fontBold : fontRegular;
  const size = field.fontSize;

  if (field.direction === 'vertical') {
    const lineHeight = field.lineHeight ?? size * 1.3;
    const chars = Array.from(value);
    chars.forEach((ch, i) => {
      const w = font.widthOfTextAtSize(ch, size);
      const cx = field.x - w / 2;
      const cy = field.y - i * lineHeight;
      page.drawText(ch, {
        x: cx,
        y: cy,
        size,
        font,
        color: rgb(0, 0, 0),
      });
    });
    return;
  }

  if (field.direction === 'rotated') {
    // -90° 回転で縦方向に流れる
    const w = font.widthOfTextAtSize(value, size);
    const align = field.align ?? 'left';
    let startY = field.y;
    if (align === 'center') startY = field.y - w / 2;
    else if (align === 'right') startY = field.y - w;
    page.drawText(value, {
      x: field.x,
      y: startY,
      size,
      font,
      rotate: degrees(-90),
      color: rgb(0, 0, 0),
    });
    return;
  }

  // horizontal
  const w = font.widthOfTextAtSize(value, size);
  const align = field.align ?? 'left';
  let x = field.x;
  if (align === 'center') x = field.x - w / 2;
  else if (align === 'right') x = field.x - w;
  page.drawText(value, {
    x,
    y: field.y,
    size,
    font,
    color: rgb(0, 0, 0),
  });
}

/**
 * 許可証テンプレートPDFにテキストを重ねて、5ページまとめた1つのPDFを返す
 */
export async function generatePermitPdf(
  data: PermitTemplateData
): Promise<{ success: boolean; buffer?: Buffer; error?: string }> {
  try {
    const fonts = loadFonts();
    const outDoc = await PDFDocument.create();
    outDoc.registerFontkit(fontkit);
    // subset=true だと CID マップ不整合で一部文字が描画されない現象があったため、
    // 全グリフを埋め込む（ファイルサイズは増えるが表示を優先）
    const fontRegular = await outDoc.embedFont(fonts.regular, { subset: false });
    const fontBold = await outDoc.embedFont(fonts.bold, { subset: false });

    for (const pageDef of PERMIT_PAGES) {
      if (!pageDef.enabled) continue;
      const basePath = path.join(TEMPLATE_DIR, pageDef.baseFile);
      if (!fs.existsSync(basePath)) {
        logger.warn({ basePath }, 'Permit base PDF missing, skipping');
        continue;
      }

      const baseBytes = fs.readFileSync(basePath);
      const embeddedPages = await outDoc.embedPdf(baseBytes);
      const embeddedPage = embeddedPages[0];
      const newPage = outDoc.addPage([pageDef.widthPt, pageDef.heightPt]);
      if (embeddedPage) {
        newPage.drawPage(embeddedPage, {
          x: 0,
          y: 0,
          width: pageDef.widthPt,
          height: pageDef.heightPt,
        });
      }

      for (const field of pageDef.fields) {
        const value = getValue(data, field.id);
        drawField(newPage, field, value, fontRegular, fontBold);
      }
    }

    const bytes = await outDoc.save();
    return { success: true, buffer: Buffer.from(bytes) };
  } catch (error) {
    logger.error({ err: error }, 'Permit PDF generation error');
    return {
      success: false,
      error: error instanceof Error ? error.message : '許可証PDFの生成に失敗しました',
    };
  }
}
