/**
 * sanitizeDocumentFileName の単体テスト
 *
 * 書類ダウンロード時のファイル名生成（documentController が利用）。
 * 実体は @komine/types に定義され、backend が依存する共通サニタイザ。
 */
import { sanitizeDocumentFileName } from '@komine/types';

describe('sanitizeDocumentFileName', () => {
  it('OS 不正文字（/ \\ ? % * : | " < >）を _ に置換する', () => {
    expect(sanitizeDocumentFileName('a/b\\c?d%e*f:g|h"i<j>k')).toBe('a_b_c_d_e_f_g_h_i_j_k.pdf');
  });

  it('既存の .pdf 拡張子は重複させない', () => {
    expect(sanitizeDocumentFileName('report.pdf')).toBe('report.pdf');
  });

  it('.PDF（大文字）も拡張子とみなし重複させない', () => {
    expect(sanitizeDocumentFileName('REPORT.PDF')).toBe('REPORT.PDF');
  });

  it('拡張子が無ければ .pdf を付与する', () => {
    expect(sanitizeDocumentFileName('請求書')).toBe('請求書.pdf');
  });

  it('前後の空白をトリムする', () => {
    expect(sanitizeDocumentFileName('  doc  ')).toBe('doc.pdf');
  });

  it('空文字は document.pdf にフォールバックする', () => {
    expect(sanitizeDocumentFileName('')).toBe('document.pdf');
  });

  it('null / undefined は document.pdf にフォールバックする', () => {
    expect(sanitizeDocumentFileName(null)).toBe('document.pdf');
    expect(sanitizeDocumentFileName(undefined)).toBe('document.pdf');
  });

  it('不正文字のみの名前も _ 連結で .pdf 付与', () => {
    expect(sanitizeDocumentFileName(':::')).toBe('___.pdf');
  });
});
