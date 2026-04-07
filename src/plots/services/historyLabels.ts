/**
 * 履歴フィールドの日本語ラベル定義
 *
 * 履歴テーブルの changed_fields に格納されるDB列名を、
 * UI表示用の日本語ラベルにマッピングする。
 *
 * issue #51 Phase 3: 履歴の表示改善
 */

import { HistoryEntityType } from './historyService';

/**
 * エンティティ種別ごとのフィールド名→日本語ラベルマップ
 */
export const FIELD_LABELS: Record<HistoryEntityType, Record<string, string>> = {
  PhysicalPlot: {
    plot_number: '区画番号',
    area_name: '区画名',
    area_sqm: '面積(㎡)',
    status: 'ステータス',
    notes: '備考',
  },
  ContractPlot: {
    contract_area_sqm: '契約面積',
    location_description: '位置情報',
    contract_date: '契約日',
    price: '契約金額',
    payment_status: '支払ステータス',
    reservation_date: '予約日',
    acceptance_number: '受付番号',
    acceptance_date: '受付日',
    staff_in_charge: '担当者',
    agent_name: '取次者',
    permit_number: '許可番号',
    permit_date: '許可日',
    start_date: '開始日',
    uncollected_amount: '未収金額',
    burial_capacity: '埋葬可能数',
    validity_period_years: '有効期間（年）',
    notes: '備考',
  },
  Customer: {
    name: '氏名',
    name_kana: 'フリガナ',
    birth_date: '生年月日',
    gender: '性別',
    postal_code: '郵便番号',
    address: '住所',
    address_line_2: '住所2',
    registered_address: '本籍地',
    phone_number: '電話番号',
    fax_number: 'FAX番号',
    email: 'メールアドレス',
    notes: '備考',
  },
  WorkInfo: {
    company_name: '勤務先名称',
    company_name_kana: '勤務先フリガナ',
    work_postal_code: '勤務先郵便番号',
    work_address: '勤務先住所',
    work_phone_number: '勤務先電話番号',
    dm_setting: 'DM設定',
    address_type: '送付先タイプ',
    notes: '備考',
  },
  BillingInfo: {
    billing_type: '支払方法',
    bank_name: '銀行名',
    branch_name: '支店名',
    account_type: '口座種別',
    account_number: '口座番号',
    account_holder: '口座名義',
  },
  UsageFee: {
    calculation_type: '計算方式',
    tax_type: '税区分',
    billing_type: '請求区分',
    billing_years: '請求年数',
    usage_fee: '使用料',
    area: '面積',
    unit_price: '単価',
    payment_method: '支払方法',
  },
  ManagementFee: {
    calculation_type: '計算方式',
    tax_type: '税区分',
    billing_type: '請求区分',
    billing_years: '請求年数',
    area: '面積',
    billing_month: '請求月',
    management_fee: '管理料',
    unit_price: '単価',
    last_billing_month: '最終請求月',
    payment_method: '支払方法',
  },
  BuriedPerson: {
    name: '氏名',
    name_kana: 'フリガナ',
    relationship: '続柄',
    birth_date: '生年月日',
    death_date: '死亡日',
    age: '享年',
    gender: '性別',
    burial_date: '埋葬日',
    posthumous_name: '戒名',
    report_date: '届出日',
    religion: '宗派',
    notes: '備考',
  },
  ConstructionInfo: {
    construction_type: '工事種別',
    start_date: '着工日',
    completion_date: '完工日',
    contractor: '施工業者',
    supervisor: '監督者',
    progress: '進捗',
    work_item_1: '作業項目1',
    work_date_1: '作業日1',
    work_amount_1: '作業金額1',
    work_status_1: '作業ステータス1',
    work_item_2: '作業項目2',
    work_date_2: '作業日2',
    work_amount_2: '作業金額2',
    work_status_2: '作業ステータス2',
    permit_number: '許可番号',
    application_date: '申請日',
    permit_date: '許可日',
    permit_status: '許可ステータス',
    payment_type_1: '支払種別1',
    payment_amount_1: '支払金額1',
    payment_date_1: '支払日1',
    payment_status_1: '支払ステータス1',
    payment_type_2: '支払種別2',
    payment_amount_2: '支払金額2',
    payment_date_2: '支払日2',
    payment_status_2: '支払ステータス2',
    scheduled_end_date: '完了予定日',
    construction_content: '工事内容',
    notes: '備考',
  },
  CollectiveBurial: {
    burial_capacity: '埋葬可能数',
    current_burial_count: '現在埋葬数',
    capacity_reached_date: '満員到達日',
    validity_period_years: '有効期間（年）',
    billing_scheduled_date: '請求予定日',
    billing_status: '請求ステータス',
    billing_amount: '請求金額',
    notes: '備考',
  },
  GravestoneInfo: {
    gravestone_base: '台石',
    enclosure_position: '囲い位置',
    gravestone_dealer: '石材店',
    gravestone_type: '墓石種類',
    surrounding_area: '周辺面積',
    gravestone_cost: '墓石費用',
    establishment_deadline: '建立期限',
    establishment_date: '建立日',
  },
  FamilyContact: {
    name: '氏名',
    name_kana: 'フリガナ',
    relationship: '続柄',
    emergency_contact_flag: '緊急連絡先フラグ',
    postal_code: '郵便番号',
    address: '住所',
    phone_number: '電話番号',
    phone_number_2: '電話番号2',
    fax_number: 'FAX番号',
    email: 'メールアドレス',
    notes: '備考',
  },
  SaleContractRole: {
    role: '役割',
    customer_id: '顧客ID',
    role_start_date: '役割開始日',
    role_end_date: '役割終了日',
    notes: '備考',
  },
  Document: {
    type: '書類種別',
    name: '書類名',
  },
};

