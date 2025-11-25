// 区画情報一覧用インターフェース
export interface PlotListItem {
  id: string; // 区画ID
  plotNumber: string; // 区画番号 例: A-56
  contractorName: string | null; // 契約者氏名
  contractorAddress: string | null; // 契約者住所
  applicantName: string | null; // 申込者氏名
  buriedPersonCount: number; // 埋葬者数
  contractorPhoneNumber: string | null; // 契約者電話番号
  nextBillingDate: Date | null; // 次回請求日
  notes: string | null; // 備考/注意
}

// 区画情報登録リクエスト
export interface CreatePlotInput {
  // 区画基本情報（必須）
  plot: {
    plotNumber: string; // 区画番号 *必須
    section: string; // 区域 *必須
    usage: 'in_use' | 'available' | 'reserved'; // 利用状況 *必須
    size: string; // 面積 *必須
    price: string; // 金額 *必須
    contractDate?: Date | string | null; // 契約日（任意）
    status?: 'active' | 'inactive'; // ステータス（デフォルト: active）
    notes?: string | null; // 備考
  };

  // 申込者情報（任意）
  applicant?: {
    applicationDate?: Date | string | null;
    staffName: string;
    name: string;
    nameKana: string;
    postalCode: string;
    phoneNumber: string;
    address: string;
  };

  // 契約者情報（任意）
  contractor?: {
    reservationDate?: Date | string | null;
    acceptanceNumber?: string;
    permitDate?: Date | string | null;
    startDate?: Date | string | null;
    name: string;
    nameKana: string;
    birthDate?: Date | string | null;
    gender?: 'male' | 'female';
    phoneNumber: string;
    faxNumber?: string;
    email?: string;
    address: string;
    registeredAddress?: string;
  };

  // 使用料（任意）
  usageFee?: {
    calculationType: string;
    taxType: string;
    billingType: string;
    billingYears: string;
    area: string;
    unitPrice: string;
    usageFee: string;
    paymentMethod: string;
  };

  // 管理料（任意）
  managementFee?: {
    calculationType: string;
    taxType: string;
    billingType: string;
    billingYears: string;
    area: string;
    billingMonth: string;
    managementFee: string;
    unitPrice: string;
    lastBillingMonth: string;
    paymentMethod: string;
  };

  // 墓石情報（任意）
  gravestoneInfo?: {
    gravestoneBase: string;
    enclosurePosition: string;
    gravestoneDealer: string;
    gravestoneType: string;
    surroundingArea: string;
    establishmentDeadline?: Date | string | null;
    establishmentDate?: Date | string | null;
  };

  // 工事情報（任意）
  constructionInfo?: {
    // 工事進捗状況
    constructionType?: string; // 工事区分 例: 新設工事、改修工事
    startDate?: Date | string | null; // 着工予定日
    completionDate?: Date | string | null; // 完工予定日
    contractor?: string; // 工事業者名
    supervisor?: string; // 工事担当者名
    progress?: string; // 進捗状況 例: 基礎工事完了、進行中

    // 工事詳細（複数の工事項目に対応）
    workItem1?: string; // 工事項目1 例: 基礎工事
    workDate1?: Date | string | null; // 実施日1
    workAmount1?: number; // 金額1
    workStatus1?: string; // 状況1 例: 完了、進行中、予定
    workItem2?: string; // 工事項目2 例: 墓石設置
    workDate2?: Date | string | null; // 予定日2
    workAmount2?: number; // 金額2
    workStatus2?: string; // 状況2

    // 許可・申請状況
    permitNumber?: string; // 工事許可番号 例: 北九-工-2024-0156
    applicationDate?: Date | string | null; // 申請日
    permitDate?: Date | string | null; // 許可日
    permitStatus?: string; // 許可状況 例: 許可済み、申請中、未申請

    // 工事代金支払状況
    paymentType1?: string; // 支払区分1 例: 着手金、中間金
    paymentAmount1?: number; // 金額1
    paymentDate1?: Date | string | null; // 支払日1
    paymentStatus1?: string; // 状況1 例: 支払済み、未払い
    paymentType2?: string; // 支払区分2 例: 完工時、残金
    paymentAmount2?: number; // 金額2
    paymentScheduledDate2?: Date | string | null; // 支払予定日2
    paymentStatus2?: string; // 状況2

    // 工事備考
    constructionNotes?: string; // 工事備考 例: 使用石材の詳細、特記事項等
  };

  // 家族連絡先（複数・任意）
  familyContacts?: Array<{
    name: string;
    birthDate?: Date | string | null;
    relationship: string;
    address: string;
    phoneNumber: string;
    faxNumber?: string;
    email?: string;
    registeredAddress?: string;
    mailingType?: 'home' | 'work' | 'other';
    companyName?: string;
    companyNameKana?: string;
    companyAddress?: string;
    companyPhone?: string;
    notes?: string;
  }>;

