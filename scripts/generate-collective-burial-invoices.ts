/**
 * 合祀情報請求バッチ処理
 *
 * このスクリプトは、請求予定日が到来した合祀情報に対して請求処理を実行します。
 *
 * 実行方法:
 *   npm run billing:generate
 *
 * 処理内容:
 *   1. billing_status='pending' かつ billing_scheduled_date <= 今日 の合祀情報を抽出
 *   2. 各対象に対して請求情報を生成（現時点ではステータス更新のみ）
 *   3. billing_statusを'billed'に更新
 */

import { PrismaClient } from '@prisma/client';
import { getBillingTargets } from '../src/utils/collectiveBurialUtils';

const prisma = new PrismaClient();

interface BillingResult {
  success: boolean;
  collectiveBurialId: string;
  plotId: string;
  contractorName: string | null;
  billingAmount: number | null;
  error?: string;
}

/**
 * 請求処理のメイン実行関数
 */
async function generateCollectiveBurialInvoices(): Promise<void> {
  console.log('='.repeat(60));
  console.log('合祀情報請求バッチ処理を開始します');
  console.log(`実行日時: ${new Date().toLocaleString('ja-JP')}`);
  console.log('='.repeat(60));

  try {
    // 1. 請求対象を取得
    console.log('\n[STEP 1] 請求対象を抽出中...');
    const targets = await getBillingTargets(prisma);

    if (targets.length === 0) {
      console.log('✓ 請求対象が見つかりませんでした。');
      console.log('\n処理を正常終了します。');
      return;
    }

    console.log(`✓ ${targets.length}件の請求対象が見つかりました。\n`);

    // 2. 各対象に対して請求処理を実行
    console.log('[STEP 2] 請求処理を実行中...');
    const results: BillingResult[] = [];

    for (const target of targets) {
      const result = await processBilling(target);
      results.push(result);

      if (result.success) {
        console.log(
          `  ✓ [成功] 区画ID: ${result.plotId} | 契約者: ${result.contractorName || '未設定'} | 金額: ¥${result.billingAmount?.toLocaleString() || '未設定'}`
        );
      } else {
        console.error(`  ✗ [失敗] 区画ID: ${result.plotId} | エラー: ${result.error}`);
      }
    }

    // 3. 処理結果サマリー
    console.log('\n' + '='.repeat(60));
    console.log('[処理結果サマリー]');
    console.log(`  総件数: ${results.length}件`);
    console.log(`  成功: ${results.filter((r) => r.success).length}件`);
    console.log(`  失敗: ${results.filter((r) => !r.success).length}件`);
    console.log('='.repeat(60));

    // 失敗があった場合は詳細を表示
    const failures = results.filter((r) => !r.success);
    if (failures.length > 0) {
      console.log('\n[失敗詳細]');
      failures.forEach((f, index) => {
        console.log(`  ${index + 1}. 区画ID: ${f.plotId}`);
        console.log(`     エラー: ${f.error}`);
      });
      process.exit(1); // 失敗があればエラーコードで終了
    }

    console.log('\n✓ 請求処理が正常に完了しました。');
  } catch (error) {
    console.error('\n✗ 予期しないエラーが発生しました:');
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * 個別の請求処理
 * @param target 請求対象の合祀情報
 * @returns 処理結果
 */
async function processBilling(target: any): Promise<BillingResult> {
  const collectiveBurialId = target.id;
  const plotId = target.plot_id;
  const contractor = target.Plot?.Contractors?.[0]; // 最新の契約者
  const contractorName = contractor?.name || null;
  const billingAmount = target.billing_amount ? Number(target.billing_amount) : null;

  try {
    // トランザクション内で請求処理を実行
    await prisma.$transaction(async (tx) => {
      // 合祀情報のステータスを'billed'に更新
      await tx.collectiveBurial.update({
        where: { id: collectiveBurialId },
        data: {
          billing_status: 'billed',
          updated_at: new Date(),
        },
      });

      // TODO: 将来的には以下の処理を追加:
      // - 請求書テーブルへのレコード挿入
      // - 請求書PDF生成
      // - メール通知送信
      // - 外部会計システムへの連携
    });

    return {
      success: true,
      collectiveBurialId,
      plotId,
      contractorName,
      billingAmount,
    };
  } catch (error) {
    return {
      success: false,
      collectiveBurialId,
      plotId,
      contractorName,
      billingAmount,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// スクリプト実行
if (require.main === module) {
  generateCollectiveBurialInvoices()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { generateCollectiveBurialInvoices, processBilling };