/**
 * エンティティ種別ごとの日本語ラベル
 */
export const ENTITY_LABELS: Record<HistoryEntityType, string> = {
  PhysicalPlot: '物理区画',
  ContractPlot: '契約区画',
  Customer: '顧客',
  WorkInfo: '勤務先情報',
  BillingInfo: '請求情報',
  UsageFee: '使用料',
  ManagementFee: '管理料',
  BuriedPerson: '埋葬者',
  ConstructionInfo: '工事情報',
  CollectiveBurial: '合祀情報',
  GravestoneInfo: '墓石情報',
  FamilyContact: '家族連絡先',
  SaleContractRole: '契約役割',
  Document: '書類',
};

/**
 * フィールド名から日本語ラベルを取得する
 *
 * @param entityType - エンティティ種別
 * @param fieldName - DBカラム名（例: contract_area_sqm）
 * @returns 日本語ラベル（未定義時はフィールド名そのまま）
 */
export function getFieldLabel(entityType: HistoryEntityType | string, fieldName: string): string {
  const entityLabels = FIELD_LABELS[entityType as HistoryEntityType];
  return entityLabels?.[fieldName] ?? fieldName;
}

/**
 * エンティティ種別の日本語ラベルを取得する
 */
export function getEntityLabel(entityType: HistoryEntityType | string): string {
  return ENTITY_LABELS[entityType as HistoryEntityType] ?? entityType;
}

/**
 * APIレスポンス用に履歴レコードへ日本語ラベル情報を付与する
 *
 * @param history - DBから取得した履歴レコード
 * @returns ラベル情報を付加したオブジェクト
 */
export function formatHistoryWithLabels(history: {
  id: string;
  entity_type: string;
  entity_id: string;
  action_type: string;
  changed_fields: unknown;
  before_record: unknown;
  after_record: unknown;
  changed_by: string | null;
  change_reason: string | null;
  ip_address: string | null;
  created_at: Date;
}): Record<string, unknown> {
  const entityType = history.entity_type;
  const entityLabel = getEntityLabel(entityType);

  // changed_fields に含まれるフィールド名から日本語ラベルマップを構築
  const fieldLabels: Record<string, string> = {};
  if (history.changed_fields && typeof history.changed_fields === 'object') {
    for (const fieldName of Object.keys(history.changed_fields as Record<string, unknown>)) {
      fieldLabels[fieldName] = getFieldLabel(entityType, fieldName);
    }
  }

  return {
    id: history.id,
    entityType: history.entity_type,
    entityLabel,
    entityId: history.entity_id,
    actionType: history.action_type,
    changedFields: history.changed_fields,
    fieldLabels,
    beforeRecord: history.before_record,
    afterRecord: history.after_record,
    changedBy: history.changed_by,
    changeReason: history.change_reason,
    ipAddress: history.ip_address,
    createdAt: history.created_at,
  };
}
