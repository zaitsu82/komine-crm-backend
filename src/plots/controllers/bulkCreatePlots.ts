/**
 * 区画一括登録エンドポイント
 * POST /api/v1/plots/bulk
 *
 * 複数の区画を一件登録（createPlot）と同等のフィールド構成で一括登録します。
 * familyContacts, buriedPersons, constructionInfos も合わせて作成可能。
 *
 * Phase 1 対応 (issue #76):
 * - 全件 1 トランザクション → 1 件ごとの独立トランザクション
 *   （1 行の失敗が他行に波及しない）
 * - familyContacts / buriedPersons / constructionInfos は createManyAndReturn で一括 INSERT
 * - 部分成功レスポンス { totalRequested, succeeded, failed[], results[] }
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AddressType, Gender } from '@prisma/client';
import { CreatePlotRequest } from '@komine/types';
import prisma from '../../db/prisma';
import { ValidationError } from '../../middleware/errorHandler';
import {
  createPlotSchema,
  buriedPersonSchema,
  constructionInfoSchema,
  familyContactSchema,
  gravestoneInfoSchema,
} from '../../validations/plotValidation';
import { createPlotCore } from './createPlot';
import { recordEntityCreated } from '../services/historyService';

/**
 * 一括登録用の単一アイテムバリデーションスキーマ
 */
const bulkCreateItemSchema = createPlotSchema.extend({
  familyContacts: z.array(familyContactSchema).optional(),
  buriedPersons: z.array(buriedPersonSchema).optional(),
  constructionInfos: z.array(constructionInfoSchema.unwrap()).optional(),
  gravestoneInfo: gravestoneInfoSchema,
});

const bulkCreateRequestSchema = z.object({
  items: z
    .array(bulkCreateItemSchema)
    .min(1, '登録データが空です。1件以上のデータを指定してください')
    .max(500, '一括登録は最大500件までです'),
});

export type BulkCreateItem = z.infer<typeof bulkCreateItemSchema>;

type BulkFailure = {
  row: number;
  plotNumber?: string | null;
  error: {
    message: string;
    details?: Array<{ field?: string; message: string }>;
  };
};

type BulkSuccess = {
  row: number;
  id: string;
  physicalPlotId: string;
  plotNumber: string | null;
};

/**
 * 1件分の登録処理（独立トランザクション）
 */
