/**
 * 長形3号（120×235mm）の封筒ベース PDF を生成する。
 * 郵便番号枠は日本郵便定形郵便物仕様の目安（上12mm・右8mm・幅47.7mm）に合わせる。
 * 実行: node scripts/generate-envelope-chou3-pdfs.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = path.join(__dirname, '../src/documents/templates/permit');

const MM_TO_PT = 72 / 25.4;
const mm = (n) => n * MM_TO_PT;

const WIDTH_PT = mm(120);
const HEIGHT_PT = mm(235);

const POSTAL_TOP_MM = 12;
const POSTAL_RIGHT_MM = 8;
const POSTAL_GROUP_WIDTH_MM = 47.7;
const POSTAL_BOX_WIDTH_MM = 5.7;
const POSTAL_BOX_HEIGHT_MM = 8;
const POSTAL_GROUP_LEFT_MM = 120 - POSTAL_RIGHT_MM - POSTAL_GROUP_WIDTH_MM;
const DIGIT_LEFT_MM = [0, 7.0, 14.0, 21.6, 28.4, 35.2, 42.2];

function drawPostalBoxes(page, font) {
  const red = rgb(0.78, 0.16, 0.16);
  const topPt = mm(POSTAL_TOP_MM);
  const boxW = mm(POSTAL_BOX_WIDTH_MM);
  const boxH = mm(POSTAL_BOX_HEIGHT_MM);
  const y = HEIGHT_PT - topPt - boxH;

  for (const offsetMm of DIGIT_LEFT_MM) {
    const x = mm(POSTAL_GROUP_LEFT_MM + offsetMm);
    page.drawRectangle({
      x,
      y,
      width: boxW,
      height: boxH,
      borderColor: red,
      borderWidth: 1,
      color: rgb(1, 1, 1),
    });
  }

  const box3Right = mm(POSTAL_GROUP_LEFT_MM + 14.0 + POSTAL_BOX_WIDTH_MM);
  const box4Left = mm(POSTAL_GROUP_LEFT_MM + 21.6);
  const hyphenX = (box3Right + box4Left) / 2;
  page.drawText('-', {
    x: hyphenX - 2,
    y: y + boxH * 0.28,
    size: 10,
    font,
    color: red,
  });
}

async function createFrontPdf() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([WIDTH_PT, HEIGHT_PT]);
  drawPostalBoxes(page, font);

  const out = path.join(TEMPLATE_DIR, 'permit-base-2.pdf');
  fs.writeFileSync(out, await doc.save());
  console.log('Wrote', out, `${WIDTH_PT.toFixed(1)}×${HEIGHT_PT.toFixed(1)} pt`);
}

async function createBackPdf() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([WIDTH_PT, HEIGHT_PT]);
  const out = path.join(TEMPLATE_DIR, 'permit-base-3.pdf');
  fs.writeFileSync(out, await doc.save());
  console.log('Wrote', out, `${WIDTH_PT.toFixed(1)}×${HEIGHT_PT.toFixed(1)} pt`);
}

await createFrontPdf();
await createBackPdf();
