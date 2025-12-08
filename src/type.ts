// =============================================================================
// 型定義ファイル - Cemetery CRM System
// =============================================================================

import { PaymentStatus, Gender, ContractRole } from '@prisma/client';

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

// -----------------------------------------------------------------------------
// 3. SaleContract（販売契約）
// -----------------------------------------------------------------------------

export interface SaleContractInfo {
  id: string; // 販売契約ID
  contractPlotId: string; // 契約区画ID
  customerId: string; // 顧客ID
  customerRole: ContractRole; // 顧客の役割
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

// 販売契約における役割情報
export interface SaleContractRoleInput {
  customerId?: string; // 顧客ID（指定しない場合は作成された顧客を使用）
  role: ContractRole; // 顧客の役割 *必須
  isPrimary?: boolean; // 主契約者かどうか（デフォルト: false）
  roleStartDate?: Date | string | null; // 役割開始日
  roleEndDate?: Date | string | null; // 役割終了日
  notes?: string | null; // 備考
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
  gender: Gender | null; // 性別
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
  gender?: Gender | null; // 性別
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
  gender?: Gender | null; // 性別
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

// =============================================================================
// 新データモデル用の型定義（ContractPlot中心）
// =============================================================================

/**
 * 契約区画作成リクエスト（新モデル）
 */
export interface CreateContractPlotInput {
  // 物理区画情報（既存区画のIDまたは新規作成情報）
  physicalPlot: {
    id?: string; // 既存の物理区画ID（指定された場合は既存区画に紐づける）
    plotNumber?: string; // 新規作成時の区画番号（id未指定時は必須）
    areaName?: string; // 新規作成時の区域名（id未指定時は必須）
    areaSqm?: number; // 新規作成時の総面積（id未指定時、デフォルト: 3.6）
    notes?: string; // 備考
  };

  // 契約区画情報（必須）
  contractPlot: {
    contractAreaSqm: number; // 契約面積（例: 3.6, 1.8, 0.9）*必須
    saleStatus?: string; // 販売ステータス（デフォルト: 'contracted'）
    locationDescription?: string; // 物理区画内の位置説明（例: 左半分）
  };

  // 販売契約情報（必須）
  saleContract: {
    contractDate: Date | string; // 契約日 *必須
    price: number; // 販売価格 *必須
    paymentStatus?: PaymentStatus; // 支払状況（デフォルト: PaymentStatus.unpaid）
    customerRole?: string; // 顧客の役割（デフォルト: 'contractor'）- 旧方式（後方互換性）
    reservationDate?: Date | string | null; // 予約日
    acceptanceNumber?: string; // 受付番号
    permitDate?: Date | string | null; // 許可日
    startDate?: Date | string | null; // 開始日
    notes?: string; // 契約に関する備考
    roles?: SaleContractRoleInput[]; // 新方式: 複数の役割を指定可能
  };

  // 顧客情報（必須）
  customer: {
    name: string; // 氏名 *必須
    nameKana: string; // 氏名カナ *必須
    birthDate?: Date | string | null; // 生年月日
    gender?: Gender; // 性別
    postalCode: string; // 郵便番号 *必須
    address: string; // 住所 *必須
    registeredAddress?: string; // 本籍地
    phoneNumber: string; // 電話番号 *必須
    faxNumber?: string; // FAX番号
    email?: string; // メールアドレス
    notes?: string; // 備考
  };

  // 勤務先情報（任意）
  workInfo?: {
    companyName: string; // 会社名
    companyNameKana: string; // 会社名カナ
    workPostalCode: string; // 勤務先郵便番号
    workAddress: string; // 勤務先住所
    workPhoneNumber: string; // 勤務先電話番号
    dmSetting: string; // DM設定
    addressType: string; // 住所区分
    notes?: string; // 備考
  };

  // 請求情報（任意）
  billingInfo?: {
    billingType: string; // 請求区分
    bankName: string; // 銀行名
    branchName: string; // 支店名
    accountType: string; // 口座種別
    accountNumber: string; // 口座番号
    accountHolder: string; // 口座名義
  };

  // 使用料情報（任意）
  usageFee?: {
    calculationType: string; // 計算方式
    taxType: string; // 税区分
    usageFee: number; // 使用料
    area: number; // 面積
    unitPrice: number; // 単価
    paymentMethod: string; // 支払方法
  };

  // 管理料情報（任意）
  managementFee?: {
    calculationType: string; // 計算方式
    taxType: string; // 税区分
    billingType: string; // 請求区分
    billingYears: number; // 請求年数
    area: number; // 面積
    billingMonth: string; // 請求月
    managementFee: number; // 管理料
    unitPrice: number; // 単価
    lastBillingMonth: string; // 最終請求月
    paymentMethod: string; // 支払方法
  };
}

/**
 * 契約区画更新リクエスト（新モデル）
 */
export interface UpdateContractPlotInput {
  // 契約区画情報（オプション）
  contractPlot?: {
    contractAreaSqm?: number; // 契約面積
    saleStatus?: string; // 販売ステータス
    locationDescription?: string; // 位置説明
  };

  // 販売契約情報（オプション）
  saleContract?: {
    contractDate?: Date | string; // 契約日
    price?: number; // 販売価格
    paymentStatus?: PaymentStatus; // 支払状況
    customerRole?: string; // 顧客の役割 - 旧方式（後方互換性）
    reservationDate?: Date | string | null; // 予約日
    acceptanceNumber?: string; // 受付番号
    permitDate?: Date | string | null; // 許可日
    startDate?: Date | string | null; // 開始日
    notes?: string; // 契約に関する備考
    roles?: SaleContractRoleInput[]; // 新方式: 複数の役割を指定可能（既存役割は削除され、新しい役割が作成される）
  };

  // 顧客情報（オプション）
  customer?: {
    name?: string; // 氏名
    nameKana?: string; // 氏名カナ
    birthDate?: Date | string | null; // 生年月日
    gender?: Gender; // 性別
    postalCode?: string; // 郵便番号
    address?: string; // 住所
    registeredAddress?: string; // 本籍地
    phoneNumber?: string; // 電話番号
    faxNumber?: string; // FAX番号
    email?: string; // メールアドレス
    notes?: string; // 備考
  };

  // 勤務先情報（オプション - null指定で削除）
  workInfo?: {
    companyName?: string;
    companyNameKana?: string;
    workPostalCode?: string;
    workAddress?: string;
    workPhoneNumber?: string;
    dmSetting?: string;
    addressType?: string;
    notes?: string;
  } | null;

  // 請求情報（オプション - null指定で削除）
  billingInfo?: {
    billingType?: string;
    bankName?: string;
    branchName?: string;
    accountType?: string;
    accountNumber?: string;
    accountHolder?: string;
  } | null;

  // 使用料情報（オプション - null指定で削除）
  usageFee?: {
    calculationType?: string;
    taxType?: string;
    usageFee?: number;
    area?: number;
    unitPrice?: number;
    paymentMethod?: string;
  } | null;

  // 管理料情報（オプション - null指定で削除）
  managementFee?: {
    calculationType?: string;
    taxType?: string;
    billingType?: string;
    billingYears?: number;
    area?: number;
    billingMonth?: string;
    managementFee?: number;
    unitPrice?: number;
    lastBillingMonth?: string;
    paymentMethod?: string;
  } | null;
}
