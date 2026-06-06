/**
 * 契約復活エンドポイント
 * POST /api/v1/plots/:id/restore
 *
 * terminated 状態の ContractPlot を active に戻す（誤操作リカバリ用）。
 * reason は履歴に記録するため必須。
 */

import { Request, Response, NextFunction } from 'express';
import { ContractStatus, Prisma } from '@prisma/client';
import prisma from '../../db/prisma';
import { NotFoundError, ConflictError } from '../../middleware/errorHandler';
import { recordEntityUpdated } from '../services/historyService';
import { contractStatusService } from '../services/contractStatusService';
import { updatePhysicalPlotStatus, validateContractArea } from '../utils';
import type { RestoreContractRequest } from '../../validations/plotValidation';

export const restoreContract = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = (req.params as Record<string, string>)['id'] as string;
    const { reason } = req.body as RestoreContractRequest;

    // 現在ステータスの読取り・検証・更新を単一の Serializable トランザクションで
    // 原子化する（#278）。tx 外で読んだ状態を前提に更新すると、復活の2連打や
    // 並行する解約・契約追加と交錯して二重遷移・過剰割当が成立しうる。
    await prisma.$transaction(
      async (tx) => {
        const contractPlot = await tx.contractPlot.findUnique({
          where: { id, deleted_at: null },
        });

        if (!contractPlot) {
          throw new NotFoundError('指定された契約区画が見つかりません');
        }

        const beforeStatus = contractPlot.contract_status;

        // 復活エンドポイントは terminated 状態のみ受け付ける（vacant→active 等は通常 PUT を使う）
        if (beforeStatus !== ContractStatus.terminated) {
          throw new ConflictError(
            `現在のステータス '${beforeStatus}' から復活はできません（terminated のみ復活可能）`
          );
        }

        // 復活遷移＋reason 必須の整合性を保証
        contractStatusService.validateTransitionWithReason(
          beforeStatus,
          ContractStatus.active,
          reason
        );
        // 復活面積が物理区画の空きに収まるか検証する（#270）。
        // 解約で空いた面積に別契約が販売されている場合（A解約→B販売→A復活）、
        // 無検証で active に戻すと物理面積を超える過剰割当が成立してしまう。
        // 自分自身は terminated のため集計外だが、明示的に除外して将来の状態変更に備える。
        const areaValidation = await validateContractArea(
          tx,
          contractPlot.physical_plot_id,
          Number(contractPlot.contract_area_sqm),
          id
        );
        if (!areaValidation.isValid) {
          throw new ConflictError(
            `契約面積が物理区画の空き面積を超えるため復活できません: ${areaValidation.message ?? ''}` +
              `（復活には他契約の解約または面積の調整が必要です）`
          );
        }

        await tx.contractPlot.update({
          where: { id },
          data: { contract_status: ContractStatus.active },
        });

        // 物理区画ステータスを再計算する（#210）。
        // 解約時に available 等へ戻った PhysicalPlot.status を据え置くと、
        // 在庫サマリー（plot.status 基準で集計）に復活分が反映されず過大表示になる。
        // create/update/delete 系コントローラと同様に復活でも再計算する。
        await updatePhysicalPlotStatus(tx, contractPlot.physical_plot_id);

        await recordEntityUpdated(tx, {
          entityType: 'ContractPlot',
          entityId: id,
          physicalPlotId: contractPlot.physical_plot_id,
          contractPlotId: id,
          beforeRecord: { contract_status: beforeStatus },
          afterRecord: { contract_status: ContractStatus.active },
          changeReason: reason,
          req,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    res.status(200).json({
      success: true,
      data: {
        message: '契約区画を復活しました',
        id,
        contractStatus: ContractStatus.active,
      },
    });
  } catch (error) {
    next(error);
  }
};
