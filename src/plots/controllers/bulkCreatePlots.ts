/**
 * 区画一括登録エンドポイント
 * POST /api/v1/plots/bulk
 *
 * 複数の区画を一件登録（createPlot）と同等のフィールド構成で一括登録します。
 * familyContacts, buriedPersons, constructionInfos も合わせて作成可能。
 * トランザクションによる all-or-nothing 処理。
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
 * createPlotSchema に familyContacts / buriedPersons / constructionInfos / gravestoneInfo を追加
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

    // 2. バッチ内の plotNumber 重複チェック（新規物理区画のみ）
    const plotNumbers = items
      .filter((item) => !item.physicalPlot.id && item.physicalPlot.plotNumber)
      .map((item) => item.physicalPlot.plotNumber as string);

    const duplicatesInBatch = plotNumbers.filter(
      (num, index) => plotNumbers.indexOf(num) !== index
    );

    if (duplicatesInBatch.length > 0) {
      const uniqueDuplicates = [...new Set(duplicatesInBatch)];
      const details = uniqueDuplicates.map((plotNumber) => {
        const rows = items
          .map((item, index) => (item.physicalPlot.plotNumber === plotNumber ? index : -1))
          .filter((index) => index !== -1);
        return {
          row: rows[1],
          field: 'plotNumber',
          message: `区画番号「${plotNumber}」がバッチ内で重複しています（行 ${rows.join(', ')}）`,
        };
      });

      throw new ValidationError('一括登録でエラーが発生しました', details);
    }

    // 3. DB上の既存区画番号との重複チェック
    if (plotNumbers.length > 0) {
      const existingPlots = await prisma.physicalPlot.findMany({
        where: {
          plot_number: { in: plotNumbers },
          deleted_at: null,
        },
        select: { plot_number: true },
      });

      if (existingPlots.length > 0) {
        const existingNumbers = existingPlots.map((p) => p.plot_number);
        const details = existingNumbers.map((plotNumber) => {
          const row = items.findIndex((item) => item.physicalPlot.plotNumber === plotNumber);
          return {
            row,
            field: 'plotNumber',
            message: `区画番号「${plotNumber}」は既にデータベースに存在します`,
          };
        });

        throw new ValidationError('一括登録でエラーが発生しました', details);
      }
    }

    // 4. トランザクションで一括作成
    const createdPlots = await prisma.$transaction(
      async (tx) => {
        const results = [];

        for (let i = 0; i < items.length; i++) {
          const item = items[i]!;

          try {
            const { contractPlotId, physicalPlotId } = await createPlotCore(
              tx,
              item as CreatePlotRequest,
              req
            );

            // 4.1 family contacts（ContractPlot紐付け）
            if (item.familyContacts && item.familyContacts.length > 0) {
              for (const fc of item.familyContacts) {
                // 必須フィールドが揃っていない行はスキップ（DB NOT NULL 制約回避）
                if (!fc.name || !fc.phoneNumber || !fc.address || !fc.relationship) continue;
                const created = await tx.familyContact.create({
                  data: {
                    contract_plot_id: contractPlotId,
                    name: fc.name,
                    name_kana: fc.nameKana || null,
                    relationship: fc.relationship,
                    address: fc.address,
                    phone_number: fc.phoneNumber,
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
                  },
                });
                await recordEntityCreated(tx, {
                  entityType: 'FamilyContact',
                  entityId: created.id,
                  physicalPlotId,
                  contractPlotId,
                  afterRecord: { id: created.id, name: created.name },
                  req,
                });
              }
            }

            // 4.2 buried persons（ContractPlot紐付け）
            if (item.buriedPersons && item.buriedPersons.length > 0) {
              for (const bp of item.buriedPersons) {
                if (!bp.name) continue;
                const created = await tx.buriedPerson.create({
                  data: {
                    contract_plot_id: contractPlotId,
                    name: bp.name,
                    name_kana: bp.nameKana || null,
                    relationship: bp.relationship || null,
                    birth_date: bp.birthDate ? new Date(bp.birthDate) : null,
                    death_date: bp.deathDate ? new Date(bp.deathDate) : null,
                    age: bp.age ?? null,
                    gender:
                      bp.gender === 'male' || bp.gender === 'female' ? (bp.gender as Gender) : null,
                    burial_date: bp.burialDate ? new Date(bp.burialDate) : null,
                    posthumous_name: bp.posthumousName || null,
                    report_date: bp.reportDate ? new Date(bp.reportDate) : null,
                    religion: bp.religion || null,
                    notes: bp.notes || null,
                  },
                });
                await recordEntityCreated(tx, {
                  entityType: 'BuriedPerson',
                  entityId: created.id,
                  physicalPlotId,
                  contractPlotId,
                  afterRecord: { id: created.id, name: created.name },
                  req,
                });
              }
            }

            // 4.3 construction infos（ContractPlot紐付け）
            if (item.constructionInfos && item.constructionInfos.length > 0) {
              for (const ci of item.constructionInfos) {
                const created = await tx.constructionInfo.create({
                  data: {
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
                    payment_date_2: ci.paymentScheduledDate2
                      ? new Date(ci.paymentScheduledDate2)
                      : null,
                    payment_status_2: ci.paymentStatus2 || null,
                    scheduled_end_date: ci.scheduledEndDate ? new Date(ci.scheduledEndDate) : null,
                    construction_content: ci.constructionContent || null,
                    notes: ci.notes || null,
                  },
                });
                await recordEntityCreated(tx, {
                  entityType: 'ConstructionInfo',
                  entityId: created.id,
                  physicalPlotId,
                  contractPlotId,
                  afterRecord: { id: created.id, construction_type: created.construction_type },
                  req,
                });
              }
            }

            results.push({
              row: i,
              id: contractPlotId,
              physicalPlotId,
              plotNumber: item.physicalPlot.plotNumber || null,
            });
          } catch (error) {
            // エラー詳細に行番号を付与して再スロー
            if (error instanceof ValidationError) {
              const details = error.details?.length
                ? error.details.map((d) => ({ ...d, row: i }))
                : [{ row: i, message: error.message }];
              throw new ValidationError(`行 ${i} でエラー: ${error.message}`, details);
            }
            throw error;
          }
        }

        return results;
      },
      {
        maxWait: 10000,
        timeout: 60000,
      }
    );

    res.status(201).json({
      success: true,
      data: {
        totalRequested: items.length,
        created: createdPlots.length,
        results: createdPlots,
      },
    });
  } catch (error) {
    next(error);
  }
};
