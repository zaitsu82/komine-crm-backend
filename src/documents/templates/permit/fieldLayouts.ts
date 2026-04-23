/**
 * 許可証テンプレート（permit-base-*.pdf）に文字を印字するためのフィールド座標定義。
 *
 * 座標系:
 *   - x, y は PDF の points。原点は各ページの左下（pdf-lib と同じ）。
 *   - `direction`:
 *       'horizontal' : 通常の左→右の横書き
 *       'vertical'   : 1文字ずつ縦に積む縦書き（上から下）
 *       'rotated'    : 文字列を -90° 回転（横書きで書いたものを90度左回りに回転＝縦方向に読める）
 *   - align は 'horizontal' / 'rotated' 用: 'left' | 'center' | 'right'
 *   - vertical では anchor は常に top (y から下方向に文字が並ぶ)
 *
 * フロントのプレビューは permit-page-{N}.png を背景にして、同じ座標系を用いて
 * 入力ボックスを重ねる。PDF を 120dpi で PNG 化しているので、ピクセル換算係数は
 * 120/72 = 5/3 ≒ 1.6667。
 */

export type FieldDirection = 'horizontal' | 'vertical' | 'rotated';
export type FieldAlign = 'left' | 'center' | 'right';

export interface PermitField {
  /** テンプレートデータのキー */
  id: string;
  /** UI 表示ラベル */
  label: string;
  /** プレースホルダー・サンプル値 */
  placeholder?: string;
  /** 0 始まりページインデックス（ベースPDF配列のどれに書くか） */
  pageIndex: number;
  /** x 座標 (pt, 左下原点) */
  x: number;
  /** y 座標 (pt, 左下原点)。direction=vertical の場合は 1 文字目の上端 y */
  y: number;
  /** フォントサイズ (pt) */
  fontSize: number;
  /** 太字にするか */
  bold?: boolean;
  direction: FieldDirection;
  /** horizontal / rotated 時の揃え */
  align?: FieldAlign;
  /** vertical 時の行間（文字送り）。未指定ならフォントサイズ * 1.3 */
  lineHeight?: number;
  /** プレビュー表示時の枠幅(pt)。入力欄の大きさ目安 */
  widthPt?: number;
  /** プレビュー表示時の枠高さ(pt)。vertical なら縦方向 */
  heightPt?: number;
  /** 任意：複数行にまたがる補助ライン数（UI表示用） */
  hint?: string;
}

export interface PermitPage {
  pageIndex: number;
  /** ベース PDF ファイル名 (templates/permit/ からの相対) */
  baseFile: string;
  /** プレビュー PNG のパス（/public 以下） */
  previewPng: string;
  /** PDF のページサイズ (pt) */
  widthPt: number;
  heightPt: number;
  /** プレビュー PNG のサイズ (px) */
  previewWidthPx: number;
  previewHeightPx: number;
  /** このページに書き込むフィールド */
  fields: PermitField[];
  /** UI 表示上の名称 */
  label: string;
  /** このページを生成に含めるか（false なら素通し） */
  enabled: boolean;
}

// ====== ページ定義 ======
// ※ 座標は実機の手書き実物をもとに概ねの位置を仮置きしています。
//   微調整が必要な場合はこのファイルの値をチューニングしてください。

