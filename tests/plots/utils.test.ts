/**
 * 在庫管理ユーティリティのテスト
 *
 * syncPrimaryContractorNameKana（#282）:
 * 契約者名ソートの DB 側ページングが参照する primary_contractor_name_kana
 * スナップショット列の同期ロジックを固定する。
 */

import { syncPrimaryContractorNameKana } from '../../src/plots/utils';

const buildTx = (roleResult: unknown) =>
  ({
    saleContractRole: {
      findFirst: jest.fn().mockResolvedValue(roleResult),
    },
    contractPlot: {
      update: jest.fn().mockResolvedValue({}),
    },
  }) as any;

describe('syncPrimaryContractorNameKana (#282)', () => {
  it('最初の有効な contractor ロールの name_kana を書き込む', async () => {
    const tx = buildTx({ customer: { name_kana: 'ヤマダタロウ', name: '山田太郎' } });

    await syncPrimaryContractorNameKana(tx, 'cp-1');

    // contractor ロールのみ・削除済み除外・作成順で先頭を選ぶ
    expect(tx.saleContractRole.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { contract_plot_id: 'cp-1', role: 'contractor', deleted_at: null },
        orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
      })
    );
    expect(tx.contractPlot.update).toHaveBeenCalledWith({
      where: { id: 'cp-1' },
      data: { primary_contractor_name_kana: 'ヤマダタロウ' },
    });
  });

  it('name_kana が空文字なら name へフォールバックする', async () => {
    const tx = buildTx({ customer: { name_kana: '', name: '山田太郎' } });

    await syncPrimaryContractorNameKana(tx, 'cp-1');

    expect(tx.contractPlot.update).toHaveBeenCalledWith({
      where: { id: 'cp-1' },
      data: { primary_contractor_name_kana: '山田太郎' },
    });
  });

  it('contractor ロールが無い場合は null を書き込む（一覧で末尾固定）', async () => {
    const tx = buildTx(null);

    await syncPrimaryContractorNameKana(tx, 'cp-1');

    expect(tx.contractPlot.update).toHaveBeenCalledWith({
      where: { id: 'cp-1' },
      data: { primary_contractor_name_kana: null },
    });
  });
});