  // 緊急連絡先（任意）
  emergencyContact?: {
    name: string;
    relationship: string;
    phoneNumber: string;
  };

  // 埋葬者一覧（複数・任意）
  buriedPersons?: Array<{
    name: string;
    nameKana?: string;
    relationship?: string;
    deathDate?: Date | string | null;
    age?: number;
    gender?: 'male' | 'female';
    burialDate?: Date | string | null;
    memo?: string;
  }>;

  // 勤務先・連絡情報（任意、契約者情報がある場合のみ）
  workInfo?: {
    companyName: string;
    companyNameKana: string;
    workAddress: string;
    workPostalCode: string;
    workPhoneNumber: string;
    dmSetting: 'allow' | 'deny' | 'limited';
    addressType: 'home' | 'work' | 'other';
    notes?: string;
  };

  // 請求情報（任意、契約者情報がある場合のみ）
  billingInfo?: {
    billingType: 'individual' | 'corporate' | 'bank_transfer';
    bankName: string;
    branchName: string;
    accountType: 'ordinary' | 'current' | 'savings';
    accountNumber: string;
    accountHolder: string;
  };

  // 合祀情報（任意）
  collectiveBurial?: {
    burialCapacity: number; // 埋葬上限人数 *必須
    validityPeriodYears: number; // 有効期間（年単位） *必須
    billingAmount?: number; // 請求金額
    notes?: string; // 備考
  };
}

// 区画情報インターフェース
export interface plotInfo {
  // 区画基本情報
  id: string; // 区画ID
  plotNumber: string; // 区画番号 例: A-56 *必須
  section: string; // 区域 (東区、西区など) *必須
  usage: 'in_use' | 'available' | 'reserved'; // 利用状況
  size: string; // 面積
  price: string; // 金額
  contractDate: Date | null; // 契約日

  // 申込者情報
  applicantInfo?: {
    id: string; // 申込者情報ID
    applicationDate: Date | null; // 申込日
    staffName: string; // 担当者氏名
    name: string; // 氏名
    nameKana: string; // 振り仮名（ひらがな）
    postalCode: string; // 郵便番号 例: 123-4567
    phoneNumber: string; // 電話番号 例: 090-1234-5678
    address: string; // 住所
  };

  // 契約者情報
  contractInfo?: {
    id: string; // 契約者情報ID
    reservationDate: Date | null; // 予約日
    acceptanceNumber?: string; // 承諾書番号
    permitDate: Date | null; // 許可日
    startDate: Date | null; // 開始年月日
    name: string; // 氏名 *必須
    nameKana: string; // 振り仮名（ひらがな） *必須
    birthDate: Date | null; // 生年月日
    gender: 'male' | 'female' | undefined; // 性別 *必須
    phoneNumber: string; // 電話番号 *必須 例: 090-1234-5678
    faxNumber?: string; // ファックス 例: 03-1234-5678
    email?: string; // メール 例: example@email.com
    address: string; // 住所 *必須
    registeredAddress?: string; // 本籍地住所
  };

  // 使用料
  usageFee?: {
    id: string; // 使用料ID
    calculationType: string; // 計算区分 (セレクトボックス)
    taxType: string; // 税区分 (セレクトボックス)
    billingType: string; // 請求区分 (セレクトボックス)
    billingYears: string; // 請求年数
    area: string; // 面積 例: 10㎡
    unitPrice: string; // 単価 例: 10000
    usageFee: string; // 使用料 例: 200000
    paymentMethod: string; // 支払い方法 (セレクトボックス)
  };

  // 管理料
  managementFee?: {
    id: string; // 管理料ID
    calculationType: string; // 計算区分 (セレクトボックス)
    taxType: string; // 税区分 (セレクトボックス)
    billingType: string; // 請求区分 (セレクトボックス)
    billingYears: string; // 請求年数
    area: string; // 面積 例: 10㎡
    billingMonth: string; // 請求月 (1-12)
    managementFee: string; // 管理料 例: 5000
    unitPrice: string; // 単価 例: 500
    lastBillingMonth: string; // 最終請求月 ----年--月
    paymentMethod: string; // 支払方法 (セレクトボックス)
  };

  // 墓石情報
  gravestoneInfo?: {
    id: string; // 墓石情報ID
    gravestoneBase: string; // 墓石台
    enclosurePosition: string; // 包囲位置
    gravestoneDealer: string; // 墓石取扱い
    gravestoneType: string; // 墓石タイプ
    surroundingArea: string; // 周辺設備
    establishmentDeadline: Date | null; // 設立期限
    establishmentDate: Date | null; // 設立日
  };