// ページ1: メインの許可証（横向き: 728.4 x 515.76 pt, 横書き）
// 座標は PDF 左下原点。値は各下線の真上に配置する。
const PAGE_1_FIELDS: PermitField[] = [
  {
    id: 'permitNumber',
    label: '許可番号（第○号）',
    placeholder: '12345',
    pageIndex: 0,
    x: 530,
    y: 340,
    fontSize: 14,
    bold: true,
    direction: 'horizontal',
    align: 'left',
    widthPt: 85,
    heightPt: 18,
  },
  {
    id: 'permitType',
    label: '種別',
    placeholder: '普通墓地',
    pageIndex: 0,
    x: 520,
    y: 295,
    fontSize: 13,
    direction: 'horizontal',
    align: 'left',
    widthPt: 95,
    heightPt: 18,
  },
  {
    id: 'plotNumber',
    label: '区画番号',
    placeholder: 'A-56',
    pageIndex: 0,
    x: 530,
    y: 248,
    fontSize: 13,
    direction: 'horizontal',
    align: 'left',
    widthPt: 85,
    heightPt: 18,
  },
  {
    id: 'area',
    label: '面積（㎡）',
    placeholder: '4.5',
    pageIndex: 0,
    x: 525,
    y: 198,
    fontSize: 13,
    direction: 'horizontal',
    align: 'left',
    widthPt: 95,
    heightPt: 18,
  },
  {
    id: 'issueYear',
    label: '発行 年',
    placeholder: '2026',
    pageIndex: 0,
    x: 450,
    y: 155,
    fontSize: 12,
    direction: 'horizontal',
    align: 'center',
    widthPt: 50,
    heightPt: 16,
  },
  {
    id: 'issueMonth',
    label: '発行 月',
    placeholder: '4',
    pageIndex: 0,
    x: 530,
    y: 155,
    fontSize: 12,
    direction: 'horizontal',
    align: 'center',
    widthPt: 30,
    heightPt: 16,
  },
  {
    id: 'issueDay',
    label: '発行 日',
    placeholder: '23',
    pageIndex: 0,
    x: 590,
    y: 155,
    fontSize: 12,
    direction: 'horizontal',
    align: 'center',
    widthPt: 30,
    heightPt: 16,
  },
  {
    id: 'applicantName',
    label: '使用者名（殿）',
    placeholder: '丸山 千代美',
    pageIndex: 0,
    x: 180,
    y: 345,
    fontSize: 16,
    bold: true,
    direction: 'horizontal',
    align: 'left',
    widthPt: 180,
    heightPt: 22,
  },
  {
    id: 'registeredAddress',
    label: '本籍',
    placeholder: '福岡県北九州市八幡西区小嶺',
    pageIndex: 0,
    x: 140,
    y: 298,
    fontSize: 12,
    direction: 'horizontal',
    align: 'left',
    widthPt: 230,
    heightPt: 18,
  },
  {
    id: 'currentAddress',
    label: '現住所',
    placeholder: '福岡県北九州市八幡西区…',
    pageIndex: 0,
    x: 140,
    y: 248,
    fontSize: 12,
    direction: 'horizontal',
    align: 'left',
    widthPt: 230,
    heightPt: 18,
  },
];

// ページ2: 封筒表（郵便番号・宛先用）
const PAGE_2_FIELDS: PermitField[] = [
  {
    id: 'recipientPostalCode',
    label: '郵便番号',
    placeholder: '807-0081',
    pageIndex: 1,
    x: 230,
    y: 605,
    fontSize: 18,
    direction: 'horizontal',
    align: 'left',
    widthPt: 180,
    heightPt: 24,
  },
  {
    id: 'recipientAddress',
    label: '宛先住所',
    placeholder: '福岡県北九州市八幡西区…',
    pageIndex: 1,
    x: 130,
    y: 480,
    fontSize: 16,
    direction: 'horizontal',
    align: 'left',
    widthPt: 300,
    heightPt: 24,
  },
  {
    id: 'recipientAddress2',
    label: '宛先住所（2行目）',
    placeholder: '',
    pageIndex: 1,
    x: 150,
    y: 445,
    fontSize: 16,
    direction: 'horizontal',
    align: 'left',
    widthPt: 280,
    heightPt: 24,
  },
  {
    id: 'recipientName',
    label: '宛名',
    placeholder: '丸山 千代美 様',
    pageIndex: 1,
    x: 150,
    y: 380,
    fontSize: 22,
    bold: true,
    direction: 'horizontal',
    align: 'left',
    widthPt: 280,
    heightPt: 30,
  },
];

