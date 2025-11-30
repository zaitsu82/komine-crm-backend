import {
  calculateBillingScheduledDate,
  updateCollectiveBurialCount,
  isCapacityReached,
  getBillingTargets,
} from '../../src/utils/collectiveBurialUtils';

// Prisma Clientのモック
const mockPrisma = {
  collectiveBurial: {
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  buriedPerson: {
    count: jest.fn(),
  },
};

describe('collectiveBurialUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateBillingScheduledDate', () => {
    it('should calculate billing date correctly by adding years', () => {
      const capacityReachedDate = new Date('2024-01-15');
      const validityPeriodYears = 3;

      const result = calculateBillingScheduledDate(capacityReachedDate, validityPeriodYears);

      expect(result.getFullYear()).toBe(2027);
      expect(result.getMonth()).toBe(0); // January
      expect(result.getDate()).toBe(15);
    });

    it('should handle leap year correctly', () => {
      const capacityReachedDate = new Date('2024-02-29'); // Leap year
      const validityPeriodYears = 1;

      const result = calculateBillingScheduledDate(capacityReachedDate, validityPeriodYears);

      expect(result.getFullYear()).toBe(2025);
      // JavaScriptでは2024-02-29 + 1年 = 2025-03-01になる（うるう日調整）
      expect(result.getMonth()).toBe(2); // March
      expect(result.getDate()).toBe(1);
    });

    it('should calculate correctly with 5 year validity period', () => {
      const capacityReachedDate = new Date('2020-06-30');
      const validityPeriodYears = 5;

      const result = calculateBillingScheduledDate(capacityReachedDate, validityPeriodYears);

      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(5); // June
      expect(result.getDate()).toBe(30);
    });
  });

  describe('updateCollectiveBurialCount', () => {
    it('should return null if collective burial does not exist', async () => {
      mockPrisma.collectiveBurial.findUnique.mockResolvedValue(null);

      const result = await updateCollectiveBurialCount(mockPrisma as any, 'plot-1');

      expect(result).toBeNull();
      expect(mockPrisma.collectiveBurial.findUnique).toHaveBeenCalledWith({
        where: { plot_id: 'plot-1' },
      });
      expect(mockPrisma.buriedPerson.count).not.toHaveBeenCalled();
    });

    it('should return null if collective burial is deleted', async () => {
      mockPrisma.collectiveBurial.findUnique.mockResolvedValue({
        id: 'cb-1',
        deleted_at: new Date(),
        burial_capacity: 10,
      });

      const result = await updateCollectiveBurialCount(mockPrisma as any, 'plot-1');

      expect(result).toBeNull();
    });

    it('should update count without reaching capacity', async () => {
      const mockCollectiveBurial = {
        id: 'cb-1',
        plot_id: 'plot-1',
        burial_capacity: 10,
        current_burial_count: 5,
        capacity_reached_date: null,
        validity_period_years: 3,
        deleted_at: null,
      };

      mockPrisma.collectiveBurial.findUnique.mockResolvedValue(mockCollectiveBurial);
      mockPrisma.buriedPerson.count.mockResolvedValue(7); // 上限未満
      mockPrisma.collectiveBurial.update.mockResolvedValue({
        ...mockCollectiveBurial,
        current_burial_count: 7,
      });

      const result = await updateCollectiveBurialCount(mockPrisma as any, 'plot-1');

      expect(mockPrisma.buriedPerson.count).toHaveBeenCalledWith({
        where: {
          plot_id: 'plot-1',
          deleted_at: null,
        },
      });

      expect(mockPrisma.collectiveBurial.update).toHaveBeenCalledWith({
        where: { id: 'cb-1' },
        data: {
          current_burial_count: 7,
        },
      });

      expect(result).toBeDefined();
      expect(result.current_burial_count).toBe(7);
    });

    it('should set capacity_reached_date when reaching capacity for first time', async () => {
      const mockCollectiveBurial = {
        id: 'cb-1',
        plot_id: 'plot-1',
        burial_capacity: 10,
        current_burial_count: 9,
        capacity_reached_date: null, // 未到達
        validity_period_years: 3,
        deleted_at: null,
      };

      mockPrisma.collectiveBurial.findUnique.mockResolvedValue(mockCollectiveBurial);
      mockPrisma.buriedPerson.count.mockResolvedValue(10); // ちょうど上限到達
      mockPrisma.collectiveBurial.update.mockResolvedValue({
        ...mockCollectiveBurial,
        current_burial_count: 10,
        capacity_reached_date: new Date(),
      });

      await updateCollectiveBurialCount(mockPrisma as any, 'plot-1');

      const updateCall = mockPrisma.collectiveBurial.update.mock.calls[0][0];
      expect(updateCall.data.current_burial_count).toBe(10);
      expect(updateCall.data.capacity_reached_date).toBeInstanceOf(Date);
      expect(updateCall.data.billing_scheduled_date).toBeInstanceOf(Date);

      // 請求予定日が3年後であることを確認
      const capacityDate = updateCall.data.capacity_reached_date;
      const billingDate = updateCall.data.billing_scheduled_date;
      expect(billingDate.getFullYear()).toBe(capacityDate.getFullYear() + 3);
    });

    it('should not update dates if already reached capacity', async () => {
      const mockCollectiveBurial = {
        id: 'cb-1',
        plot_id: 'plot-1',
        burial_capacity: 10,
        current_burial_count: 10,
        capacity_reached_date: new Date('2024-01-01'), // 既に到達済み
        billing_scheduled_date: new Date('2027-01-01'),
        validity_period_years: 3,
        deleted_at: null,
      };

      mockPrisma.collectiveBurial.findUnique.mockResolvedValue(mockCollectiveBurial);
      mockPrisma.buriedPerson.count.mockResolvedValue(10); // 依然として上限
      mockPrisma.collectiveBurial.update.mockResolvedValue(mockCollectiveBurial);

      await updateCollectiveBurialCount(mockPrisma as any, 'plot-1');

      const updateCall = mockPrisma.collectiveBurial.update.mock.calls[0][0];
      // 日付フィールドが更新データに含まれていないことを確認
      expect(updateCall.data.capacity_reached_date).toBeUndefined();
      expect(updateCall.data.billing_scheduled_date).toBeUndefined();
      expect(updateCall.data.current_burial_count).toBe(10);
    });

    it('should reset dates when falling below capacity', async () => {
      const mockCollectiveBurial = {
        id: 'cb-1',
        plot_id: 'plot-1',
        burial_capacity: 10,
        current_burial_count: 10,
        capacity_reached_date: new Date('2024-01-01'), // 到達済み
        billing_scheduled_date: new Date('2027-01-01'),
        validity_period_years: 3,
        deleted_at: null,
      };

      mockPrisma.collectiveBurial.findUnique.mockResolvedValue(mockCollectiveBurial);
      mockPrisma.buriedPerson.count.mockResolvedValue(8); // 上限を下回った
      mockPrisma.collectiveBurial.update.mockResolvedValue({
        ...mockCollectiveBurial,
        current_burial_count: 8,
        capacity_reached_date: null,
        billing_scheduled_date: null,
      });

      await updateCollectiveBurialCount(mockPrisma as any, 'plot-1');

      const updateCall = mockPrisma.collectiveBurial.update.mock.calls[0][0];
      expect(updateCall.data.current_burial_count).toBe(8);
      expect(updateCall.data.capacity_reached_date).toBeNull();
      expect(updateCall.data.billing_scheduled_date).toBeNull();
    });
  });

  describe('isCapacityReached', () => {
    it('should return false if collective burial does not exist', async () => {
      mockPrisma.collectiveBurial.findUnique.mockResolvedValue(null);

      const result = await isCapacityReached(mockPrisma as any, 'plot-1');

      expect(result).toBe(false);
    });

    it('should return false if collective burial is deleted', async () => {
      mockPrisma.collectiveBurial.findUnique.mockResolvedValue({
        id: 'cb-1',
        deleted_at: new Date(),
        capacity_reached_date: new Date(),
      });

      const result = await isCapacityReached(mockPrisma as any, 'plot-1');

      expect(result).toBe(false);
    });

    it('should return false if capacity_reached_date is null', async () => {
      mockPrisma.collectiveBurial.findUnique.mockResolvedValue({
        id: 'cb-1',
        capacity_reached_date: null,
        deleted_at: null,
      });

      const result = await isCapacityReached(mockPrisma as any, 'plot-1');

      expect(result).toBe(false);
    });

    it('should return true if capacity_reached_date is set', async () => {
      mockPrisma.collectiveBurial.findUnique.mockResolvedValue({
        id: 'cb-1',
        capacity_reached_date: new Date('2024-01-01'),
        deleted_at: null,
      });

      const result = await isCapacityReached(mockPrisma as any, 'plot-1');

      expect(result).toBe(true);
    });
  });

  describe('getBillingTargets', () => {
    it('should return collective burials with pending status and past billing date', async () => {
      const mockTargets = [
        {
          id: 'cb-1',
          plot_id: 'plot-1',
          billing_status: 'pending',
          billing_scheduled_date: new Date('2024-01-01'),
          Plot: {
            id: 'plot-1',
            Contractors: [
              {
                id: 'contractor-1',
                name: '田中太郎',
              },
            ],
          },
        },
      ];

      mockPrisma.collectiveBurial.findMany.mockResolvedValue(mockTargets);

      const result = await getBillingTargets(mockPrisma as any);

      expect(mockPrisma.collectiveBurial.findMany).toHaveBeenCalled();
      const callArgs = mockPrisma.collectiveBurial.findMany.mock.calls[0][0];
      expect(callArgs.where.billing_status).toBe('pending');
      expect(callArgs.where.billing_scheduled_date.lte).toBeInstanceOf(Date);
      expect(callArgs.where.deleted_at).toBeNull();
      expect(callArgs).toMatchObject({
        include: {
          PhysicalPlot: {
            include: {
              ContractPlots: {
                where: { deleted_at: null },
                include: {
                  SaleContract: {
                    include: {
                      Customer: true,
                    },
                  },
                },
                orderBy: { created_at: 'desc' },
                take: 1,
              },
            },
          },
        },
      });

      expect(result).toEqual(mockTargets);
      expect(result.length).toBe(1);
    });

    it('should return empty array if no billing targets found', async () => {
      mockPrisma.collectiveBurial.findMany.mockResolvedValue([]);

      const result = await getBillingTargets(mockPrisma as any);

      expect(result).toEqual([]);
      expect(result.length).toBe(0);
    });
  });
});
