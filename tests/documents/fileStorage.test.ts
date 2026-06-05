import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

import {
  getUploadDir,
  buildDocumentFileKey,
  resolveDocumentFilePath,
  saveDocumentFile,
  deleteDocumentFile,
} from '../../src/documents/fileStorage';

const DOC_ID = '11111111-1111-4111-8111-111111111111';

describe('fileStorage', () => {
  let tmpDir: string;
  const originalUploadDir = process.env.UPLOAD_DIR;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'komine-upload-test-'));
    process.env.UPLOAD_DIR = tmpDir;
  });

  afterEach(async () => {
    if (originalUploadDir === undefined) {
      delete process.env.UPLOAD_DIR;
    } else {
      process.env.UPLOAD_DIR = originalUploadDir;
    }
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('getUploadDir', () => {
    it('UPLOAD_DIR 環境変数を優先する', () => {
      expect(getUploadDir()).toBe(tmpDir);
    });

    it('未設定時は ./uploads を返す', () => {
      delete process.env.UPLOAD_DIR;
      expect(getUploadDir()).toBe(path.resolve(process.cwd(), 'uploads'));
    });
  });

  describe('buildDocumentFileKey', () => {
    it('documents/{id}/ 配下のキーを生成し拡張子を保持する', () => {
      const key = buildDocumentFileKey(DOC_ID, '請求書_2026.pdf');
      expect(key).toMatch(new RegExp(`^documents/${DOC_ID}/[0-9a-f-]{36}\\.pdf$`));
    });

    it('不正な拡張子は付与しない', () => {
      const key = buildDocumentFileKey(DOC_ID, 'evil.../../etc/passwd<script>');
      expect(key).toMatch(new RegExp(`^documents/${DOC_ID}/[0-9a-f-]{36}$`));
    });

    it('拡張子なしのファイル名でもキーを生成する', () => {
      const key = buildDocumentFileKey(DOC_ID, 'README');
      expect(key).toMatch(new RegExp(`^documents/${DOC_ID}/[0-9a-f-]{36}$`));
    });
  });

  describe('resolveDocumentFilePath', () => {
    it('UPLOAD_DIR 配下の絶対パスへ解決する', () => {
      const resolved = resolveDocumentFilePath('documents/abc/file.pdf');
      expect(resolved).toBe(path.join(tmpDir, 'documents', 'abc', 'file.pdf'));
    });

    it('パストラバーサルを拒否する', () => {
      expect(() => resolveDocumentFilePath('../outside.txt')).toThrow('Invalid file key');
      expect(() => resolveDocumentFilePath('documents/../../etc/passwd')).toThrow(
        'Invalid file key'
      );
    });
  });

  describe('saveDocumentFile / deleteDocumentFile', () => {
    it('保存と削除ができる', async () => {
      const key = buildDocumentFileKey(DOC_ID, 'test.pdf');
      await saveDocumentFile(key, Buffer.from('pdf-content'));

      const saved = await fs.readFile(resolveDocumentFilePath(key), 'utf8');
      expect(saved).toBe('pdf-content');

      await deleteDocumentFile(key);
      await expect(fs.access(resolveDocumentFilePath(key))).rejects.toThrow();
    });

    it('存在しないファイルの削除はエラーにならない', async () => {
      await expect(deleteDocumentFile(`documents/${DOC_ID}/missing.pdf`)).resolves.toBeUndefined();
    });
  });
});