// ページ4: 大型封筒の表（郵便番号あり）
const PAGE_4_FIELDS: PermitField[] = [
  {
    id: 'recipientPostalCode',
    label: '郵便番号',
    placeholder: '807-0081',
    pageIndex: 3,
    x: 530,
    y: 950,
    fontSize: 20,
    direction: 'horizontal',
    align: 'left',
    widthPt: 180,
    heightPt: 26,
  },
  {
    id: 'recipientAddress',
    label: '宛先住所',
    placeholder: '福岡県北九州市八幡西区…',
    pageIndex: 3,
    x: 120,
    y: 820,
    fontSize: 18,
    direction: 'horizontal',
    align: 'left',
    widthPt: 500,
    heightPt: 28,
  },
  {
    id: 'recipientAddress2',
    label: '宛先住所（2行目）',
    placeholder: '',
    pageIndex: 3,
    x: 140,
    y: 780,
    fontSize: 18,
    direction: 'horizontal',
    align: 'left',
    widthPt: 480,
    heightPt: 28,
  },
  {
    id: 'recipientName',
    label: '宛名',
    placeholder: '丸山 千代美 様',
    pageIndex: 3,
    x: 180,
    y: 700,
    fontSize: 26,
    bold: true,
    direction: 'horizontal',
    align: 'left',
    widthPt: 460,
    heightPt: 36,
  },
];

export const PERMIT_PAGES: PermitPage[] = [
  {
    pageIndex: 0,
    label: '許可証書（1枚目・横向き）',
    baseFile: 'permit-base-1.pdf',
    previewPng: '/permit-templates/permit-page-1.png',
    widthPt: 728.4,
    heightPt: 515.76,
    previewWidthPx: 1214,
    previewHeightPx: 860,
    fields: PAGE_1_FIELDS,
    enabled: true,
  },
  {
    pageIndex: 1,
    label: '封筒表（2枚目）',
    baseFile: 'permit-base-2.pdf',
    previewPng: '/permit-templates/permit-page-2.png',
    widthPt: 515.76,
    heightPt: 728.4,
    previewWidthPx: 860,
    previewHeightPx: 1214,
    fields: PAGE_2_FIELDS,
    enabled: true,
  },
  {
    pageIndex: 2,
    label: '封筒裏（3枚目）',
    baseFile: 'permit-base-3.pdf',
    previewPng: '/permit-templates/permit-page-3.png',
    widthPt: 515.76,
    heightPt: 728.4,
    previewWidthPx: 860,
    previewHeightPx: 1214,
    fields: [],
    enabled: true,
  },
  {
    pageIndex: 3,
    label: '大型封筒表（4枚目）',
    baseFile: 'permit-base-4.pdf',
    previewPng: '/permit-templates/permit-page-4.png',
    widthPt: 728.4,
    heightPt: 1031.76,
    previewWidthPx: 1214,
    previewHeightPx: 1720,
    fields: PAGE_4_FIELDS,
    enabled: true,
  },
  {
    pageIndex: 4,
    label: '大型封筒裏（5枚目）',
    baseFile: 'permit-base-5.pdf',
    previewPng: '/permit-templates/permit-page-5.png',
    widthPt: 1031.76,
    heightPt: 728.4,
    previewWidthPx: 1720,
    previewHeightPx: 1214,
    fields: [],
    enabled: true,
  },
];

/**
 * テンプレートデータに格納するフィールド型。
 * フロント・バックで共有。
 */
export interface PermitTemplateData {
  permitNumber?: string;
  permitType?: string;
  plotNumber?: string;
  area?: string;
  /** 西暦年 */
  issueYear?: string;
  issueMonth?: string;
  issueDay?: string;
  applicantName?: string;
  registeredAddress?: string;
  currentAddress?: string;
  /** 封筒の宛名・住所。許可証と同じ値を使う場合はフロントで自動同期 */
  recipientPostalCode?: string;
  recipientAddress?: string;
  recipientAddress2?: string;
  recipientName?: string;
  /** 任意：UI操作用の自由メモなど */
  notes?: string;
}
