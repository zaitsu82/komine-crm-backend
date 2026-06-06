/**
 * 在庫管理ユーティリティのテスト
 *
 * syncPrimaryContractorNameKana（#282）:
 * 契約者名ソートの DB 側ページングが参照する primary_contractor_name_kana
 * スナップショット列の同期ロジックを固定する。
 */

import {
  syncPrimaryContractorNameKana,
  syncContractorNameKanaForCustomer,
} from '../../src/plots/utils';

const buildTx = (roleResult: unknown, roleListResult: unknown[] = []) =>
  ({
    saleContractRole: {
      findFirst: jest.fn().mockResolvedValue(roleResult),
      findMany: jest.fn().mockResolvedValue(roleListResult),
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

describe('syncContractorNameKanaForCustomer (#301)', () => {
  it('顧客を契約者とする全契約区画のスナップショットを再同期する', async () => {
    // 共有契約者: cust-1 が cp-1 / cp-2 / cp-3 の契約者を兼ねる
    const tx = buildTx({ customer: { name_kana: 'ヤマダタロウ', name: '山田太郎' } }, [
      { contract_plot_id: 'cp-1' },
      { contract_plot_id: 'cp-2' },
      { contract_plot_id: 'cp-3' },
    ]);

    await syncContractorNameKanaForCustomer(tx, 'cust-1');

    // 顧客起点で contractor ロールを検索すること
    expect(tx.saleContractRole.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { customer_id: 'cust-1', role: 'contractor', deleted_at: null },
      })
    );
    // 3区画すべての snapshot が更新されること（編集対象以外も陳腐化させない）
    expect(tx.contractPlot.update).toHaveBeenCalledTimes(3);
    for (const id of ['cp-1', 'cp-2', 'cp-3']) {
      expect(tx.contractPlot.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id } })
      );
    }
  });

  it('同一区画の重複ロールは1回だけ再同期する', async () => {
    const tx = buildTx({ customer: { name_kana: 'ヤマダタロウ', name: '山田太郎' } }, [
      { contract_plot_id: 'cp-1' },
      { contract_plot_id: 'cp-1' },
    ]);

    await syncContractorNameKanaForCustomer(tx, 'cust-1');

    expect(tx.contractPlot.update).toHaveBeenCalledTimes(1);
  });

  it('contractor ロールを持たない顧客（申込者のみ等）では何も更新しない', async () => {
    const tx = buildTx(null, []);

    await syncContractorNameKanaForCustomer(tx, 'cust-1');

    expect(tx.contractPlot.update).not.toHaveBeenCalled();
  });
});