  // 工事情報
  constructionInfo?: {
    id: string; // 工事情報ID
    // 工事進捗状況
    constructionType?: string; // 工事区分 例: 新設工事、改修工事
    startDate?: Date | null; // 着工予定日
    completionDate?: Date | null; // 完工予定日
    contractor?: string; // 工事業者名
    supervisor?: string; // 工事担当者名
    progress?: string; // 進捗状況 例: 基礎工事完了、進行中

    // 工事詳細（複数の工事項目に対応）
    workItem1?: string; // 工事項目1 例: 基礎工事
    workDate1?: Date | null; // 実施日1
    workAmount1?: number; // 金額1
    workStatus1?: string; // 状況1 例: 完了、進行中、予定
    workItem2?: string; // 工事項目2 例: 墓石設置
    workDate2?: Date | null; // 予定日2
    workAmount2?: number; // 金額2
    workStatus2?: string; // 状況2

    // 許可・申請状況
    permitNumber?: string; // 工事許可番号 例: 北九-工-2024-0156
    applicationDate?: Date | null; // 申請日
    permitDate?: Date | null; // 許可日
    permitStatus?: string; // 許可状況 例: 許可済み、申請中、未申請

    // 工事代金支払状況
    paymentType1?: string; // 支払区分1 例: 着手金、中間金
    paymentAmount1?: number; // 金額1
    paymentDate1?: Date | null; // 支払日1
    paymentStatus1?: string; // 状況1 例: 支払済み、未払い
    paymentType2?: string; // 支払区分2 例: 完工時、残金
    paymentAmount2?: number; // 金額2
    paymentScheduledDate2?: Date | null; // 支払予定日2
    paymentStatus2?: string; // 状況2

    // 工事備考
    constructionNotes?: string; // 工事備考 例: 使用石材の詳細、特記事項等
  };

  // 家族・連絡先（複数対応）
  familyContacts?: {
    id: string;
    name: string; // 氏名
    birthDate: Date | null; // 生年月日
    relationship: string; // 続柄
    address: string; // 住所
    phoneNumber: string; // 電話番号
    faxNumber?: string; // ファックス
    email?: string; // イーメール
    registeredAddress?: string; // 本籍住所
    mailingType: 'home' | 'work' | 'other' | undefined; // 送付先区分（初期状態は未選択）
    companyName?: string; // 勤務先名称
    companyNameKana?: string; // 勤務先かな
    companyAddress?: string; // 勤務先住所
    companyPhone?: string; // 勤務先電話番号
    notes?: string; // 備考
  }[];

  // 緊急連絡先
  emergencyContact?: {
    id: string;
    name: string;
    relationship: string;
    phoneNumber: string;
  } | null;

  // 埋葬者一覧（複数対応）
  buriedPersons?: {
    id: string; // 埋葬者ID
    name: string; // 氏名
    nameKana?: string; // 氏名カナ
    relationship?: string; // 続柄
    deathDate?: Date | null; // 死亡日
    age?: number; // 年齢
    gender: 'male' | 'female' | undefined; // 性別（初期状態は未選択）
    burialDate?: Date | null; // 埋葬日（後方互換性のため残す）
    memo?: string; // メモ（後方互換性のため残す）
  }[];

  // 勤務先・連絡情報
  workInfo?: {
    id: string; //勤務先・連絡先情報ID
    companyName: string; // 勤務先名称
    companyNameKana: string; // 勤務先仮名
    workAddress: string; // 就職先住所
    workPostalCode: string; // 郵便番号
    workPhoneNumber: string; // 電話番号
    dmSetting: 'allow' | 'deny' | 'limited'; // DM設定
    addressType: 'home' | 'work' | 'other'; // 宛先区分
    notes: string; // 備考
  };

  // 請求情報
  billingInfo?: {
    id: string; // 請求情報ID
    billingType: 'individual' | 'corporate' | 'bank_transfer'; // 請求種別
    bankName: string; // 銀行名称
    branchName: string; // 支店名称
    accountType: 'ordinary' | 'current' | 'savings'; // 口座科目
    accountNumber: string; // 記号番号
    accountHolder: string; // 口座名義
  };

  // 合祀情報
  collectiveBurial?: {
    id: string;
    burialCapacity: number; // 埋葬上限人数
    currentBurialCount: number; // 現在埋葬人数
    capacityReachedDate: Date | null; // 上限到達日
    validityPeriodYears: number; // 有効期間（年単位）
    billingScheduledDate: Date | null; // 請求予定日
    billingStatus: 'pending' | 'billed' | 'paid'; // 請求状況
    billingAmount: number | null; // 請求金額
    notes: string | null; // 備考
  };

