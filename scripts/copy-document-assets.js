#!/usr/bin/env node
/**
 * 書類モジュールのアセット (HTMLテンプレート / 日本語フォント / 許可証ベースPDF) を
 * tsc ビルド後に dist/documents/templates へコピーする。
 *
 * 背景: tsc は .ts のみコンパイルするため、書類モジュールが実行時に参照する
 * 静的アセットは dist に含まれない。本スクリプトを `npm run build` の最後に
 * 実行することで、本番起動時 (`node dist/index.js`) に
 * `テンプレートが見つかりません` で落ちるのを防ぐ。
 *
 * 関連: zaitsu82/komine-crm-backend#96
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const src = path.join(projectRoot, 'src/documents/templates');
const dest = path.join(projectRoot, 'dist/documents/templates');

if (!fs.existsSync(src)) {
  console.error(`[copy-document-assets] source not found: ${src}`);
  process.exit(1);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true });

const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else files.push(path.relative(dest, full));
  }
}
walk(dest);

console.log(`[copy-document-assets] copied ${files.length} file(s) -> ${path.relative(projectRoot, dest)}`);
