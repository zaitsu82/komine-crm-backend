/**
 * contractStatusService.tsのテスト（3ステートモデル: vacant/active/terminated）
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
    describe('vacant から遷移可能なステータス', () => {
      it('vacant → active は許可される', () => {
        expect(
          contractStatusService.canTransition(ContractStatus.vacant, ContractStatus.active)
        ).toBe(true);
      });

      it('vacant → terminated は許可されない', () => {
        expect(
          contractStatusService.canTransition(ContractStatus.vacant, ContractStatus.terminated)
        ).toBe(false);
      });
    });

    describe('active から遷移可能なステータス', () => {
      it('active → terminated は許可される', () => {
        expect(
          contractStatusService.canTransition(ContractStatus.active, ContractStatus.terminated)
        ).toBe(true);
      });

      it('active → vacant は許可されない', () => {
        expect(
          contractStatusService.canTransition(ContractStatus.active, ContractStatus.vacant)
        ).toBe(false);
      });
    });

    describe('terminated は最終状態', () => {
      it('terminated → active は許可されない', () => {
        expect(
          contractStatusService.canTransition(ContractStatus.terminated, ContractStatus.active)
        ).toBe(false);
      });

      it('terminated → vacant は許可されない', () => {
        expect(
          contractStatusService.canTransition(ContractStatus.terminated, ContractStatus.vacant)
        ).toBe(false);
      });
    });
  });

  describe('validateTransition', () => {
    it('許可された遷移はエラーを投げない', () => {
      expect(() =>
        contractStatusService.validateTransition(ContractStatus.vacant, ContractStatus.active)
      ).not.toThrow();
    });

    it('許可されない遷移は ContractStatusTransitionError を投げる', () => {
      expect(() =>
        contractStatusService.validateTransition(ContractStatus.terminated, ContractStatus.active)
      ).toThrow(ContractStatusTransitionError);
    });
  });

  describe('getAllowedTransitions', () => {
    it('vacant は active のみに遷移可能', () => {
      expect(contractStatusService.getAllowedTransitions(ContractStatus.vacant)).toEqual([
        ContractStatus.active,
      ]);
    });

    it('active は terminated のみに遷移可能', () => {
      expect(contractStatusService.getAllowedTransitions(ContractStatus.active)).toEqual([
        ContractStatus.terminated,
      ]);
    });

    it('terminated は遷移先なし', () => {
      expect(contractStatusService.getAllowedTransitions(ContractStatus.terminated)).toEqual([]);
    });
  });

  describe('canPerformOperation', () => {
    it('vacant では基本情報の編集と削除が可能', () => {
      expect(
        contractStatusService.canPerformOperation(ContractStatus.vacant, 'edit_basic_info')
      ).toBe(true);
      expect(contractStatusService.canPerformOperation(ContractStatus.vacant, 'delete')).toBe(true);
    });

    it('active では多くの操作が可能', () => {
      const operations: ContractOperation[] = [
        'edit_basic_info',
        'edit_customer',
        'register_payment',
        'issue_invoice',
        'add_buried_person',
        'transfer_ownership',
        'request_cancellation',
      ];
      for (const op of operations) {
        expect(contractStatusService.canPerformOperation(ContractStatus.active, op)).toBe(true);
      }
    });

    it('terminated ではどの操作も不可', () => {
      expect(
        contractStatusService.canPerformOperation(ContractStatus.terminated, 'edit_basic_info')
      ).toBe(false);
      expect(
        contractStatusService.canPerformOperation(ContractStatus.terminated, 'register_payment')
      ).toBe(false);
    });
  });

  describe('validateOperation', () => {
    it('許可された操作はエラーを投げない', () => {
      expect(() =>
        contractStatusService.validateOperation(ContractStatus.active, 'edit_basic_info')
      ).not.toThrow();
    });

    it('許可されない操作は ContractOperationNotAllowedError を投げる', () => {
      expect(() =>
        contractStatusService.validateOperation(ContractStatus.terminated, 'edit_basic_info')
      ).toThrow(ContractOperationNotAllowedError);
    });
  });

  describe('isPaymentStatusValid', () => {
    it('active では unpaid/partial_paid/paid/overdue を許可', () => {
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
      expect(
        contractStatusService.isPaymentStatusValid(ContractStatus.active, PaymentStatus.overdue)
      ).toBe(true);
    });

    it('terminated では paid/refunded のみを許可', () => {
      expect(
        contractStatusService.isPaymentStatusValid(ContractStatus.terminated, PaymentStatus.paid)
      ).toBe(true);
      expect(
        contractStatusService.isPaymentStatusValid(
          ContractStatus.terminated,
          PaymentStatus.refunded
        )
      ).toBe(true);
      expect(
        contractStatusService.isPaymentStatusValid(ContractStatus.terminated, PaymentStatus.unpaid)
      ).toBe(false);
    });
  });

  describe('validatePaymentStatus', () => {
    it('整合する支払いステータスはエラーを投げない', () => {
      expect(() =>
        contractStatusService.validatePaymentStatus(ContractStatus.active, PaymentStatus.paid)
      ).not.toThrow();
    });

    it('整合しない支払いステータスは PaymentStatusMismatchError を投げる', () => {
      expect(() =>
        contractStatusService.validatePaymentStatus(ContractStatus.terminated, PaymentStatus.unpaid)
      ).toThrow(PaymentStatusMismatchError);
    });
  });

  describe('isFinalStatus', () => {
    it('terminated はファイナル状態', () => {
      expect(contractStatusService.isFinalStatus(ContractStatus.terminated)).toBe(true);
    });

    it('vacant/active はファイナル状態ではない', () => {
      expect(contractStatusService.isFinalStatus(ContractStatus.vacant)).toBe(false);
      expect(contractStatusService.isFinalStatus(ContractStatus.active)).toBe(false);
    });
  });

  describe('isActiveStatus', () => {
    it('active のみアクティブ状態', () => {
      expect(contractStatusService.isActiveStatus(ContractStatus.active)).toBe(true);
      expect(contractStatusService.isActiveStatus(ContractStatus.vacant)).toBe(false);
      expect(contractStatusService.isActiveStatus(ContractStatus.terminated)).toBe(false);
    });
  });

  describe('isEditable', () => {
    it('vacant/active は編集可能', () => {
      expect(contractStatusService.isEditable(ContractStatus.vacant)).toBe(true);
      expect(contractStatusService.isEditable(ContractStatus.active)).toBe(true);
    });

    it('terminated は編集不可', () => {
      expect(contractStatusService.isEditable(ContractStatus.terminated)).toBe(false);
    });
  });

  describe('getStatusLabel', () => {
    it('各ステータスの日本語ラベルを返す', () => {
      expect(contractStatusService.getStatusLabel(ContractStatus.vacant)).toBe('空き');
      expect(contractStatusService.getStatusLabel(ContractStatus.active)).toBe('有効');
      expect(contractStatusService.getStatusLabel(ContractStatus.terminated)).toBe('終了');
    });
  });

  describe('getStatusDescription', () => {
    it('各ステータスの説明を返す', () => {
      expect(contractStatusService.getStatusDescription(ContractStatus.vacant)).toContain('空き');
      expect(contractStatusService.getStatusDescription(ContractStatus.active)).toContain(
        '契約締結'
      );
      expect(contractStatusService.getStatusDescription(ContractStatus.terminated)).toContain(
        '契約終了'
      );
    });
  });
});
