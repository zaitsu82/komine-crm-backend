import { PrismaClient } from '@prisma/client';

/**
 * 請求予定日を計算
 * @param capacityReachedDate 上限到達日
 * @param validityPeriodYears 有効期間（年単位）
 * @returns 請求予定日
 */
export const calculateBillingScheduledDate = (
  capacityReachedDate: Date,
  validityPeriodYears: number
): Date => {
  const billingDate = new Date(capacityReachedDate);
  billingDate.setFullYear(billingDate.getFullYear() + validityPeriodYears);
  return billingDate;
};

/**
 * 合祀情報の埋葬人数と関連日付を自動更新
 * @param prisma Prismaクライアント（トランザクション対応）
 * @param plotId 区画ID
 * @returns 更新された合祀情報（存在しない場合はnull）
 */
export const updateCollectiveBurialCount = async (
  prisma: PrismaClient | any, // トランザクション内のprismaも受け入れる
  plotId: string
): Promise<any | null> => {
  // 1. 合祀情報を取得
  const collectiveBurial = await prisma.collectiveBurial.findUnique({
    where: { plot_id: plotId },
  });

  if (!collectiveBurial || collectiveBurial.deleted_at) {
    return null; // 合祀情報が存在しない場合は何もしない
  }

  // 2. 現在の埋葬人数を計算（論理削除されていないBuriedPersonのみカウント）
  const currentCount = await prisma.buriedPerson.count({
    where: {
      plot_id: plotId,
      deleted_at: null,
    },
  });

  // 3. 上限到達判定と日付計算
  const capacityReached = currentCount >= collectiveBurial.burial_capacity;
  const wasCapacityReached = collectiveBurial.capacity_reached_date !== null;

  const updateData: any = {
    current_burial_count: currentCount,
  };

  if (capacityReached && !wasCapacityReached) {
    // 上限到達（初回）: 上限到達日と請求予定日を設定
    const capacityReachedDate = new Date();
    updateData.capacity_reached_date = capacityReachedDate;
    updateData.billing_scheduled_date = calculateBillingScheduledDate(
      capacityReachedDate,
      collectiveBurial.validity_period_years
    );
  } else if (!capacityReached && wasCapacityReached) {
    // 上限を下回った: 日付をリセット
    updateData.capacity_reached_date = null;
    updateData.billing_scheduled_date = null;
  }

  // 4. 合祀情報を更新
  const updated = await prisma.collectiveBurial.update({
    where: { id: collectiveBurial.id },
    data: updateData,
  });

  return updated;
};

/**
 * 合祀情報の埋葬人数が上限に達しているかチェック
 * @param prisma Prismaクライアント
 * @param plotId 区画ID
 * @returns 上限到達フラグ
 */
export const isCapacityReached = async (prisma: PrismaClient, plotId: string): Promise<boolean> => {
  const collectiveBurial = await prisma.collectiveBurial.findUnique({
    where: { physical_plot_id: plotId },
  });

  if (!collectiveBurial || collectiveBurial.deleted_at) {
    return false;
  }

  return collectiveBurial.capacity_reached_date !== null;
};

/**
 * 合祀情報の請求対象を取得
 * @param prisma Prismaクライアント
 * @returns 請求対象の合祀情報リスト
 */
export const getBillingTargets = async (prisma: PrismaClient): Promise<any[]> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // 時刻を0:00:00に設定

  return await prisma.collectiveBurial.findMany({
    where: {
      billing_status: 'pending',
      billing_scheduled_date: {
        lte: today, // 請求予定日が今日以前
      },
      deleted_at: null,
    },
    include: {
      PhysicalPlot: {
        include: {
          ContractPlots: {
            where: { deleted_at: null },
            orderBy: { created_at: 'desc' },
            take: 1, // 最新の契約
            include: {
              SaleContract: {
                include: {
                  SaleContractRoles: {
                    where: { deleted_at: null, is_primary: true },
                    include: {
                      Customer: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
};