  // システム情報
  createdAt: Date;
  updatedAt: Date;
  status: 'active' | 'inactive'; // 契約ステータス
}

// 区画情報更新リクエスト（部分更新対応）
export interface UpdatePlotInput {
  // 変更理由（履歴記録用・任意）
  changeReason?: string;

  // 区画基本情報（部分更新）
  plot?: {
    plotNumber?: string; // 区画番号
    section?: string; // 区域
    usage?: 'in_use' | 'available' | 'reserved'; // 利用状況
    size?: string; // 面積
    price?: string; // 金額
    contractDate?: Date | string | null; // 契約日
    status?: 'active' | 'inactive'; // ステータス
    notes?: string | null; // 備考
  };

  // 申込者情報（upsert: 存在すれば更新、なければ作成）
  applicant?: {
    applicationDate?: Date | string | null;
    staffName?: string;
    name?: string;
    nameKana?: string;
    postalCode?: string;
    phoneNumber?: string;
    address?: string;
  } | null; // null指定で削除

  // 契約者情報（最新の契約者のみ更新）
  contractor?: {
    reservationDate?: Date | string | null;
    acceptanceNumber?: string;
    permitDate?: Date | string | null;
    startDate?: Date | string | null;
    name?: string;
    nameKana?: string;
    birthDate?: Date | string | null;
    gender?: 'male' | 'female';
    phoneNumber?: string;
    faxNumber?: string;
    email?: string;
    address?: string;
    registeredAddress?: string;
  };

  // 使用料（upsert）
  usageFee?: {
    calculationType?: string;
    taxType?: string;
    billingType?: string;
    billingYears?: string;
    area?: string;
    unitPrice?: string;
    usageFee?: string;
    paymentMethod?: string;
  } | null;

  // 管理料（upsert）
  managementFee?: {
    calculationType?: string;
    taxType?: string;
    billingType?: string;
    billingYears?: string;
    area?: string;
    billingMonth?: string;
    managementFee?: string;
    unitPrice?: string;
    lastBillingMonth?: string;
    paymentMethod?: string;
  } | null;

  // 墓石情報（upsert）
  gravestoneInfo?: {
    gravestoneBase?: string;
    enclosurePosition?: string;
    gravestoneDealer?: string;
    gravestoneType?: string;
    surroundingArea?: string;
    establishmentDeadline?: Date | string | null;
    establishmentDate?: Date | string | null;
  } | null;

  // 工事情報（upsert）
  constructionInfo?: {
    // 工事進捗状況
    constructionType?: string; // 工事区分 例: 新設工事、改修工事
    startDate?: Date | string | null; // 着工予定日
    completionDate?: Date | string | null; // 完工予定日
    contractor?: string; // 工事業者名
    supervisor?: string; // 工事担当者名
    progress?: string; // 進捗状況 例: 基礎工事完了、進行中

    // 工事詳細（複数の工事項目に対応）
    workItem1?: string; // 工事項目1 例: 基礎工事
    workDate1?: Date | string | null; // 実施日1
    workAmount1?: number; // 金額1
    workStatus1?: string; // 状況1 例: 完了、進行中、予定
    workItem2?: string; // 工事項目2 例: 墓石設置
    workDate2?: Date | string | null; // 予定日2
    workAmount2?: number; // 金額2
    workStatus2?: string; // 状況2

    // 許可・申請状況
    permitNumber?: string; // 工事許可番号 例: 北九-工-2024-0156
    applicationDate?: Date | string | null; // 申請日
    permitDate?: Date | string | null; // 許可日
    permitStatus?: string; // 許可状況 例: 許可済み、申請中、未申請

    // 工事代金支払状況
    paymentType1?: string; // 支払区分1 例: 着手金、中間金
    paymentAmount1?: number; // 金額1
    paymentDate1?: Date | string | null; // 支払日1
    paymentStatus1?: string; // 状況1 例: 支払済み、未払い
    paymentType2?: string; // 支払区分2 例: 完工時、残金
    paymentAmount2?: number; // 金額2
    paymentScheduledDate2?: Date | string | null; // 支払予定日2
    paymentStatus2?: string; // 状況2

    // 工事備考
    constructionNotes?: string; // 工事備考 例: 使用石材の詳細、特記事項等
  } | null;

  // 家族連絡先（差分更新：idあり=更新、idなし=作成）
  familyContacts?: Array<{
    id?: string; // IDがあれば既存データ更新
    name?: string;
    birthDate?: Date | string | null;
    relationship?: string;
    address?: string;
    phoneNumber?: string;
    faxNumber?: string;
    email?: string;
    registeredAddress?: string;
    mailingType?: 'home' | 'work' | 'other';
    companyName?: string;
    companyNameKana?: string;
    companyAddress?: string;
    companyPhone?: string;
    notes?: string;
    _delete?: boolean; // 削除フラグ
  }>;