async function createSingleItem(
  item: BulkCreateItem,
  req: Request
): Promise<{ id: string; physicalPlotId: string; plotNumber: string | null }> {
  return prisma.$transaction(
    async (tx) => {
      const { contractPlotId, physicalPlotId } = await createPlotCore(
        tx,
        item as CreatePlotRequest,
        req
      );

      // family contacts — createManyAndReturn で一括 INSERT → 個別に履歴記録
      if (item.familyContacts && item.familyContacts.length > 0) {
        const fcData = item.familyContacts
          .filter((fc) => fc.name && fc.phoneNumber && fc.address && fc.relationship)
          .map((fc) => ({
            contract_plot_id: contractPlotId,
            name: fc.name as string,
            name_kana: fc.nameKana || null,
            relationship: fc.relationship as string,
            address: fc.address as string,
            phone_number: fc.phoneNumber as string,
            phone_number_2: fc.phoneNumber2 || null,
            fax_number: fc.faxNumber || null,
            email: fc.email || null,
            registered_address: fc.registeredAddress || null,
            mailing_type: (fc.mailingType as AddressType) || null,
            work_company_name: fc.workCompanyName || null,
            work_company_name_kana: fc.workCompanyNameKana || null,
            work_address: fc.workAddress || null,
            work_phone_number: fc.workPhoneNumber || null,
            contact_method: fc.contactMethod || null,
            notes: fc.notes || null,
          }));

        if (fcData.length > 0) {
          const created = await tx.familyContact.createManyAndReturn({ data: fcData });
          for (const row of created) {
            await recordEntityCreated(tx, {
              entityType: 'FamilyContact',
              entityId: row.id,
              physicalPlotId,
              contractPlotId,
              afterRecord: { id: row.id, name: row.name },
              req,
            });
          }
        }
      }

      // buried persons
      if (item.buriedPersons && item.buriedPersons.length > 0) {
        const bpData = item.buriedPersons
          .filter((bp) => bp.name)
          .map((bp) => ({
            contract_plot_id: contractPlotId,
            name: bp.name as string,
            name_kana: bp.nameKana || null,
            relationship: bp.relationship || null,
            birth_date: bp.birthDate ? new Date(bp.birthDate) : null,
            death_date: bp.deathDate ? new Date(bp.deathDate) : null,
            age: bp.age ?? null,
            gender: bp.gender === 'male' || bp.gender === 'female' ? (bp.gender as Gender) : null,
            burial_date: bp.burialDate ? new Date(bp.burialDate) : null,
            posthumous_name: bp.posthumousName || null,
            report_date: bp.reportDate ? new Date(bp.reportDate) : null,
            religion: bp.religion || null,
            notes: bp.notes || null,
          }));

        if (bpData.length > 0) {
          const created = await tx.buriedPerson.createManyAndReturn({ data: bpData });
          for (const row of created) {
            await recordEntityCreated(tx, {
              entityType: 'BuriedPerson',
              entityId: row.id,
              physicalPlotId,
              contractPlotId,
              afterRecord: { id: row.id, name: row.name },
              req,
            });
          }
        }
      }

      // construction infos
      if (item.constructionInfos && item.constructionInfos.length > 0) {
        const ciData = item.constructionInfos.map((ci) => ({
          contract_plot_id: contractPlotId,
          construction_type: ci.constructionType || null,
          start_date: ci.startDate ? new Date(ci.startDate) : null,
          completion_date: ci.completionDate ? new Date(ci.completionDate) : null,
          contractor: ci.contractor || null,
          supervisor: ci.supervisor || null,
          progress: ci.progress || null,
          work_item_1: ci.workItem1 || null,
          work_date_1: ci.workDate1 ? new Date(ci.workDate1) : null,
          work_amount_1: ci.workAmount1 ?? null,
          work_status_1: ci.workStatus1 || null,
          work_item_2: ci.workItem2 || null,
          work_date_2: ci.workDate2 ? new Date(ci.workDate2) : null,
          work_amount_2: ci.workAmount2 ?? null,
          work_status_2: ci.workStatus2 || null,
          permit_number: ci.permitNumber || null,
          application_date: ci.applicationDate ? new Date(ci.applicationDate) : null,
          permit_date: ci.permitDate ? new Date(ci.permitDate) : null,
          permit_status: ci.permitStatus || null,
          payment_type_1: ci.paymentType1 || null,
          payment_amount_1: ci.paymentAmount1 ?? null,
          payment_date_1: ci.paymentDate1 ? new Date(ci.paymentDate1) : null,
          payment_status_1: ci.paymentStatus1 || null,
          payment_type_2: ci.paymentType2 || null,
          payment_amount_2: ci.paymentAmount2 ?? null,
          payment_date_2: ci.paymentScheduledDate2 ? new Date(ci.paymentScheduledDate2) : null,
          payment_status_2: ci.paymentStatus2 || null,
          scheduled_end_date: ci.scheduledEndDate ? new Date(ci.scheduledEndDate) : null,
          construction_content: ci.constructionContent || null,
          notes: ci.notes || null,
        }));

        const created = await tx.constructionInfo.createManyAndReturn({ data: ciData });
        for (const row of created) {
          await recordEntityCreated(tx, {
            entityType: 'ConstructionInfo',
            entityId: row.id,
            physicalPlotId,
            contractPlotId,
            afterRecord: { id: row.id, construction_type: row.construction_type },
            req,
          });
        }
      }

      return {
        id: contractPlotId,
        physicalPlotId,
        plotNumber: item.physicalPlot.plotNumber || null,
      };
    },
    { maxWait: 10000, timeout: 30000 }
  );
}

/**
 * 区画一括登録
 * POST /api/v1/plots/bulk
 */
