/**
 * 名義変更エンドポイント
 * POST /api/v1/plots/:id/change-contractor
 *
 * 同一 SaleContract 上で契約者（contractor role）を旧契約者から新契約者へ
 * 交代させる（#310、業務確認 2026-06-07 Q7: 契約はそのままで契約者名だけ
 * 書き換え、履歴情報として残す）。解約→新契約（#110 の区画再利用フロー）とは
 * 別の操作で、契約・申込者（applicant role）・区画情報は不変のまま残る。
 *
 * 設計判断（issue #310 検討事項）:
 * 「現在の契約者」の解決は全箇所 role='contractor' AND deleted_at IS NULL
 * （created_at 昇順）に依存しているため、role 行に有効期間を持たせて現役判定を
 * 変える案は影響範囲が広すぎる。updatePlot の roles 入替と同じ
 * soft-delete + 新規作成方式を採り、旧 role 行には role_end_date を刻んで
 * 保存し、History に change_reason「名義変更」で before/after を記録する。
 * 過去の契約者は History（および soft-delete された role 行）から遡れる。
 */

import { Request, Response, NextFunction } from 'express';
import { ContractRole, ContractStatus, Prisma } from '@prisma/client';
import prisma from '../../db/prisma';
import { NotFoundError, ConflictError, ValidationError } from '../../middleware/errorHandler';
import { recordEntityUpdated } from '../services/historyService';
import { syncPrimaryContractorNameKana } from '../utils';
import type { ChangeContractorRequest, CustomerYuchoInput } from '../../validations/plotValidation';

export const changeContractor = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = (req.params as Record<string, string>)['id'] as string;
    const input = req.body as ChangeContractorRequest;

    // 現契約者の読取り・検証・付け替えを単一の Serializable トランザクションで
    // 原子化する（terminateContract #278 と同方針）。並行する名義変更・解約・
    // フォーム保存（roles 入替）と交錯すると contractor role の二重生成が成立しうる。
    const result = await prisma.$transaction(
      async (tx) => {
        const contractPlot = await tx.contractPlot.findUnique({
          where: { id, deleted_at: null },
          include: {
            saleContractRoles: {
              where: { role: ContractRole.contractor, deleted_at: null },
              include: { customer: true },
              // 「現在の契約者」の選定順は snapshot 同期（#282/#303）と揃える
              orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
            },
          },
        });

        if (!contractPlot) {
          throw new NotFoundError('指定された契約区画が見つかりません');
        }

        // 名義変更は有効な契約（active）のみ対象。空き区画には契約者がおらず、
        // 解約済みは区画再利用フロー（#110: terminate → 新契約）が正規経路。
        if (contractPlot.contract_status !== ContractStatus.active) {
          throw new ConflictError(
            `現在のステータス '${contractPlot.contract_status}' では名義変更できません（active のみ可能）`
          );
        }

        const currentRoles = contractPlot.saleContractRoles;
        if (currentRoles.length === 0) {
          throw new ConflictError('現在の契約者が存在しないため名義変更できません');
        }
        // 複数 contractor role が併存する場合も契約の名義は一括で交代する
        // （updatePlot の roles 全件入替と同じ考え方）。表示上の主契約者は先頭。
        const primaryRole = currentRoles[0]!;

        // 新契約者の解決: 既存顧客の指定 or 新規顧客の作成
        let newCustomer: { id: string; name: string; name_kana: string | null };
        if (input.newCustomerId !== undefined) {
          const existing = await tx.customer.findUnique({
            where: { id: input.newCustomerId, deleted_at: null },
          });
          if (!existing) {
            throw new NotFoundError('指定された顧客が見つかりません');
          }
          // 終了顧客（is_terminated、del_flg=2 由来 #129）は契約者に指定不可
          if (existing.is_terminated) {
            throw new ValidationError('解約済み（終了）顧客は契約者に指定できません');
          }
          if (currentRoles.some((r) => r.customer_id === existing.id)) {
            throw new ConflictError('指定された顧客は既にこの契約の契約者です');
          }
          newCustomer = existing;
        } else {
          // バリデーション（changeContractorSchema の refine）で newCustomer の存在は保証済み
          const nc = input.newCustomer!;
          newCustomer = await tx.customer.create({
            data: {
              name: nc.name,
              name_kana: nc.nameKana,
              birth_date: nc.birthDate ? new Date(nc.birthDate) : null,
              gender: nc.gender || null,
              postal_code: nc.postalCode,
              address: nc.address,
              address_line_2: nc.addressLine2 || null,
              registered_postal_code: nc.registeredPostalCode || null,
              registered_address: nc.registeredAddress || null,
              phone_number: nc.phoneNumber ?? null,
              fax_number: nc.faxNumber || null,
              email: nc.email || null,
              // 振込先情報（ゆうちょ自動払込 CSV 出力用）
              bank_name: nc.bankName || null,
              branch_name: nc.branchName || null,
              account_type: nc.accountType || null,
              account_number: nc.accountNumber || null,
              account_holder: nc.accountHolder || null,
              yucho_symbol: (nc as unknown as CustomerYuchoInput).yuchoSymbol || null,
              yucho_number: (nc as unknown as CustomerYuchoInput).yuchoNumber || null,
              notes: nc.notes || null,
              staff_id: nc.staffId ?? null,
            },
          });
        }

        const changeDate = input.changeDate ? new Date(input.changeDate) : new Date();

        // 旧契約者 role を soft-delete。role_end_date に交代日を刻み、
        // role 行自体からも在任期間を遡れるようにする
        for (const role of currentRoles) {
          await tx.saleContractRole.update({
            where: { id: role.id },
            data: { deleted_at: new Date(), role_end_date: changeDate },
          });
        }

        // 新契約者 role を作成（申込者 role は不変: 申込者 = 最初の契約者のまま残す）
        const newRole = await tx.saleContractRole.create({
          data: {
            contract_plot_id: id,
            customer_id: newCustomer.id,
            role: ContractRole.contractor,
            role_start_date: changeDate,
          },
        });

        // History に change_reason「名義変更」で before/after を記録（過去の契約者を遡る用）
        await recordEntityUpdated(tx, {
          entityType: 'ContractPlot',
          entityId: id,
          physicalPlotId: contractPlot.physical_plot_id,
          contractPlotId: id,
          beforeRecord: {
            contractor_customer_id: primaryRole.customer_id,
            contractor_name: primaryRole.customer.name,
            contractor_name_kana: primaryRole.customer.name_kana,
          },
          afterRecord: {
            contractor_customer_id: newCustomer.id,
            contractor_name: newCustomer.name,
            contractor_name_kana: newCustomer.name_kana,
          },
          changeReason: input.reason ? `名義変更: ${input.reason}` : '名義変更',
          req,
        });

        // 契約者名カナ snapshot（#282/#297）を新契約者で再同期
        await syncPrimaryContractorNameKana(tx, id);

        return {
          oldContractor: {
            customerId: primaryRole.customer_id,
            name: primaryRole.customer.name,
          },
          newContractor: {
            customerId: newCustomer.id,
            name: newCustomer.name,
            roleId: newRole.id,
          },
          changeDate,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    res.status(200).json({
      success: true,
      data: {
        message: '名義変更を実施しました',
        id,
        ...result,
      },
    });
  } catch (error) {
    next(error);
  }
};