  // 緊急連絡先（upsert）
  emergencyContact?: {
    name?: string;
    relationship?: string;
    phoneNumber?: string;
  } | null;

  // 埋葬者一覧（差分更新）
  buriedPersons?: Array<{
    id?: string; // IDがあれば既存データ更新
    name?: string;
    nameKana?: string;
    relationship?: string;
    deathDate?: Date | string | null;
    age?: number;
    gender?: 'male' | 'female';
    burialDate?: Date | string | null;
    memo?: string;
    _delete?: boolean; // 削除フラグ
  }>;

  // 勤務先・連絡情報（upsert、契約者に依存）
  workInfo?: {
    companyName?: string;
    companyNameKana?: string;
    workAddress?: string;
    workPostalCode?: string;
    workPhoneNumber?: string;
    dmSetting?: 'allow' | 'deny' | 'limited';
    addressType?: 'home' | 'work' | 'other';
    notes?: string;
  } | null;

  // 請求情報（upsert、契約者に依存）
  billingInfo?: {
    billingType?: 'individual' | 'corporate' | 'bank_transfer';
    bankName?: string;
    branchName?: string;
    accountType?: 'ordinary' | 'current' | 'savings';
    accountNumber?: string;
    accountHolder?: string;
  } | null;

  // 合祀情報（upsert）
  collectiveBurial?: {
    burialCapacity?: number; // 埋葬上限人数
    validityPeriodYears?: number; // 有効期間（年単位）
    billingAmount?: number; // 請求金額
    notes?: string; // 備考
  } | null;
}

// 合祀情報（複数の故人を一つの区画に祀る管理）
export interface CollectiveBurialInfo {
  id: string; // 合祀情報ID
  plotId: string; // 区画ID（旧: Plot、新: PhysicalPlot）
  burialCapacity: number; // 埋葬上限人数
  currentBurialCount: number; // 現在埋葬人数（BuriedPersonsから自動集計）
  capacityReachedDate: Date | null; // 上限到達日
  validityPeriodYears: number; // 有効期間（年単位）
  billingScheduledDate: Date | null; // 請求予定日（上限到達日 + 有効期間）
  billingStatus: 'pending' | 'billed' | 'paid'; // 請求状況
  billingAmount: number | null; // 請求金額
  notes: string | null; // 備考
  createdAt: Date; // 作成日時
  updatedAt: Date; // 更新日時
}

// =============================================================================
// 新しい区画管理システムの型定義
// =============================================================================

// -----------------------------------------------------------------------------
// 1. PhysicalPlot（物理区画マスタ）
// -----------------------------------------------------------------------------

export interface PhysicalPlotInfo {
  id: string; // 物理区画ID
  plotNumber: string; // 区画番号（例: A-56）
  areaName: string; // 区域名（例: 第一区域、芝生区画）
  areaSqm: number; // 区画の総面積（基本3.6㎡）
  status: 'available' | 'partially_sold' | 'sold_out'; // 販売状況
  notes: string | null; // 備考
  createdAt: Date; // 作成日時
  updatedAt: Date; // 更新日時
  deletedAt: Date | null; // 削除日時
}

export interface CreatePhysicalPlotInput {
  plotNumber: string; // 区画番号 *必須
  areaName: string; // 区域名 *必須
  areaSqm?: number; // 区画面積（デフォルト: 3.6）
  status?: 'available' | 'partially_sold' | 'sold_out'; // 販売状況（デフォルト: available）
  notes?: string | null; // 備考
}

export interface UpdatePhysicalPlotInput {
  plotNumber?: string; // 区画番号
  areaName?: string; // 区域名
  areaSqm?: number; // 区画面積
  status?: 'available' | 'partially_sold' | 'sold_out'; // 販売状況
  notes?: string | null; // 備考
}

// -----------------------------------------------------------------------------
// 2. ContractPlot（契約区画）
// -----------------------------------------------------------------------------

export interface ContractPlotInfo {
  id: string; // 契約区画ID
  physicalPlotId: string; // 物理区画ID
  contractAreaSqm: number; // 契約された面積（例: 3.6, 1.8, 0.9）
  saleStatus: 'available' | 'reserved' | 'contracted'; // 販売状態
  locationDescription: string | null; // 物理区画内のどの位置か
  createdAt: Date; // 作成日時
  updatedAt: Date; // 更新日時
  deletedAt: Date | null; // 削除日時
}

export interface CreateContractPlotInput {
  physicalPlotId: string; // 物理区画ID *必須
  contractAreaSqm: number; // 契約面積 *必須
  saleStatus?: 'available' | 'reserved' | 'contracted'; // 販売状態（デフォルト: available）
  locationDescription?: string | null; // 位置説明
}

