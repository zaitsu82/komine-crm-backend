/**
 * 契約解約エンドポイント
 * POST /api/v1/plots/:id/terminate
 *
 * active 状態の ContractPlot を terminated（解約）に遷移させる（#236）。
 * deletePlot（論理削除）と異なり deleted_at は触らないため、解約後も
 * 履歴・詳細・一覧から参照でき、誤操作時は restoreContract で復活できる。
 * reason は履歴に記録するため必須。
 */

import { Request, Response, NextFunction } from 'express';
import { ContractStatus } from '@prisma/client';
import prisma from '../../db/prisma';
import { NotFoundError, ConflictError } from '../../middleware/errorHandler';
import { recordEntityUpdated } from '../services/historyService';
import { contractStatusService } from '../services/contractStatusService';
import { updatePhysicalPlotStatus } from '../utils';
import type { TerminateContractRequest } from '../../validations/plotValidation';

export const terminateContract = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = (req.params as Record<string, string>)['id'] as string;
    const { reason } = req.body as TerminateContractRequest;

    const contractPlot = await prisma.contractPlot.findUnique({
      where: { id, deleted_at: null },
    });

    if (!contractPlot) {
      throw new NotFoundError('指定された契約区画が見つかりません');
    }

    const beforeStatus = contractPlot.contract_status;

    // 解約エンドポイントは active 状態のみ受け付ける
    if (beforeStatus !== ContractStatus.active) {
      throw new ConflictError(
        `現在のステータス '${beforeStatus}' から解約はできません（active のみ解約可能）`
      );
    }

    // サービス層の遷移定義（active → terminated）と整合させる
    contractStatusService.validateTransition(beforeStatus, ContractStatus.terminated);

    await prisma.$transaction(async (tx) => {
      await tx.contractPlot.update({
        where: { id },
        data: { contract_status: ContractStatus.terminated },
      });

      // active 契約が外れるため物理区画ステータスを再計算する（restore #210 と対称）
      await updatePhysicalPlotStatus(tx, contractPlot.physical_plot_id);

      await recordEntityUpdated(tx, {
        entityType: 'ContractPlot',
        entityId: id,
        physicalPlotId: contractPlot.physical_plot_id,
        contractPlotId: id,
        beforeRecord: { contract_status: beforeStatus },
        afterRecord: { contract_status: ContractStatus.terminated },
        changeReason: reason,
        req,
      });
    });

    res.status(200).json({
      success: true,
      data: {
        message: '契約区画を解約しました',
        id,
        contractStatus: ContractStatus.terminated,
      },
    });
  } catch (error) {
    next(error);
  }
};
