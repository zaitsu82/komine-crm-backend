/**
 * 契約ステータス遷移サービス
 *
 * 契約のライフサイクル管理と状態遷移のバリデーションを行う
 */

import { ContractStatus, PaymentStatus } from '@prisma/client';

/**
 * 許可される状態遷移のマップ
 * key: 現在のステータス
 * value: 遷移可能なステータスの配列
 */
const ALLOWED_TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  [ContractStatus.draft]: [ContractStatus.reserved, ContractStatus.cancelled],
  [ContractStatus.reserved]: [ContractStatus.active, ContractStatus.cancelled],
  [ContractStatus.active]: [
    ContractStatus.suspended,
    ContractStatus.terminated,
    ContractStatus.cancelled,
    ContractStatus.transferred,
  ],
  [ContractStatus.suspended]: [ContractStatus.active, ContractStatus.cancelled],
  [ContractStatus.terminated]: [],
  [ContractStatus.cancelled]: [],
  [ContractStatus.transferred]: [],
};

/**
 * 各契約ステータスで許可される支払いステータス
 */
const ALLOWED_PAYMENT_STATUS: Record<ContractStatus, PaymentStatus[]> = {
  [ContractStatus.draft]: [PaymentStatus.unpaid],
  [ContractStatus.reserved]: [PaymentStatus.unpaid, PaymentStatus.partial_paid],
  [ContractStatus.active]: [PaymentStatus.unpaid, PaymentStatus.partial_paid, PaymentStatus.paid],
  [ContractStatus.suspended]: [PaymentStatus.overdue],
  [ContractStatus.terminated]: [PaymentStatus.paid, PaymentStatus.refunded],
  [ContractStatus.cancelled]: [PaymentStatus.refunded, PaymentStatus.cancelled],
  [ContractStatus.transferred]: [PaymentStatus.paid],
};

/**
 * 各契約ステータスで許可される操作
 */
export type ContractOperation =
  | 'edit_basic_info' // 基本情報編集
  | 'edit_customer' // 顧客情報変更
  | 'register_payment' // 支払い登録
  | 'issue_invoice' // 請求書発行
  | 'add_buried_person' // 埋葬者追加
  | 'transfer_ownership' // 名義変更
  | 'request_cancellation' // 解約申請
  | 'delete'; // 削除

const ALLOWED_OPERATIONS: Record<ContractStatus, ContractOperation[]> = {
  [ContractStatus.draft]: ['edit_basic_info', 'edit_customer', 'delete'],
  [ContractStatus.reserved]: [
    'edit_basic_info',
    'edit_customer',
    'register_payment',
    'issue_invoice',
    'request_cancellation',
  ],
  [ContractStatus.active]: [
    'edit_basic_info',
    'edit_customer',
    'register_payment',
    'issue_invoice',
    'add_buried_person',
    'transfer_ownership',
    'request_cancellation',
  ],
  [ContractStatus.suspended]: [
    'edit_basic_info',
    'register_payment',
    'issue_invoice',
    'request_cancellation',
  ],
  [ContractStatus.terminated]: [],
  [ContractStatus.cancelled]: [],
  [ContractStatus.transferred]: [],
};

/**
 * ステータス遷移エラー
 */
export class ContractStatusTransitionError extends Error {
  constructor(
    public readonly fromStatus: ContractStatus,
    public readonly toStatus: ContractStatus,
    message?: string
  ) {
    super(message || `Cannot transition from ${fromStatus} to ${toStatus}`);
    this.name = 'ContractStatusTransitionError';
  }
}

/**
 * 操作権限エラー
 */
export class ContractOperationNotAllowedError extends Error {
  constructor(
    public readonly status: ContractStatus,
    public readonly operation: ContractOperation,
    message?: string
  ) {
    super(message || `Operation '${operation}' is not allowed when contract status is '${status}'`);
    this.name = 'ContractOperationNotAllowedError';
  }
}

/**
 * 支払いステータス不整合エラー
 */
export class PaymentStatusMismatchError extends Error {
  constructor(
    public readonly contractStatus: ContractStatus,
    public readonly paymentStatus: PaymentStatus,
    message?: string
  ) {
    super(
      message ||
        `Payment status '${paymentStatus}' is not valid for contract status '${contractStatus}'`
    );
    this.name = 'PaymentStatusMismatchError';
  }
}