export interface UpdateContractPlotInput {
  contractAreaSqm?: number; // 契約面積
  saleStatus?: 'available' | 'reserved' | 'contracted'; // 販売状態
  locationDescription?: string | null; // 位置説明
}

// -----------------------------------------------------------------------------
// 3. SaleContract（販売契約）
// -----------------------------------------------------------------------------

export interface SaleContractInfo {
  id: string; // 販売契約ID
  contractPlotId: string; // 契約区画ID
  customerId: string; // 顧客ID
  customerRole: 'applicant' | 'contractor' | 'heir'; // 顧客の役割
  contractDate: Date; // 契約日
  price: number; // 販売価格
  paymentStatus: 'unpaid' | 'partial' | 'paid'; // 支払い状況
  reservationDate: Date | null; // 予約日
  acceptanceNumber: string | null; // 受付番号
  permitDate: Date | null; // 許可日
  startDate: Date | null; // 開始日
  notes: string | null; // 契約に関する備考
  createdAt: Date; // 作成日時
  updatedAt: Date; // 更新日時
  deletedAt: Date | null; // 削除日時
}

export interface CreateSaleContractInput {
  contractPlotId: string; // 契約区画ID *必須
  customerId: string; // 顧客ID *必須
  customerRole: 'applicant' | 'contractor' | 'heir'; // 顧客の役割 *必須
  contractDate: Date | string; // 契約日 *必須
  price: number; // 販売価格 *必須
  paymentStatus?: 'unpaid' | 'partial' | 'paid'; // 支払い状況（デフォルト: unpaid）
  reservationDate?: Date | string | null; // 予約日
  acceptanceNumber?: string | null; // 受付番号
  permitDate?: Date | string | null; // 許可日
  startDate?: Date | string | null; // 開始日
  notes?: string | null; // 備考
}

export interface UpdateSaleContractInput {
  customerId?: string; // 顧客ID
  customerRole?: 'applicant' | 'contractor' | 'heir'; // 顧客の役割
  contractDate?: Date | string; // 契約日
  price?: number; // 販売価格
  paymentStatus?: 'unpaid' | 'partial' | 'paid'; // 支払い状況
  reservationDate?: Date | string | null; // 予約日
  acceptanceNumber?: string | null; // 受付番号
  permitDate?: Date | string | null; // 許可日
  startDate?: Date | string | null; // 開始日
  notes?: string | null; // 備考
}

// -----------------------------------------------------------------------------
// 4. Customer（顧客マスタ）
// -----------------------------------------------------------------------------

export interface CustomerInfo {
  id: string; // 顧客ID
  name: string; // 氏名
  nameKana: string; // 氏名カナ
  birthDate: Date | null; // 生年月日
  gender: string | null; // 性別
  postalCode: string; // 郵便番号
  address: string; // 住所
  registeredAddress: string | null; // 本籍地
  phoneNumber: string; // 電話番号
  faxNumber: string | null; // FAX番号
  email: string | null; // メールアドレス
  notes: string | null; // 備考
  createdAt: Date; // 作成日時
  updatedAt: Date; // 更新日時
  deletedAt: Date | null; // 削除日時
}

export interface CreateCustomerInput {
  name: string; // 氏名 *必須
  nameKana: string; // 氏名カナ *必須
  birthDate?: Date | string | null; // 生年月日
  gender?: string | null; // 性別
  postalCode: string; // 郵便番号 *必須
  address: string; // 住所 *必須
  registeredAddress?: string | null; // 本籍地
  phoneNumber: string; // 電話番号 *必須
  faxNumber?: string | null; // FAX番号
  email?: string | null; // メールアドレス
  notes?: string | null; // 備考
}

export interface UpdateCustomerInput {
  name?: string; // 氏名
  nameKana?: string; // 氏名カナ
  birthDate?: Date | string | null; // 生年月日
  gender?: string | null; // 性別
  postalCode?: string; // 郵便番号
  address?: string; // 住所
  registeredAddress?: string | null; // 本籍地
  phoneNumber?: string; // 電話番号
  faxNumber?: string | null; // FAX番号
  email?: string | null; // メールアドレス
  notes?: string | null; // 備考
}

// -----------------------------------------------------------------------------
// 5. UsageFee（使用料） - ContractPlotに紐づけ
// -----------------------------------------------------------------------------

export interface UsageFeeInfo {
  id: string; // 使用料ID
  contractPlotId: string; // 契約区画ID
  calculationType: string; // 計算方式
  taxType: string; // 税区分
  billingType: string; // 請求区分
  billingYears: string; // 請求年数
  area: string; // 面積
  unitPrice: string; // 単価
  usageFee: string; // 使用料
  paymentMethod: string; // 支払方法
  createdAt: Date; // 作成日時
  updatedAt: Date; // 更新日時
  deletedAt: Date | null; // 削除日時
}

