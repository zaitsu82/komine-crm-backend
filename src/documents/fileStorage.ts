/**
 * 書類添付ファイルのローカルストレージ
 *
 * 設計方針:
 * - 本番は事務所サーバ1台のローカル運用のため、添付ファイルは
 *   サーバ上のディレクトリ（UPLOAD_DIR、未設定時は ./uploads）に保存する
 * - DB（Document.file_key）には UPLOAD_DIR からの相対パスを保存する
 * - 将来オブジェクトストレージへ移行する場合はこのモジュールだけ差し替える
 */

import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

/** アップロードファイルの保存先ルートディレクトリ */
export function getUploadDir(): string {
  // env 生値をそのまま使うと、末尾スラッシュ付き（.../uploads/）や相対パスの設定で
  // resolveDocumentFilePath の startsWith ガードが常に偽になり、全アップロード・
  // ダウンロードが「ファイルが見つかりません」で無言全停止する（#274）。
  // path.resolve で常に正規化済み絶対パスに揃える（末尾スラッシュ除去・相対→絶対）。
  return path.resolve(process.env['UPLOAD_DIR'] || path.join(process.cwd(), 'uploads'));
}

/**
 * ファイルキー（UPLOAD_DIR からの相対パス）を生成する。
 * 元のファイル名はDBの file_name に保持するため、キーには含めない
 * （パストラバーサル・文字化け・重複を避ける）。
 */
export function buildDocumentFileKey(documentId: string, originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  // 拡張子は英数字のみ許可（不正な値は付与しない）
  const safeExt = /^\.[a-z0-9]{1,10}$/.test(ext) ? ext : '';
  return path.posix.join('documents', documentId, `${randomUUID()}${safeExt}`);
}

/**
 * ファイルキーが UPLOAD_DIR 配下に解決されることを検証して絶対パスを返す。
 * パストラバーサル対策。
 */
export function resolveDocumentFilePath(fileKey: string): string {
  const uploadDir = getUploadDir();
  const resolved = path.resolve(uploadDir, fileKey);
  if (!resolved.startsWith(uploadDir + path.sep)) {
    throw new Error(`Invalid file key: ${fileKey}`);
  }
  return resolved;
}

/** バッファをファイルキーの位置へ保存する */
export async function saveDocumentFile(fileKey: string, buffer: Buffer): Promise<void> {
  const filePath = resolveDocumentFilePath(fileKey);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, buffer);
}

/** ファイルキーのファイルを削除する（存在しない場合は無視） */
export async function deleteDocumentFile(fileKey: string): Promise<void> {
  try {
    await fs.unlink(resolveDocumentFilePath(fileKey));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') throw error;
  }
}
