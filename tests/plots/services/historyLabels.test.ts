/**
 * historyLabels.ts のテスト
 */

import {
  getFieldLabel,
  getEntityLabel,
  formatHistoryWithLabels,
  isHiddenField,
  isUuidValue,
  HIDDEN_FIELDS,
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

  describe('isHiddenField', () => {
    it('主キーは非表示', () => {
      expect(isHiddenField('id')).toBe(true);
    });

    it('タイムスタンプ系は非表示', () => {
      expect(isHiddenField('created_at')).toBe(true);
      expect(isHiddenField('updated_at')).toBe(true);
      expect(isHiddenField('deleted_at')).toBe(true);
    });

    it('FK系は非表示', () => {
      expect(isHiddenField('physical_plot_id')).toBe(true);
      expect(isHiddenField('contract_plot_id')).toBe(true);
      expect(isHiddenField('sale_contract_id')).toBe(true);
      expect(isHiddenField('customer_id')).toBe(true);
      expect(isHiddenField('work_info_id')).toBe(true);
      expect(isHiddenField('billing_info_id')).toBe(true);
    });

    it('通常のフィールドは表示対象', () => {
      expect(isHiddenField('name')).toBe(false);
      expect(isHiddenField('contract_area_sqm')).toBe(false);
      expect(isHiddenField('notes')).toBe(false);
    });
  });

  describe('isUuidValue', () => {
    it('UUID形式を判定する', () => {
      expect(isUuidValue('32295525-4309-477a-a524-30c0fa699795')).toBe(true);
      expect(isUuidValue('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(true);
    });

    it('UUID以外はfalse', () => {
      expect(isUuidValue('A-56')).toBe(false);
      expect(isUuidValue('田中太郎')).toBe(false);
      expect(isUuidValue(123)).toBe(false);
      expect(isUuidValue(null)).toBe(false);
      expect(isUuidValue(undefined)).toBe(false);
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
      // issue #69: idは非表示フィールドとして除外される
      expect(result['fieldLabels']).toEqual({
        name: '氏名',
        death_date: '死亡日',
      });
      // afterRecordからもidが除外されている
      const afterRecord = result['afterRecord'] as Record<string, unknown>;
      expect(afterRecord).not.toHaveProperty('id');
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
      // beforeRecordからもidが除外されている
      const beforeRecord = result['beforeRecord'] as Record<string, unknown>;
      expect(beforeRecord).not.toHaveProperty('id');
    });

    // issue #69: 非表示フィールドの除外テスト
    describe('issue #69: 非表示フィールドの除外', () => {
      it('CREATE時にシステムフィールド・FKがafterRecordから除外される', () => {
        const history = {
          id: 'h-1',
          entity_type: 'ContractPlot',
          entity_id: 'cp-1',
          action_type: 'CREATE',
          changed_fields: null,
          before_record: null,
          after_record: {
            id: 'cp-1',
            physical_plot_id: '32295525-4309-477a-a524-30c0fa699795',
            contract_area_sqm: '3.6',
            contract_date: '2026-01-01',
            price: 100000,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
          changed_by: 'テストユーザー',
          change_reason: null,
          ip_address: '127.0.0.1',
          created_at: new Date(),
        };

        const result = formatHistoryWithLabels(history);
        const afterRecord = result['afterRecord'] as Record<string, unknown>;
        const fieldLabels = result['fieldLabels'] as Record<string, string>;

        // 非表示フィールドが除外されている
        expect(afterRecord).not.toHaveProperty('id');
        expect(afterRecord).not.toHaveProperty('physical_plot_id');
        expect(afterRecord).not.toHaveProperty('created_at');
        expect(afterRecord).not.toHaveProperty('updated_at');

        // 業務フィールドは残っている
        expect(afterRecord).toHaveProperty('contract_area_sqm', '3.6');
        expect(afterRecord).toHaveProperty('price', 100000);

        // fieldLabelsにも非表示フィールドは含まれない
        expect(fieldLabels).not.toHaveProperty('id');
        expect(fieldLabels).not.toHaveProperty('physical_plot_id');
        expect(fieldLabels).toHaveProperty('contract_area_sqm', '契約面積');
      });

      it('UPDATE時にchanged_fieldsからFKが除外される', () => {
        const history = {
          id: 'h-1',
          entity_type: 'ContractPlot',
          entity_id: 'cp-1',
          action_type: 'UPDATE',
          changed_fields: {
            physical_plot_id: {
              before: 'aaaa-bbbb-cccc',
              after: 'dddd-eeee-ffff',
            },
            contract_area_sqm: { before: '3.6', after: '1.8' },
          },
          before_record: { physical_plot_id: 'aaaa', contract_area_sqm: '3.6' },
          after_record: { physical_plot_id: 'dddd', contract_area_sqm: '1.8' },
          changed_by: 'テストユーザー',
          change_reason: null,
          ip_address: '127.0.0.1',
          created_at: new Date(),
        };

        const result = formatHistoryWithLabels(history);
        const changedFields = result['changedFields'] as Record<string, unknown>;

        expect(changedFields).not.toHaveProperty('physical_plot_id');
        expect(changedFields).toHaveProperty('contract_area_sqm');
      });

      it('DELETE時にbefore_recordからシステムフィールドが除外される', () => {
        const history = {
          id: 'h-1',
          entity_type: 'Customer',
          entity_id: 'c-1',
          action_type: 'DELETE',
          changed_fields: null,
          before_record: {
            id: 'c-1',
            name: '山田太郎',
            phone_number: '090-1234-5678',
            created_at: '2025-01-01T00:00:00Z',
            deleted_at: '2026-04-01T00:00:00Z',
          },
          after_record: null,
          changed_by: 'system',
          change_reason: '退会',
          ip_address: 'unknown',
          created_at: new Date(),
        };

        const result = formatHistoryWithLabels(history);
        const beforeRecord = result['beforeRecord'] as Record<string, unknown>;

        expect(beforeRecord).not.toHaveProperty('id');
        expect(beforeRecord).not.toHaveProperty('created_at');
        expect(beforeRecord).not.toHaveProperty('deleted_at');
        expect(beforeRecord).toHaveProperty('name', '山田太郎');
        expect(beforeRecord).toHaveProperty('phone_number', '090-1234-5678');
      });

      it('全フィールドが非表示の場合はnullが返る', () => {
        const history = {
          id: 'h-1',
          entity_type: 'ContractPlot',
          entity_id: 'cp-1',
          action_type: 'CREATE',
          changed_fields: null,
          before_record: null,
          after_record: {
            id: 'cp-1',
            physical_plot_id: 'some-uuid',
            created_at: '2026-01-01',
          },
          changed_by: 'system',
          change_reason: null,
          ip_address: 'unknown',
          created_at: new Date(),
        };

        const result = formatHistoryWithLabels(history);
        expect(result['afterRecord']).toBeNull();
      });
    });
  });
});
