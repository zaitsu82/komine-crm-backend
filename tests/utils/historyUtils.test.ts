import { Request } from 'express';
import {
  detectChangedFields,
  getIpAddress,
  createHistoryRecord,
  hasChanges,
  ChangedFields,
} from '../../src/plots/historyUtils';

describe('historyUtils', () => {
  describe('detectChangedFields', () => {
    it('should detect changed fields correctly', () => {
      const before = {
        plot_number: 'A-55',
        section: 'A区',
        usage: 'available',
        price: '100000',
      };

      const after = {
        plot_number: 'A-56',
        section: 'A区',
        usage: 'in_use',
        price: '100000',
      };

      const result = detectChangedFields(before, after);

      expect(result).toEqual({
        plot_number: {
          before: 'A-55',
          after: 'A-56',
        },
        usage: {
          before: 'available',
          after: 'in_use',
        },
      });
    });

    it('should return empty object when no changes', () => {
      const before = {
        plot_number: 'A-55',
        section: 'A区',
        usage: 'available',
      };

      const after = {
        plot_number: 'A-55',
        section: 'A区',
        usage: 'available',
      };

      const result = detectChangedFields(before, after);

      expect(result).toEqual({});
    });

    it('should exclude system fields (updated_at, created_at, deleted_at)', () => {
      const before = {
        plot_number: 'A-55',
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01'),
      };

      const after = {
        plot_number: 'A-56',
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-03-15'),
      };

      const result = detectChangedFields(before, after);

      expect(result).toEqual({
        plot_number: {
          before: 'A-55',
          after: 'A-56',
        },
      });
      expect(result).not.toHaveProperty('updated_at');
      expect(result).not.toHaveProperty('created_at');
    });

    it('should handle new fields (only in after)', () => {
      const before = {
        plot_number: 'A-55',
      };

      const after = {
        plot_number: 'A-55',
        section: 'A区',
      };

      const result = detectChangedFields(before, after);

      expect(result).toEqual({
        section: {
          before: undefined,
          after: 'A区',
        },
      });
    });

    it('should handle removed fields (only in before)', () => {
      const before = {
        plot_number: 'A-55',
        section: 'A区',
      };

      const after = {
        plot_number: 'A-55',
      };

      const result = detectChangedFields(before, after);

      expect(result).toEqual({
        section: {
          before: 'A区',
          after: undefined,
        },
      });
    });

    it('should handle null and undefined correctly', () => {
      const before = {
        notes: 'some note',
        contract_date: null,
      };

      const after = {
        notes: null,
        contract_date: '2024-03-15',
      };

      const result = detectChangedFields(before, after);

      expect(result).toEqual({
        notes: {
          before: 'some note',
          after: null,
        },
        contract_date: {
          before: null,
          after: '2024-03-15',
        },
      });
    });

    it('should handle nested objects', () => {
      const before = {
        data: { value: 10 },
      };

      const after = {
        data: { value: 20 },
      };

      const result = detectChangedFields(before, after);

      expect(result).toEqual({
        data: {
          before: { value: 10 },
          after: { value: 20 },
        },
      });
    });
  });

  describe('getIpAddress', () => {
    it('should return IP from req.ip', () => {
      const req = {
        ip: '192.168.1.100',
        socket: {},
        connection: {},
      } as unknown as Request;

      const result = getIpAddress(req);

      expect(result).toBe('192.168.1.100');
    });

    it('should return IP from req.socket.remoteAddress', () => {
      const req = {
        socket: { remoteAddress: '192.168.1.101' },
        connection: {},
      } as unknown as Request;

      const result = getIpAddress(req);

      expect(result).toBe('192.168.1.101');
    });

    it('should return IP from req.connection.remoteAddress', () => {
      const req = {
        socket: {},
        connection: { remoteAddress: '192.168.1.102' },
      } as unknown as Request;

      const result = getIpAddress(req);

      expect(result).toBe('192.168.1.102');
    });

    it('should return "unknown" when no IP available', () => {
      const req = {
        socket: {},
        connection: {},
      } as unknown as Request;

      const result = getIpAddress(req);

      expect(result).toBe('unknown');
    });
  });

  describe('createHistoryRecord', () => {
    it('should create history record data correctly', () => {
      const changedFields: ChangedFields = {
        plot_number: {
          before: 'A-55',
          after: 'A-56',
        },
      };

      const params = {
        entityType: 'Plot',
        entityId: 'plot-uuid-123',
        plotId: 'plot-uuid-123',
        actionType: 'UPDATE' as const,
        changedFields,
        changedBy: '3',
        changeReason: 'Update plot number',
        ipAddress: '192.168.1.100',
      };

      const result = createHistoryRecord(params);

      expect(result).toEqual({
        entity_type: 'Plot',
        entity_id: 'plot-uuid-123',
        plot_id: 'plot-uuid-123',
        action_type: 'UPDATE',
        changed_fields: changedFields,
        changed_by: '3',
        change_reason: 'Update plot number',
        ip_address: '192.168.1.100',
      });
    });

    it('should handle null values correctly', () => {
      const params = {
        entityType: 'Plot',
        entityId: 'plot-uuid-123',
        plotId: null,
        actionType: 'DELETE' as const,
        changedFields: null,
        changedBy: '1',
        changeReason: null,
        ipAddress: 'unknown',
      };

      const result = createHistoryRecord(params);

      expect(result).toEqual({
        entity_type: 'Plot',
        entity_id: 'plot-uuid-123',
        plot_id: null,
        action_type: 'DELETE',
        changed_fields: undefined, // null → undefined に変換される
        changed_by: '1',
        change_reason: undefined, // null → undefined に変換される
        ip_address: 'unknown',
      });
    });
  });

  describe('hasChanges', () => {
    it('should return true when there are changes', () => {
      const changedFields: ChangedFields = {
        plot_number: {
          before: 'A-55',
          after: 'A-56',
        },
      };

      const result = hasChanges(changedFields);

      expect(result).toBe(true);
    });

    it('should return false when there are no changes', () => {
      const changedFields: ChangedFields = {};

      const result = hasChanges(changedFields);

      expect(result).toBe(false);
    });
  });
});