/**
 * 契約ステータス遷移サービス
 */
export const contractStatusService = {
  /**
   * 状態遷移が許可されているかチェック
   */
  canTransition(from: ContractStatus, to: ContractStatus): boolean {
    return ALLOWED_TRANSITIONS[from].includes(to);
  },

  /**
   * 状態遷移をバリデート（エラーをスロー）
   */
  validateTransition(from: ContractStatus, to: ContractStatus): void {
    if (!this.canTransition(from, to)) {
      throw new ContractStatusTransitionError(from, to);
    }
  },

  /**
   * 許可される遷移先のステータス一覧を取得
   */
  getAllowedTransitions(from: ContractStatus): ContractStatus[] {
    return [...ALLOWED_TRANSITIONS[from]];
  },

  /**
   * 操作が許可されているかチェック
   */
  canPerformOperation(status: ContractStatus, operation: ContractOperation): boolean {
    return ALLOWED_OPERATIONS[status].includes(operation);
  },

  /**
   * 操作権限をバリデート（エラーをスロー）
   */
  validateOperation(status: ContractStatus, operation: ContractOperation): void {
    if (!this.canPerformOperation(status, operation)) {
      throw new ContractOperationNotAllowedError(status, operation);
    }
  },

  /**
   * 許可される操作一覧を取得
   */
  getAllowedOperations(status: ContractStatus): ContractOperation[] {
    return [...ALLOWED_OPERATIONS[status]];
  },

  /**
   * 支払いステータスが契約ステータスと整合しているかチェック
   */
  isPaymentStatusValid(contractStatus: ContractStatus, paymentStatus: PaymentStatus): boolean {
    return ALLOWED_PAYMENT_STATUS[contractStatus].includes(paymentStatus);
  },

  /**
   * 支払いステータスの整合性をバリデート（エラーをスロー）
   */
  validatePaymentStatus(contractStatus: ContractStatus, paymentStatus: PaymentStatus): void {
    if (!this.isPaymentStatusValid(contractStatus, paymentStatus)) {
      throw new PaymentStatusMismatchError(contractStatus, paymentStatus);
    }
  },

  /**
   * 許可される支払いステータス一覧を取得
   */
  getAllowedPaymentStatuses(contractStatus: ContractStatus): PaymentStatus[] {
    return [...ALLOWED_PAYMENT_STATUS[contractStatus]];
  },

  /**
   * 契約がファイナル状態（変更不可）かどうか
   */
  isFinalStatus(status: ContractStatus): boolean {
    const finalStatuses: ContractStatus[] = [
      ContractStatus.terminated,
      ContractStatus.cancelled,
      ContractStatus.transferred,
    ];
    return finalStatuses.includes(status);
  },

  /**
   * 契約がアクティブ（利用可能）状態かどうか
   */
  isActiveStatus(status: ContractStatus): boolean {
    return status === ContractStatus.active;
  },

  /**
   * 契約が編集可能かどうか
   */
  isEditable(status: ContractStatus): boolean {
    return !this.isFinalStatus(status);
  },

  /**
   * ステータスの日本語ラベルを取得
   */
  getStatusLabel(status: ContractStatus): string {
    const labels: Record<ContractStatus, string> = {
      [ContractStatus.draft]: '下書き',
      [ContractStatus.reserved]: '予約済み',
      [ContractStatus.active]: '有効',
      [ContractStatus.suspended]: '停止中',
      [ContractStatus.terminated]: '終了',
      [ContractStatus.cancelled]: '解約',
      [ContractStatus.transferred]: '継承済み',
    };
    return labels[status];
  },

  /**
   * ステータスの説明を取得
   */
  getStatusDescription(status: ContractStatus): string {
    const descriptions: Record<ContractStatus, string> = {
      [ContractStatus.draft]: '契約情報入力中、未確定の状態',
      [ContractStatus.reserved]: '区画予約完了、本契約締結待ち',
      [ContractStatus.active]: '本契約締結済み、利用可能な状態',
      [ContractStatus.suspended]: '支払い延滞等により一時停止中',
      [ContractStatus.terminated]: '契約期間満了による正常終了',
      [ContractStatus.cancelled]: '契約者都合による中途解約',
      [ContractStatus.transferred]: '名義変更により別契約へ移行済み',
    };
    return descriptions[status];
  },
};

export default contractStatusService;