export const bulkCreatePlots = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 1. リクエストボディのバリデーション
    const parseResult = bulkCreateRequestSchema.safeParse(req.body);

    if (!parseResult.success) {
      const details = parseResult.error.issues.map((issue) => ({
        row:
          issue.path[0] === 'items' && typeof issue.path[1] === 'number'
            ? issue.path[1]
            : undefined,
        field: issue.path.length > 2 ? issue.path.slice(2).join('.') : issue.path.join('.'),
        message: issue.message,
      }));

      throw new ValidationError('一括登録でエラーが発生しました', details);
    }

    const { items } = parseResult.data;

    // 事前に「処理対象外」とする行（部分失敗として failed に入れる）
    const preFailures: BulkFailure[] = [];
    const skipRows = new Set<number>();

    // 2. バッチ内の plotNumber 重複 — 後続出現を failed に
    const seenPlotNumbers = new Map<string, number>(); // plotNumber → first-seen-row
    for (let i = 0; i < items.length; i++) {
      const pn = items[i]!.physicalPlot.plotNumber;
      if (!pn) continue;
      if (seenPlotNumbers.has(pn)) {
        preFailures.push({
          row: i,
          plotNumber: pn,
          error: {
            message: `区画番号「${pn}」がバッチ内で重複しています（行 ${seenPlotNumbers.get(pn)} と同じ）`,
            details: [{ field: 'plotNumber', message: `行 ${seenPlotNumbers.get(pn)} と重複` }],
          },
        });
        skipRows.add(i);
      } else {
        seenPlotNumbers.set(pn, i);
      }
    }

    // 3. DB 上の既存区画番号との重複 — 該当行を failed に
    //    新規物理区画（physicalPlot.id 未指定）のみ対象
    const newPlotNumbers = items
      .map((item, idx) => ({
        idx,
        pn: item.physicalPlot.plotNumber,
        hasId: !!item.physicalPlot.id,
      }))
      .filter((x) => x.pn && !x.hasId && !skipRows.has(x.idx));

    if (newPlotNumbers.length > 0) {
      const existingPlots = await prisma.physicalPlot.findMany({
        where: {
          plot_number: { in: newPlotNumbers.map((x) => x.pn as string) },
          deleted_at: null,
        },
        select: { plot_number: true },
      });

      const existingSet = new Set(existingPlots.map((p) => p.plot_number));
      for (const { idx, pn } of newPlotNumbers) {
        if (pn && existingSet.has(pn)) {
          preFailures.push({
            row: idx,
            plotNumber: pn,
            error: {
              message: `区画番号「${pn}」は既にデータベースに存在します`,
              details: [{ field: 'plotNumber', message: '既存区画と重複' }],
            },
          });
          skipRows.add(idx);
        }
      }
    }

    // 4. 1件ずつ独立 tx で処理（失敗が他行に波及しない）
    const successes: BulkSuccess[] = [];
    const failures: BulkFailure[] = [...preFailures];

    for (let i = 0; i < items.length; i++) {
      if (skipRows.has(i)) continue;

      const item = items[i]!;
      try {
        const result = await createSingleItem(item, req);
        successes.push({ row: i, ...result });
      } catch (error) {
        const plotNumber = item.physicalPlot.plotNumber || null;
        if (error instanceof ValidationError) {
          failures.push({
            row: i,
            plotNumber,
            error: {
              message: error.message,
              details: error.details as Array<{ field?: string; message: string }> | undefined,
            },
          });
        } else if (error instanceof Error) {
          failures.push({
            row: i,
            plotNumber,
            error: { message: error.message },
          });
        } else {
          failures.push({
            row: i,
            plotNumber,
            error: { message: '不明なエラーが発生しました' },
          });
        }
      }
    }

    // 5. レスポンス（部分成功許容）
    // 全件失敗時も 201 ではなく 207 相当にしたいところだが、Phase 1 では 201 固定
    res.status(201).json({
      success: true,
      data: {
        totalRequested: items.length,
        succeeded: successes.length,
        failed: failures,
        results: successes,
      },
    });
  } catch (error) {
    next(error);
  }
};
