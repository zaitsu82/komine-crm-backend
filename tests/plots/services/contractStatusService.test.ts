/**
 * contractStatusService.tsのテスト
 */

import { ContractStatus, PaymentStatus } from '@prisma/client';
import {
  contractStatusService,
  ContractStatusTransitionError,
  ContractOperationNotAllowedError,
  PaymentStatusMismatchError,
  ContractOperation,
} from '../../../src/plots/services/contractStatusService';

describe('contractStatusService', () => {
  describe('canTransition', () => {
    describe('draft から遷移可能なステータス', () => {
      it('draft → reserved は許可される', () => {
        expect(
          contractStatusService.canTransition(ContractStatus.draft, ContractStatus.reserved)
        ).toBe(true);
      });

      it('draft → cancelled は許可される', () => {
        expect(
          contractStatusService.canTransition(ContractStatus.draft, ContractStatus.cancelled)
        ).toBe(true);
      });

      it('draft → active は許可されない', () => {
        expect(
          contractStatusService.canTransition(ContractStatus.draft, ContractStatus.active)
        ).toBe(false);
      });
    });

    describe('reserved から遷移可能なステータス', () => {
      it('reserved → active は許可される', () => {
        expect(
          contractStatusService.canTransition(ContractStatus.reserved, ContractStatus.active)
        ).toBe(true);
      });

      it('reserved → cancelled は許可される', () => {
        expect(
          contractStatusService.canTransition(ContractStatus.reserved, ContractStatus.cancelled)
        ).toBe(true);
      });

      it('reserved → draft は許可されない', () => {
        expect(
          contractStatusService.canTransition(ContractStatus.reserved, ContractStatus.draft)
        ).toBe(false);
      });
    });

    describe('active から遷移可能なステータス', () => {
      it('active → suspended は許可される', () => {
        expect(
          contractStatusService.canTransition(ContractStatus.active, ContractStatus.suspended)
        ).toBe(true);
      });

      it('active → terminated は許可される', () => {
        expect(
          contractStatusService.canTransition(ContractStatus.active, ContractStatus.terminated)
        ).toBe(true);
      });

      it('active → cancelled は許可される', () => {
        expect(
          contractStatusService.canTransition(ContractStatus.active, ContractStatus.cancelled)
        ).toBe(true);
      });

      it('active → transferred は許可される', () => {
        expect(
          contractStatusService.canTransition(ContractStatus.active, ContractStatus.transferred)
        ).toBe(true);
      });

      it('active → draft は許可されない', () => {
        expect(
          contractStatusService.canTransition(ContractStatus.active, ContractStatus.draft)
        ).toBe(false);
      });

      it('active → reserved は許可されない', () => {
        expect(
          contractStatusService.canTransition(ContractStatus.active, ContractStatus.reserved)
        ).toBe(false);
      });
    });

    describe('suspended から遷移可能なステータス', () => {
      it('suspended → active は許可される（復帰）', () => {
        expect(
          contractStatusService.canTransition(ContractStatus.suspended, ContractStatus.active)
        ).toBe(true);
      });

      it('suspended → cancelled は許可される', () => {
        expect(
          contractStatusService.canTransition(ContractStatus.suspended, ContractStatus.cancelled)
        ).toBe(true);
      });

      it('suspended → terminated は許可されない', () => {
        expect(
          contractStatusService.canTransition(ContractStatus.suspended, ContractStatus.terminated)
        ).toBe(false);
      });
    });

    describe('ファイナルステータスからの遷移', () => {
      it('terminated からは遷移できない', () => {
        expect(
          contractStatusService.canTransition(ContractStatus.terminated, ContractStatus.active)
        ).toBe(false);
        expect(
          contractStatusService.canTransition(ContractStatus.terminated, ContractStatus.cancelled)
        ).toBe(false);
      });

      it('cancelled からは遷移できない', () => {
        expect(
          contractStatusService.canTransition(ContractStatus.cancelled, ContractStatus.active)
        ).toBe(false);
        expect(
          contractStatusService.canTransition(ContractStatus.cancelled, ContractStatus.draft)
        ).toBe(false);
      });

      it('transferred からは遷移できない', () => {
        expect(
          contractStatusService.canTransition(ContractStatus.transferred, ContractStatus.active)
        ).toBe(false);
        expect(
          contractStatusService.canTransition(ContractStatus.transferred, ContractStatus.terminated)
        ).toBe(false);
      });
    });
  });

  describe('validateTransition', () => {
    it('許可された遷移ではエラーをスローしない', () => {
      expect(() => {
        contractStatusService.validateTransition(ContractStatus.draft, ContractStatus.reserved);
      }).not.toThrow();
    });

    it('禁止された遷移ではContractStatusTransitionErrorをスロー', () => {
      expect(() => {
        contractStatusService.validateTransition(ContractStatus.draft, ContractStatus.active);
      }).toThrow(ContractStatusTransitionError);
    });

    it('エラーには正しいfromとtoステータスが含まれる', () => {
      try {
        contractStatusService.validateTransition(ContractStatus.terminated, ContractStatus.active);
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ContractStatusTransitionError);
        const transitionError = error as ContractStatusTransitionError;
        expect(transitionError.fromStatus).toBe(ContractStatus.terminated);
        expect(transitionError.toStatus).toBe(ContractStatus.active);
      }
    });
  });

  describe('getAllowedTransitions', () => {
    it('draft からの遷移先を取得', () => {
      const transitions = contractStatusService.getAllowedTransitions(ContractStatus.draft);
      expect(transitions).toContain(ContractStatus.reserved);
      expect(transitions).toContain(ContractStatus.cancelled);
      expect(transitions).toHaveLength(2);
    });

    it('active からの遷移先を取得', () => {
      const transitions = contractStatusService.getAllowedTransitions(ContractStatus.active);
      expect(transitions).toContain(ContractStatus.suspended);
      expect(transitions).toContain(ContractStatus.terminated);
      expect(transitions).toContain(ContractStatus.cancelled);
      expect(transitions).toContain(ContractStatus.transferred);
      expect(transitions).toHaveLength(4);
    });

    it('ファイナルステータスからの遷移先は空', () => {
      expect(contractStatusService.getAllowedTransitions(ContractStatus.terminated)).toHaveLength(
        0
      );
      expect(contractStatusService.getAllowedTransitions(ContractStatus.cancelled)).toHaveLength(0);
      expect(contractStatusService.getAllowedTransitions(ContractStatus.transferred)).toHaveLength(
        0
      );
    });
  });

  describe('canPerformOperation', () => {
    describe('draft ステータスでの操作', () => {
      it('基本情報編集は許可される', () => {
        expect(
          contractStatusService.canPerformOperation(ContractStatus.draft, 'edit_basic_info')
        ).toBe(true);
      });

      it('削除は許可される', () => {
        expect(contractStatusService.canPerformOperation(ContractStatus.draft, 'delete')).toBe(
          true
        );
      });

      it('支払い登録は許可されない', () => {
        expect(
          contractStatusService.canPerformOperation(ContractStatus.draft, 'register_payment')
        ).toBe(false);
      });
    });

    describe('active ステータスでの操作', () => {
      it('埋葬者追加は許可される', () => {
        expect(
          contractStatusService.canPerformOperation(ContractStatus.active, 'add_buried_person')
        ).toBe(true);
      });

      it('名義変更は許可される', () => {
        expect(
          contractStatusService.canPerformOperation(ContractStatus.active, 'transfer_ownership')
        ).toBe(true);
      });

      it('削除は許可されない', () => {
        expect(contractStatusService.canPerformOperation(ContractStatus.active, 'delete')).toBe(
          false
        );
      });
    });

    describe('suspended ステータスでの操作', () => {
      it('支払い登録は許可される', () => {
        expect(
          contractStatusService.canPerformOperation(ContractStatus.suspended, 'register_payment')
        ).toBe(true);
      });

      it('埋葬者追加は許可されない', () => {
        expect(
          contractStatusService.canPerformOperation(ContractStatus.suspended, 'add_buried_person')
        ).toBe(false);
      });
    });

    describe('ファイナルステータスでの操作', () => {
      it('terminated では全ての操作が禁止', () => {
        const operations: ContractOperation[] = [
          'edit_basic_info',
          'edit_customer',
          'register_payment',
          'issue_invoice',
          'add_buried_person',
          'transfer_ownership',
          'request_cancellation',
          'delete',
        ];
        operations.forEach((op) => {
          expect(contractStatusService.canPerformOperation(ContractStatus.terminated, op)).toBe(
            false
          );
        });
      });

      it('cancelled では全ての操作が禁止', () => {
        const operations: ContractOperation[] = [
          'edit_basic_info',
          'edit_customer',
          'register_payment',
          'issue_invoice',
          'add_buried_person',
          'transfer_ownership',
          'request_cancellation',
          'delete',
        ];
        operations.forEach((op) => {
          expect(contractStatusService.canPerformOperation(ContractStatus.cancelled, op)).toBe(
            false
          );
        });
      });
    });
  });

  describe('validateOperation', () => {
    it('許可された操作ではエラーをスローしない', () => {
      expect(() => {
        contractStatusService.validateOperation(ContractStatus.active, 'edit_basic_info');
      }).not.toThrow();
    });

    it('禁止された操作ではContractOperationNotAllowedErrorをスロー', () => {
      expect(() => {
        contractStatusService.validateOperation(ContractStatus.terminated, 'edit_basic_info');
      }).toThrow(ContractOperationNotAllowedError);
    });
  });

  describe('isPaymentStatusValid', () => {
    describe('draft ステータスでの支払いステータス', () => {
      it('unpaid は有効', () => {
        expect(
          contractStatusService.isPaymentStatusValid(ContractStatus.draft, PaymentStatus.unpaid)
        ).toBe(true);
      });

      it('paid は無効', () => {
        expect(
          contractStatusService.isPaymentStatusValid(ContractStatus.draft, PaymentStatus.paid)
        ).toBe(false);
      });
    });

    describe('active ステータスでの支払いステータス', () => {
      it('unpaid, partial_paid, paid は有効', () => {
        expect(
          contractStatusService.isPaymentStatusValid(ContractStatus.active, PaymentStatus.unpaid)
        ).toBe(true);
        expect(
          contractStatusService.isPaymentStatusValid(
            ContractStatus.active,
            PaymentStatus.partial_paid
          )
        ).toBe(true);
        expect(
          contractStatusService.isPaymentStatusValid(ContractStatus.active, PaymentStatus.paid)
        ).toBe(true);
      });

      it('overdue は無効', () => {
        expect(
          contractStatusService.isPaymentStatusValid(ContractStatus.active, PaymentStatus.overdue)
        ).toBe(false);
      });
    });

    describe('suspended ステータスでの支払いステータス', () => {
      it('overdue のみ有効', () => {
        expect(
          contractStatusService.isPaymentStatusValid(
            ContractStatus.suspended,
            PaymentStatus.overdue
          )
        ).toBe(true);
        expect(
          contractStatusService.isPaymentStatusValid(ContractStatus.suspended, PaymentStatus.unpaid)
        ).toBe(false);
        expect(
          contractStatusService.isPaymentStatusValid(ContractStatus.suspended, PaymentStatus.paid)
        ).toBe(false);
      });
    });
  });

  describe('validatePaymentStatus', () => {
    it('有効な組み合わせではエラーをスローしない', () => {
      expect(() => {
        contractStatusService.validatePaymentStatus(ContractStatus.active, PaymentStatus.paid);
      }).not.toThrow();
    });

    it('無効な組み合わせではPaymentStatusMismatchErrorをスロー', () => {
      expect(() => {
        contractStatusService.validatePaymentStatus(ContractStatus.draft, PaymentStatus.paid);
      }).toThrow(PaymentStatusMismatchError);
    });
  });

  describe('isFinalStatus', () => {
    it('terminated はファイナルステータス', () => {
      expect(contractStatusService.isFinalStatus(ContractStatus.terminated)).toBe(true);
    });

    it('cancelled はファイナルステータス', () => {
      expect(contractStatusService.isFinalStatus(ContractStatus.cancelled)).toBe(true);
    });

    it('transferred はファイナルステータス', () => {
      expect(contractStatusService.isFinalStatus(ContractStatus.transferred)).toBe(true);
    });

    it('active はファイナルステータスではない', () => {
      expect(contractStatusService.isFinalStatus(ContractStatus.active)).toBe(false);
    });

    it('draft はファイナルステータスではない', () => {
      expect(contractStatusService.isFinalStatus(ContractStatus.draft)).toBe(false);
    });
  });

  describe('isActiveStatus', () => {
    it('active のみtrue', () => {
      expect(contractStatusService.isActiveStatus(ContractStatus.active)).toBe(true);
    });

    it('その他はfalse', () => {
      expect(contractStatusService.isActiveStatus(ContractStatus.draft)).toBe(false);
      expect(contractStatusService.isActiveStatus(ContractStatus.reserved)).toBe(false);
      expect(contractStatusService.isActiveStatus(ContractStatus.suspended)).toBe(false);
      expect(contractStatusService.isActiveStatus(ContractStatus.terminated)).toBe(false);
    });
  });

  describe('isEditable', () => {
    it('ファイナルステータスは編集不可', () => {
      expect(contractStatusService.isEditable(ContractStatus.terminated)).toBe(false);
      expect(contractStatusService.isEditable(ContractStatus.cancelled)).toBe(false);
      expect(contractStatusService.isEditable(ContractStatus.transferred)).toBe(false);
    });

    it('その他のステータスは編集可', () => {
      expect(contractStatusService.isEditable(ContractStatus.draft)).toBe(true);
      expect(contractStatusService.isEditable(ContractStatus.reserved)).toBe(true);
      expect(contractStatusService.isEditable(ContractStatus.active)).toBe(true);
      expect(contractStatusService.isEditable(ContractStatus.suspended)).toBe(true);
    });
  });

  describe('getStatusLabel', () => {
    it('各ステータスの日本語ラベルを取得', () => {
      expect(contractStatusService.getStatusLabel(ContractStatus.draft)).toBe('下書き');
      expect(contractStatusService.getStatusLabel(ContractStatus.reserved)).toBe('予約済み');
      expect(contractStatusService.getStatusLabel(ContractStatus.active)).toBe('有効');
      expect(contractStatusService.getStatusLabel(ContractStatus.suspended)).toBe('停止中');
      expect(contractStatusService.getStatusLabel(ContractStatus.terminated)).toBe('終了');
      expect(contractStatusService.getStatusLabel(ContractStatus.cancelled)).toBe('解約');
      expect(contractStatusService.getStatusLabel(ContractStatus.transferred)).toBe('継承済み');
    });
  });

  describe('getStatusDescription', () => {
    it('各ステータスの説明を取得', () => {
      expect(contractStatusService.getStatusDescription(ContractStatus.draft)).toContain('入力中');
      expect(contractStatusService.getStatusDescription(ContractStatus.active)).toContain(
        '本契約締結済み'
      );
      expect(contractStatusService.getStatusDescription(ContractStatus.suspended)).toContain(
        '一時停止'
      );
    });
  });
});
