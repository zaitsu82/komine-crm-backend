/**
 * 契約復活エンドポイント
 * POST /api/v1/plots/:id/restore
 *
 * terminated 状態の ContractPlot を active に戻す（誤操作リカバリ用）。
 * reason は履歴に記録するため必須。
 */

import { Request, Response, NextFunction } from 'express';
import { ContractStatus } from '@prisma/client';
import prisma from '../../db/prisma';
import { NotFoundError, ConflictError } from '../../middleware/errorHandler';
import { recordEntityUpdated } from '../services/historyService';
import { contractStatusService } from '../services/contractStatusService';
import type { RestoreContractRequest } from '../../validations/plotValidation';

export const restoreContract = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = (req.params as Record<string, string>)['id'] as string;
    const { reason } = req.body as RestoreContractRequest;

    const contractPlot = await prisma.contractPlot.findUnique({
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
    contractStatusService.validateTransitionWithReason(beforeStatus, ContractStatus.active, reason);

    await prisma.$transaction(async (tx) => {
      await tx.contractPlot.update({
        where: { id },
        data: { contract_status: ContractStatus.active },
      });

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
    });

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
