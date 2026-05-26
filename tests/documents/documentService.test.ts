/**
 * documentService.renderTemplateHtml の単体テスト
 *
 * テンプレート文字列へのデータ埋め込み（プレースホルダ置換・HTMLエスケープ・
 * 既定値補完）を、ファイルI/O なしで検証する。
 */

// PDF 生成系はテスト不要なのでモック（ブラウザ起動・pdf-lib 読み込みを回避）
jest.mock('puppeteer', () => ({ launch: jest.fn() }));

import { renderTemplateHtml } from '../../src/documents/documentService';

describe('renderTemplateHtml', () => {
  describe('プレースホルダ置換', () => {
    it('{{ key }} をデータ値で置換する', () => {
      const html = renderTemplateHtml('<p>{{ name }}</p>', 'permit', { name: '山田太郎' });
      expect(html).toBe('<p>山田太郎</p>');
    });

    it('空白ありのプレースホルダ {{  key  }} も置換する', () => {
      const html = renderTemplateHtml('<p>{{  name  }}</p>', 'permit', { name: 'A' });
      expect(html).toBe('<p>A</p>');
    });

    it('同じプレースホルダが複数あっても全て置換する', () => {
      const html = renderTemplateHtml('{{ x }}-{{ x }}', 'permit', { x: 'Z' });
      expect(html).toBe('Z-Z');
    });

    it('未解決のプレースホルダは空文字に置換する', () => {
      const html = renderTemplateHtml('<p>{{ missing }}</p>', 'permit', {});
      expect(html).toBe('<p></p>');
    });

    it('ネストしたオブジェクトは . 連結キーで置換する', () => {
      const html = renderTemplateHtml('{{ a.b }}', 'permit', { a: { b: 'nested' } });
      expect(html).toBe('nested');
    });
  });

  describe('HTMLエスケープ（XSS対策）', () => {
    it('<script> をエスケープする', () => {
      const html = renderTemplateHtml('{{ v }}', 'permit', { v: '<script>alert(1)</script>' });
      expect(html).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    });

    it('& < > " \' をすべてエスケープする', () => {
      const html = renderTemplateHtml('{{ v }}', 'permit', { v: `&<>"'` });
      expect(html).toBe('&amp;&lt;&gt;&quot;&#039;');
    });

    it('置換値内の $& などの正規表現特殊文字をリテラル挿入する', () => {
      const html = renderTemplateHtml('{{ v }}', 'permit', { v: '$& $1 $`' });
      expect(html).toBe('$&amp; $1 $`');
    });
  });

  describe('textStyleBodyAttr (RAW_HTML_KEYS 素通し)', () => {
    it('preset=default では空文字', () => {
      const html = renderTemplateHtml('<body{{ textStyleBodyAttr }}>', 'permit', {
        textStylePreset: 'default',
      });
      expect(html).toBe('<body>');
    });

    it('preset 指定時は HTML 属性をエスケープせず挿入する', () => {
      const html = renderTemplateHtml('<body{{ textStyleBodyAttr }}>', 'permit', {
        textStylePreset: 'mincho',
      });
      expect(html).toBe('<body class="doc-preset-mincho">');
    });

    it('未知の preset は default 扱い', () => {
      const html = renderTemplateHtml('<body{{ textStyleBodyAttr }}>', 'permit', {
        textStylePreset: 'bogus',
      });
      expect(html).toBe('<body>');
    });
  });

  describe('payment-guide の既定値補完', () => {
    it('未入力フィールドに既定値を補完する', () => {
      const html = renderTemplateHtml('{{ option1 }}', 'payment-guide', {});
      expect(html).toContain('当霊園事務所へご持参下さい。');
    });

    it('入力があれば既定値で上書きしない', () => {
      const html = renderTemplateHtml('{{ option1 }}', 'payment-guide', { option1: '独自文言' });
      expect(html).toBe('独自文言');
    });
  });

  describe('invoice の金額整形・季節挨拶フォールバック', () => {
    it('amount を桁区切りした amountFormatted を生成する', () => {
      const html = renderTemplateHtml('{{ amountFormatted }}', 'invoice', {
        customerName: 'X',
        amount: 1234567,
      });
      expect(html).toBe('1,234,567');
    });

    it('amount が無く total があれば total を使う', () => {
      const html = renderTemplateHtml('{{ amountFormatted }}', 'invoice', {
        customerName: 'X',
        total: 5000,
      });
      expect(html).toBe('5,000');
    });

    it('金額が数値でなければ amountFormatted は空文字', () => {
      const html = renderTemplateHtml('{{ amountFormatted }}', 'invoice', {
        customerName: 'X',
        amount: 'abc',
      });
      expect(html).toBe('');
    });

    it('seasonGreeting 未指定なら非空のフォールバックが入る', () => {
      const html = renderTemplateHtml('{{ seasonGreeting }}', 'invoice', { customerName: 'X' });
      expect(html.length).toBeGreaterThan(0);
    });

    it('amountFormatted を明示指定すれば再計算しない', () => {
      const html = renderTemplateHtml('{{ amountFormatted }}', 'invoice', {
        customerName: 'X',
        amount: 100,
        amountFormatted: '指定済み',
      });
      expect(html).toBe('指定済み');
    });
  });
});
