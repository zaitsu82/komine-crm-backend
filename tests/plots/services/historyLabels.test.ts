/**
 * historyLabels.ts のテスト
 */

import {
  getFieldLabel,
  getEntityLabel,
  formatHistoryWithLabels,
} from '../../../src/plots/services/historyLabels';

describe('historyLabels', () => {
  describe('getFieldLabel', () => {
    it('既知のフィールドの日本語ラベルを返す', () => {
      expect(getFieldLabel('ContractPlot', 'contract_area_sqm')).toBe('契約面積');
      expect(getFieldLabel('Customer', 'name')).toBe('氏名');
      expect(getFieldLabel('UsageFee', 'usage_fee')).toBe('使用料');
      expect(getFieldLabel('BuriedPerson', 'death_date')).toBe('死亡日');
    });

    it('未定義フィールドはそのまま返す', () => {
      expect(getFieldLabel('ContractPlot', 'unknown_field')).toBe('unknown_field');
    });

    it('未定義エンティティはフィールド名そのまま返す', () => {
      expect(getFieldLabel('UnknownEntity', 'name')).toBe('name');
    });
  });

  describe('getEntityLabel', () => {
    it('既知のエンティティ種別の日本語ラベルを返す', () => {
      expect(getEntityLabel('ContractPlot')).toBe('契約区画');
      expect(getEntityLabel('Customer')).toBe('顧客');
      expect(getEntityLabel('UsageFee')).toBe('使用料');
    });

    it('未定義エンティティはそのまま返す', () => {
      expect(getEntityLabel('Unknown')).toBe('Unknown');
    });
  });

  describe('formatHistoryWithLabels', () => {
    it('履歴レコードに日本語ラベル情報を付与する', () => {
      const history = {
        id: 'h-1',
        entity_type: 'ContractPlot',
        entity_id: 'cp-1',
        action_type: 'UPDATE',
        changed_fields: {
          contract_area_sqm: { before: '3.6', after: '1.8' },
          price: { before: 100000, after: 90000 },
        },
        before_record: { contract_area_sqm: '3.6', price: 100000 },
        after_record: { contract_area_sqm: '1.8', price: 90000 },
        changed_by: 'テストユーザー',
        change_reason: null,
        ip_address: '127.0.0.1',
        created_at: new Date('2026-04-01T10:00:00Z'),
      };

      const result = formatHistoryWithLabels(history);

      expect(result['entityType']).toBe('ContractPlot');
      expect(result['entityLabel']).toBe('契約区画');
      expect(result['fieldLabels']).toEqual({
        contract_area_sqm: '契約面積',
        price: '契約金額',
      });
      expect(result['actionType']).toBe('UPDATE');
      expect(result['changedBy']).toBe('テストユーザー');
    });

    it('changed_fieldsがnullでもエラーにならない', () => {
      const history = {
        id: 'h-1',
        entity_type: 'Customer',
        entity_id: 'c-1',
        action_type: 'CREATE',
        changed_fields: null,
        before_record: null,
        after_record: null,
        changed_by: 'system',
        change_reason: null,
        ip_address: 'unknown',
        created_at: new Date(),
      };

      const result = formatHistoryWithLabels(history);
      expect(result['fieldLabels']).toEqual({});
      expect(result['entityLabel']).toBe('顧客');
    });

    it('CREATE時はafter_recordのキーからfieldLabelsを補完する (issue #63)', () => {
      const history = {
        id: 'h-1',
        entity_type: 'BuriedPerson',
        entity_id: 'bp-1',
        action_type: 'CREATE',
        changed_fields: null,
        before_record: null,
        after_record: { id: 'bp-1', name: '田中', death_date: '2024-01-01' },
        changed_by: 'system',
        change_reason: null,
        ip_address: 'unknown',
        created_at: new Date(),
      };

      const result = formatHistoryWithLabels(history);
      expect(result['fieldLabels']).toEqual({
        name: '氏名',
        death_date: '死亡日',
      });
    });

    it('DELETE時はbefore_recordのキーからfieldLabelsを補完する (issue #63)', () => {
      const history = {
        id: 'h-1',
        entity_type: 'WorkInfo',
        entity_id: 'wi-1',
        action_type: 'DELETE',
        changed_fields: null,
        before_record: { id: 'wi-1', company_name: 'A社', work_address: '東京' },
        after_record: null,
        changed_by: 'system',
        change_reason: null,
        ip_address: 'unknown',
        created_at: new Date(),
      };

      const result = formatHistoryWithLabels(history);
      expect(result['fieldLabels']).toEqual({
        company_name: '勤務先名称',
        work_address: '勤務先住所',
      });
    });
  });
});
