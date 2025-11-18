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
}

// 合祀情報（複数の故人を一つの墓所に祀る管理）
export interface collectiveBurial {
  collectiveBurialInfo?: {
    id: string;
    type: 'family' | 'relative' | 'other'; // 合祀種別（家族・親族・その他）
    ceremonies: {
      id: string;
      date: Date | null; // 合祀実施日
      officiant: string; // 導師・執行者
      religion: string; // 宗派
      participants: number; // 参列者数
      location: string; // 実施場所
      memo?: string; // 備考
    }[];
    persons: {
      id: string;
      name: string; // 故人氏名
      nameKana: string; // 故人氏名カナ
      relationship: string; // 続柄
      deathDate: Date | null; // 死亡日
      age?: number; // 享年
      gender: 'male' | 'female' | undefined; // 性別
      originalPlotNumber?: string; // 元の墓所・区画番号
      transferDate?: Date | null; // 移転日
      certificateNumber?: string; // 改葬許可証番号
      memo?: string; // 備考
    }[];
    mainRepresentative: string; // 主たる代表者（契約者との関係）
    totalFee?: number; // 合祀料金総額
    documents?: {
      id: string;
      type: 'permit' | 'certificate' | 'agreement' | 'other'; // 書類種別
      name: string; // 書類名
      issuedDate?: Date | null; // 発行日
      expiryDate?: Date | null; // 有効期限
      memo?: string; // 備考
    }[];
    specialRequests?: string; // 特別な要望・配慮事項（宗教的配慮含む）
    status: 'planned' | 'completed' | 'cancelled'; // 実施状況
    createdAt: Date;
    updatedAt: Date;
  }[];
}