export interface CreateUsageFeeInput {
  contractPlotId: string; // 契約区画ID *必須
  calculationType: string; // 計算方式 *必須
  taxType: string; // 税区分 *必須
  billingType: string; // 請求区分 *必須
  billingYears: string; // 請求年数 *必須
  area: string; // 面積 *必須
  unitPrice: string; // 単価 *必須
  usageFee: string; // 使用料 *必須
  paymentMethod: string; // 支払方法 *必須
}

export interface UpdateUsageFeeInput {
  calculationType?: string; // 計算方式
  taxType?: string; // 税区分
  billingType?: string; // 請求区分
  billingYears?: string; // 請求年数
  area?: string; // 面積
  unitPrice?: string; // 単価
  usageFee?: string; // 使用料
  paymentMethod?: string; // 支払方法
}

// -----------------------------------------------------------------------------
// 6. ManagementFee（管理料） - ContractPlotに紐づけ
// -----------------------------------------------------------------------------

export interface ManagementFeeInfo {
  id: string; // 管理料ID
  contractPlotId: string; // 契約区画ID
  calculationType: string; // 計算方式
  taxType: string; // 税区分
  billingType: string; // 請求区分
  billingYears: string; // 請求年数
  area: string; // 面積
  billingMonth: string; // 請求月
  managementFee: string; // 管理料
  unitPrice: string; // 単価
  lastBillingMonth: string; // 最終請求月
  paymentMethod: string; // 支払方法
  createdAt: Date; // 作成日時
  updatedAt: Date; // 更新日時
  deletedAt: Date | null; // 削除日時
}

export interface CreateManagementFeeInput {
  contractPlotId: string; // 契約区画ID *必須
  calculationType: string; // 計算方式 *必須
  taxType: string; // 税区分 *必須
  billingType: string; // 請求区分 *必須
  billingYears: string; // 請求年数 *必須
  area: string; // 面積 *必須
  billingMonth: string; // 請求月 *必須
  managementFee: string; // 管理料 *必須
  unitPrice: string; // 単価 *必須
  lastBillingMonth: string; // 最終請求月 *必須
  paymentMethod: string; // 支払方法 *必須
}

export interface UpdateManagementFeeInput {
  calculationType?: string; // 計算方式
  taxType?: string; // 税区分
  billingType?: string; // 請求区分
  billingYears?: string; // 請求年数
  area?: string; // 面積
  billingMonth?: string; // 請求月
  managementFee?: string; // 管理料
  unitPrice?: string; // 単価
  lastBillingMonth?: string; // 最終請求月
  paymentMethod?: string; // 支払方法
}

// -----------------------------------------------------------------------------
// 7. GravestoneInfo（墓石情報） - PhysicalPlotに紐づけ
// -----------------------------------------------------------------------------

export interface GravestoneInfoDetail {
  id: string; // 墓石情報ID
  physicalPlotId: string; // 物理区画ID
  gravestoneBase: string; // 墓石基礎
  enclosurePosition: string; // 囲障位置
  gravestoneDealer: string; // 石材店
  gravestoneType: string; // 墓石種別
  surroundingArea: string; // 周辺区画
  establishmentDeadline: Date | null; // 設置期限
  establishmentDate: Date | null; // 設置日
  createdAt: Date; // 作成日時
  updatedAt: Date; // 更新日時
  deletedAt: Date | null; // 削除日時
}

export interface CreateGravestoneInfoInput {
  physicalPlotId: string; // 物理区画ID *必須
  gravestoneBase: string; // 墓石基礎 *必須
  enclosurePosition: string; // 囲障位置 *必須
  gravestoneDealer: string; // 石材店 *必須
  gravestoneType: string; // 墓石種別 *必須
  surroundingArea: string; // 周辺区画 *必須
  establishmentDeadline?: Date | string | null; // 設置期限
  establishmentDate?: Date | string | null; // 設置日
}

export interface UpdateGravestoneInfoInput {
  gravestoneBase?: string; // 墓石基礎
  enclosurePosition?: string; // 囲障位置
  gravestoneDealer?: string; // 石材店
  gravestoneType?: string; // 墓石種別
  surroundingArea?: string; // 周辺区画
  establishmentDeadline?: Date | string | null; // 設置期限
  establishmentDate?: Date | string | null; // 設置日
}

// -----------------------------------------------------------------------------
// 8. ConstructionInfo（工事情報） - PhysicalPlotに紐づけ
// -----------------------------------------------------------------------------

export interface ConstructionInfoDetail {
  id: string; // 工事情報ID
  physicalPlotId: string; // 物理区画ID
  // 工事進捗状況
  constructionType: string | null; // 工事区分
  startDate: Date | null; // 着工予定日
  completionDate: Date | null; // 完工予定日
  contractor: string | null; // 工事業者名
  supervisor: string | null; // 工事担当者名
  progress: string | null; // 進捗状況
  // 工事詳細
  workItem1: string | null; // 工事項目1
  workDate1: Date | null; // 実施日1
  workAmount1: number | null; // 金額1
  workStatus1: string | null; // 状況1
  workItem2: string | null; // 工事項目2
  workDate2: Date | null; // 予定日2
  workAmount2: number | null; // 金額2
  workStatus2: string | null; // 状況2
  // 許可・申請状況
  permitNumber: string | null; // 工事許可番号
  applicationDate: Date | null; // 申請日
  permitDate: Date | null; // 許可日
  permitStatus: string | null; // 許可状況
  // 工事代金支払状況
  paymentType1: string | null; // 支払区分1
  paymentAmount1: number | null; // 金額1
  paymentDate1: Date | null; // 支払日1
  paymentStatus1: string | null; // 状況1
  paymentType2: string | null; // 支払区分2
  paymentAmount2: number | null; // 金額2
  paymentScheduledDate2: Date | null; // 支払予定日2
  paymentStatus2: string | null; // 状況2
  // 工事備考
  constructionNotes: string | null; // 工事備考
  createdAt: Date; // 作成日時
  updatedAt: Date; // 更新日時
  deletedAt: Date | null; // 削除日時
}

export interface CreateConstructionInfoInput {
  physicalPlotId: string; // 物理区画ID *必須
  // 工事進捗状況
  constructionType?: string | null; // 工事区分
  startDate?: Date | string | null; // 着工予定日
  completionDate?: Date | string | null; // 完工予定日
  contractor?: string | null; // 工事業者名
  supervisor?: string | null; // 工事担当者名
  progress?: string | null; // 進捗状況
  // 工事詳細
  workItem1?: string | null; // 工事項目1
  workDate1?: Date | string | null; // 実施日1
  workAmount1?: number | null; // 金額1
  workStatus1?: string | null; // 状況1
  workItem2?: string | null; // 工事項目2
  workDate2?: Date | string | null; // 予定日2
  workAmount2?: number | null; // 金額2
  workStatus2?: string | null; // 状況2
  // 許可・申請状況
  permitNumber?: string | null; // 工事許可番号
  applicationDate?: Date | string | null; // 申請日
  permitDate?: Date | string | null; // 許可日
  permitStatus?: string | null; // 許可状況
  // 工事代金支払状況
  paymentType1?: string | null; // 支払区分1
  paymentAmount1?: number | null; // 金額1
  paymentDate1?: Date | string | null; // 支払日1
  paymentStatus1?: string | null; // 状況1
  paymentType2?: string | null; // 支払区分2
  paymentAmount2?: number | null; // 金額2
  paymentScheduledDate2?: Date | string | null; // 支払予定日2
  paymentStatus2?: string | null; // 状況2
  // 工事備考
  constructionNotes?: string | null; // 工事備考
}

export interface UpdateConstructionInfoInput {
  // 工事進捗状況
  constructionType?: string | null; // 工事区分
  startDate?: Date | string | null; // 着工予定日
  completionDate?: Date | string | null; // 完工予定日
  contractor?: string | null; // 工事業者名
  supervisor?: string | null; // 工事担当者名
  progress?: string | null; // 進捗状況
  // 工事詳細
  workItem1?: string | null; // 工事項目1
  workDate1?: Date | string | null; // 実施日1
  workAmount1?: number | null; // 金額1
  workStatus1?: string | null; // 状況1
  workItem2?: string | null; // 工事項目2
  workDate2?: Date | string | null; // 予定日2
  workAmount2?: number | null; // 金額2
  workStatus2?: string | null; // 状況2
  // 許可・申請状況
  permitNumber?: string | null; // 工事許可番号
  applicationDate?: Date | string | null; // 申請日
  permitDate?: Date | string | null; // 許可日
  permitStatus?: string | null; // 許可状況
  // 工事代金支払状況
  paymentType1?: string | null; // 支払区分1
  paymentAmount1?: number | null; // 金額1
  paymentDate1?: Date | string | null; // 支払日1
  paymentStatus1?: string | null; // 状況1
  paymentType2?: string | null; // 支払区分2
  paymentAmount2?: number | null; // 金額2
  paymentScheduledDate2?: Date | string | null; // 支払予定日2
  paymentStatus2?: string | null; // 状況2
  // 工事備考
  constructionNotes?: string | null; // 工事備考
}
