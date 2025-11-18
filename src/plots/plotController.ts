import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { PlotListItem, plotInfo, CreatePlotInput, UpdatePlotInput } from '../type';
import {
  detectChangedFields,
  getIpAddress,
  createHistoryRecord,
  hasChanges,
} from '../utils/historyUtils';

const prisma = new PrismaClient();

/**
 * 日付文字列をDateオブジェクトに変換するヘルパー関数
 */
const parseDate = (date: Date | string | null | undefined): Date | null => {
  if (!date) return null;
  if (date instanceof Date) return date;
  return new Date(date);
};

/**
 * 区画情報一覧取得
 * GET /api/v1/plots
 */
export const getPlots = async (_req: Request, res: Response) => {
  try {
    const plots = await prisma.plot.findMany({
      where: {
        deleted_at: null, // 論理削除されていない区画のみ
      },
      include: {
        Applicant: true,
        Contractors: {
          where: { deleted_at: null },
          orderBy: { created_at: 'desc' },
          take: 1, // 最新の契約者のみ
        },
        BuriedPersons: {
          where: { deleted_at: null },
        },
        ManagementFee: true,
      },
      orderBy: {
        plot_number: 'asc',
      },
    });

    const plotList: PlotListItem[] = plots.map((plot) => {
      const latestContractor = plot.Contractors[0];
      const buriedPersonCount = plot.BuriedPersons.length;

      // 次回請求日の計算（last_billing_monthから1ヶ月後を計算）
      let nextBillingDate: Date | null = null;
      if (plot.ManagementFee?.last_billing_month) {
        const match = plot.ManagementFee.last_billing_month.match(/(\d{4})年(\d{1,2})月/);
        if (match && match[1] && match[2]) {
          const year = parseInt(match[1]);
          const month = parseInt(match[2]);
          const nextDate = new Date(year, month, 1); // 次の月の1日
          nextBillingDate = nextDate;
        }
      }

      return {
        id: plot.id,
        plotNumber: plot.plot_number,
        contractorName: latestContractor?.name || null,
        contractorAddress: latestContractor?.address || null,
        applicantName: plot.Applicant?.name || null,
        buriedPersonCount,
        contractorPhoneNumber: latestContractor?.phone_number || null,
        nextBillingDate,
        notes: plot.notes || null,
      };
    });

    res.status(200).json({
      success: true,
      data: plotList,
    });
  } catch (error) {
    console.error('Error fetching plots:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '区画情報の取得に失敗しました',
      },
    });
  }
};

/**
 * 区画情報詳細取得
 * GET /api/v1/plots/:id?includeHistory=true&historyLimit=50
 */
export const getPlotById = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { includeHistory, historyLimit } = req.query;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'IDが指定されていません',
          details: [],
        },
      });
    }

    // historyLimitのバリデーション（デフォルト: 50、最大: 200）
    const limit = historyLimit
      ? Math.min(Math.max(parseInt(historyLimit as string, 10), 1), 200)
      : 50;

    const plot = await prisma.plot.findUnique({
      where: { id },
      include: {
        Applicant: true,
        Contractors: {
          where: { deleted_at: null },
          include: {
            WorkInfo: true,
            BillingInfo: true,
          },
          orderBy: { created_at: 'desc' },
          take: 1, // 最新の契約者のみ
        },
        UsageFee: true,
        ManagementFee: true,
        GravestoneInfo: true,
        ConstructionInfo: true,
        FamilyContacts: {
          where: { deleted_at: null },
        },
        EmergencyContact: true,
        BuriedPersons: {
          where: { deleted_at: null },
        },
      },
    });

    if (!plot || plot.deleted_at) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '指定された区画が見つかりません',
        },
      });
    }

    const latestContractor = plot.Contractors[0];

    // plotInfo型に変換
    const plotData: plotInfo = {
      id: plot.id,
      plotNumber: plot.plot_number,
      section: plot.section,
      usage: plot.usage as 'in_use' | 'available' | 'reserved',
      size: plot.size,
      price: plot.price,
      contractDate: plot.contract_date,
      applicantInfo: plot.Applicant
        ? {
            id: plot.Applicant.id,
            applicationDate: plot.Applicant.application_date,
            staffName: plot.Applicant.staff_name,
            name: plot.Applicant.name,
            nameKana: plot.Applicant.name_kana,
            postalCode: plot.Applicant.postal_code,
            phoneNumber: plot.Applicant.phone_number,
            address: plot.Applicant.address,
          }
        : undefined,
      contractInfo: latestContractor
        ? {
            id: latestContractor.id,
            reservationDate: latestContractor.reservation_date,
            acceptanceNumber: latestContractor.acceptance_number || undefined,
            permitDate: latestContractor.permit_date,
            startDate: latestContractor.start_date,
            name: latestContractor.name,
            nameKana: latestContractor.name_kana,
            birthDate: latestContractor.birth_date,
            gender: latestContractor.gender as 'male' | 'female' | undefined,
            phoneNumber: latestContractor.phone_number,
            faxNumber: latestContractor.fax_number || undefined,
            email: latestContractor.email || undefined,
            address: latestContractor.address,
            registeredAddress: latestContractor.registered_address || undefined,
          }
        : undefined,
      usageFee: plot.UsageFee
        ? {
            id: plot.UsageFee.id,
            calculationType: plot.UsageFee.calculation_type,
            taxType: plot.UsageFee.tax_type,
            billingType: plot.UsageFee.billing_type,
            billingYears: plot.UsageFee.billing_years,
            area: plot.UsageFee.area,
            unitPrice: plot.UsageFee.unit_price,
            usageFee: plot.UsageFee.usage_fee,
            paymentMethod: plot.UsageFee.payment_method,
          }
        : undefined,
      managementFee: plot.ManagementFee
        ? {
            id: plot.ManagementFee.id,
            calculationType: plot.ManagementFee.calculation_type,
            taxType: plot.ManagementFee.tax_type,
            billingType: plot.ManagementFee.billing_type,
            billingYears: plot.ManagementFee.billing_years,
            area: plot.ManagementFee.area,
            billingMonth: plot.ManagementFee.billing_month,
            managementFee: plot.ManagementFee.management_fee,
            unitPrice: plot.ManagementFee.unit_price,
            lastBillingMonth: plot.ManagementFee.last_billing_month,
            paymentMethod: plot.ManagementFee.payment_method,
          }
        : undefined,
      gravestoneInfo: plot.GravestoneInfo
        ? {
            id: plot.GravestoneInfo.id,
            gravestoneBase: plot.GravestoneInfo.gravestone_base,
            enclosurePosition: plot.GravestoneInfo.enclosure_position,
            gravestoneDealer: plot.GravestoneInfo.gravestone_dealer,
            gravestoneType: plot.GravestoneInfo.gravestone_type,
            surroundingArea: plot.GravestoneInfo.surrounding_area,
            establishmentDeadline: plot.GravestoneInfo.establishment_deadline,
            establishmentDate: plot.GravestoneInfo.establishment_date,
          }
        : undefined,
      constructionInfo: plot.ConstructionInfo
        ? {
            id: plot.ConstructionInfo.id,
            constructionType: plot.ConstructionInfo.construction_type || undefined,
            startDate: plot.ConstructionInfo.start_date,
            completionDate: plot.ConstructionInfo.completion_date,
            contractor: plot.ConstructionInfo.contractor || undefined,
            supervisor: plot.ConstructionInfo.supervisor || undefined,
            progress: plot.ConstructionInfo.progress || undefined,
            workItem1: plot.ConstructionInfo.work_item_1 || undefined,
            workDate1: plot.ConstructionInfo.work_date_1,
            workAmount1: plot.ConstructionInfo.work_amount_1
              ? Number(plot.ConstructionInfo.work_amount_1)
              : undefined,
            workStatus1: plot.ConstructionInfo.work_status_1 || undefined,
            workItem2: plot.ConstructionInfo.work_item_2 || undefined,
            workDate2: plot.ConstructionInfo.work_date_2,
            workAmount2: plot.ConstructionInfo.work_amount_2
              ? Number(plot.ConstructionInfo.work_amount_2)
              : undefined,
            workStatus2: plot.ConstructionInfo.work_status_2 || undefined,
            permitNumber: plot.ConstructionInfo.permit_number || undefined,
            applicationDate: plot.ConstructionInfo.application_date,
            permitDate: plot.ConstructionInfo.permit_date,
            permitStatus: plot.ConstructionInfo.permit_status || undefined,
            paymentType1: plot.ConstructionInfo.payment_type_1 || undefined,
            paymentAmount1: plot.ConstructionInfo.payment_amount_1
              ? Number(plot.ConstructionInfo.payment_amount_1)
              : undefined,
            paymentDate1: plot.ConstructionInfo.payment_date_1,
            paymentStatus1: plot.ConstructionInfo.payment_status_1 || undefined,
            paymentType2: plot.ConstructionInfo.payment_type_2 || undefined,
            paymentAmount2: plot.ConstructionInfo.payment_amount_2
              ? Number(plot.ConstructionInfo.payment_amount_2)
              : undefined,
            paymentScheduledDate2: plot.ConstructionInfo.payment_scheduled_date_2,
            paymentStatus2: plot.ConstructionInfo.payment_status_2 || undefined,
            constructionNotes: plot.ConstructionInfo.construction_notes || undefined,
          }
        : undefined,
      familyContacts: plot.FamilyContacts.map((fc) => ({
        id: fc.id,
        name: fc.name,
        birthDate: fc.birth_date,
        relationship: fc.relationship,
        address: fc.address,
        phoneNumber: fc.phone_number,
        faxNumber: fc.fax_number || undefined,
        email: fc.email || undefined,
        registeredAddress: fc.registered_address || undefined,
        mailingType: fc.mailing_type as 'home' | 'work' | 'other' | undefined,
        companyName: fc.company_name || undefined,
        companyNameKana: fc.company_name_kana || undefined,
        companyAddress: fc.company_address || undefined,
        companyPhone: fc.company_phone || undefined,
        notes: fc.notes || undefined,
      })),
      emergencyContact: plot.EmergencyContact
        ? {
            id: plot.EmergencyContact.id,
            name: plot.EmergencyContact.name,
            relationship: plot.EmergencyContact.relationship,
            phoneNumber: plot.EmergencyContact.phone_number,
          }
        : null,
      buriedPersons: plot.BuriedPersons.map((bp) => ({
        id: bp.id,
        name: bp.name,
        nameKana: bp.name_kana || undefined,
        relationship: bp.relationship || undefined,
        deathDate: bp.death_date,
        age: bp.age || undefined,
        gender: bp.gender as 'male' | 'female' | undefined,
        burialDate: bp.burial_date,
        memo: bp.memo || undefined,
      })),
      workInfo: latestContractor?.WorkInfo
        ? {
            id: latestContractor.WorkInfo.id,
            companyName: latestContractor.WorkInfo.company_name,
            companyNameKana: latestContractor.WorkInfo.company_name_kana,
            workAddress: latestContractor.WorkInfo.work_address,
            workPostalCode: latestContractor.WorkInfo.work_postal_code,
            workPhoneNumber: latestContractor.WorkInfo.work_phone_number,
            dmSetting: latestContractor.WorkInfo.dm_setting as 'allow' | 'deny' | 'limited',
            addressType: latestContractor.WorkInfo.address_type as 'home' | 'work' | 'other',
            notes: latestContractor.WorkInfo.notes || '',
          }
        : undefined,
      billingInfo: latestContractor?.BillingInfo
        ? {
            id: latestContractor.BillingInfo.id,
            billingType: latestContractor.BillingInfo.billing_type as
              | 'individual'
              | 'corporate'
              | 'bank_transfer',
            bankName: latestContractor.BillingInfo.bank_name,
            branchName: latestContractor.BillingInfo.branch_name,
            accountType: latestContractor.BillingInfo.account_type as
              | 'ordinary'
              | 'current'
              | 'savings',
            accountNumber: latestContractor.BillingInfo.account_number,
            accountHolder: latestContractor.BillingInfo.account_holder,
          }
        : undefined,
      createdAt: plot.created_at,
      updatedAt: plot.updated_at,
      status: plot.status as 'active' | 'inactive',
    };

    // 履歴データの取得（includeHistory=trueの場合のみ）
    if (includeHistory === 'true') {
      const histories = await prisma.history.findMany({
        where: {
          plot_id: id,
        },
        orderBy: {
          created_at: 'desc',
        },
        take: limit,
      });

      // 履歴データを整形してレスポンスに追加
      const formattedHistories = histories.map((h) => ({
        id: h.id,
        entity_type: h.entity_type,
        entity_id: h.entity_id,
        plot_id: h.plot_id,
        action_type: h.action_type,
        changed_fields: h.changed_fields,
        changed_by: h.changed_by,
        change_reason: h.change_reason,
        ip_address: h.ip_address,
        created_at: h.created_at,
      }));

      // plotDataに履歴を追加
      (plotData as any).history = formattedHistories;
    }

    res.status(200).json({
      success: true,
      data: plotData,
    });
  } catch (error) {
    console.error('Error fetching plot by id:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '区画情報の取得に失敗しました',
      },
    });
  }
};

/**
 * 区画情報登録
 * POST /api/v1/plots
 */
export const createPlot = async (req: Request, res: Response): Promise<any> => {
  try {
    const input: CreatePlotInput = req.body;

    // 必須項目のバリデーション
    if (!input.plot) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '区画基本情報は必須です',
          details: [{ field: 'plot', message: '区画基本情報を入力してください' }],
        },
      });
    }

    const { plotNumber, section, usage, size, price } = input.plot;

    if (!plotNumber || !section || !usage || !size || !price) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '区画基本情報の必須項目が不足しています',
          details: [
            { field: 'plotNumber', message: '区画番号は必須です' },
            { field: 'section', message: '区域は必須です' },
            { field: 'usage', message: '利用状況は必須です' },
            { field: 'size', message: '面積は必須です' },
            { field: 'price', message: '金額は必須です' },
          ],
        },
      });
    }

    // 区画番号の重複チェック
    const existingPlot = await prisma.plot.findUnique({
      where: { plot_number: plotNumber },
    });

    if (existingPlot) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_PLOT_NUMBER',
          message: '区画番号が既に存在します',
          details: [
            { field: 'plotNumber', message: `区画番号 ${plotNumber} は既に使用されています` },
          ],
        },
      });
    }

    // 契約者に依存するデータのバリデーション
    if ((input.workInfo || input.billingInfo) && !input.contractor) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '契約者情報がない場合、勤務先・請求情報は登録できません',
          details: [],
        },
      });
    }

    // トランザクション処理で一括登録
    const result = await prisma.$transaction(async (tx) => {
      // 1. Plot作成（必須）
      const plot = await tx.plot.create({
        data: {
          plot_number: plotNumber,
          section,
          usage,
          size,
          price,
          contract_date: parseDate(input.plot.contractDate),
          status: input.plot.status || 'active',
          notes: input.plot.notes || null,
        },
      });

      // 2. Applicant作成（任意）
      if (input.applicant) {
        await tx.applicant.create({
          data: {
            plot_id: plot.id, // ★外部キー設定
            application_date: parseDate(input.applicant.applicationDate),
            staff_name: input.applicant.staffName,
            name: input.applicant.name,
            name_kana: input.applicant.nameKana,
            postal_code: input.applicant.postalCode,
            phone_number: input.applicant.phoneNumber,
            address: input.applicant.address,
          },
        });
      }

      // 3. Contractor作成（任意）
      let contractor = null;
      if (input.contractor) {
        contractor = await tx.contractor.create({
          data: {
            plot_id: plot.id, // ★外部キー設定
            reservation_date: parseDate(input.contractor.reservationDate),
            acceptance_number: input.contractor.acceptanceNumber || null,
            permit_date: parseDate(input.contractor.permitDate),
            start_date: parseDate(input.contractor.startDate),
            name: input.contractor.name,
            name_kana: input.contractor.nameKana,
            birth_date: parseDate(input.contractor.birthDate),
            gender: input.contractor.gender || null,
            phone_number: input.contractor.phoneNumber,
            fax_number: input.contractor.faxNumber || null,
            email: input.contractor.email || null,
            address: input.contractor.address,
            registered_address: input.contractor.registeredAddress || null,
          },
        });
      }

      // 4. UsageFee作成（任意）
      if (input.usageFee) {
        await tx.usageFee.create({
          data: {
            plot_id: plot.id, // ★外部キー設定
            calculation_type: input.usageFee.calculationType,
            tax_type: input.usageFee.taxType,
            billing_type: input.usageFee.billingType,
            billing_years: input.usageFee.billingYears,
            area: input.usageFee.area,
            unit_price: input.usageFee.unitPrice,
            usage_fee: input.usageFee.usageFee,
            payment_method: input.usageFee.paymentMethod,
          },
        });
      }

      // 5. ManagementFee作成（任意）
      if (input.managementFee) {
        await tx.managementFee.create({
          data: {
            plot_id: plot.id, // ★外部キー設定
            calculation_type: input.managementFee.calculationType,
            tax_type: input.managementFee.taxType,
            billing_type: input.managementFee.billingType,
            billing_years: input.managementFee.billingYears,
            area: input.managementFee.area,
            billing_month: input.managementFee.billingMonth,
            management_fee: input.managementFee.managementFee,
            unit_price: input.managementFee.unitPrice,
            last_billing_month: input.managementFee.lastBillingMonth,
            payment_method: input.managementFee.paymentMethod,
          },
        });
      }

      // 6. GravestoneInfo作成（任意）
      if (input.gravestoneInfo) {
        await tx.gravestoneInfo.create({
          data: {
            plot_id: plot.id, // ★外部キー設定
            gravestone_base: input.gravestoneInfo.gravestoneBase,
            enclosure_position: input.gravestoneInfo.enclosurePosition,
            gravestone_dealer: input.gravestoneInfo.gravestoneDealer,
            gravestone_type: input.gravestoneInfo.gravestoneType,
            surrounding_area: input.gravestoneInfo.surroundingArea,
            establishment_deadline: parseDate(input.gravestoneInfo.establishmentDeadline),
            establishment_date: parseDate(input.gravestoneInfo.establishmentDate),
          },
        });
      }

      // 6-2. ConstructionInfo作成（任意）
      if (input.constructionInfo) {
        await tx.constructionInfo.create({
          data: {
            plot_id: plot.id, // ★外部キー設定
            construction_type: input.constructionInfo.constructionType || null,
            start_date: parseDate(input.constructionInfo.startDate),
            completion_date: parseDate(input.constructionInfo.completionDate),
            contractor: input.constructionInfo.contractor || null,
            supervisor: input.constructionInfo.supervisor || null,
            progress: input.constructionInfo.progress || null,
            work_item_1: input.constructionInfo.workItem1 || null,
            work_date_1: parseDate(input.constructionInfo.workDate1),
            work_amount_1: input.constructionInfo.workAmount1 || null,
            work_status_1: input.constructionInfo.workStatus1 || null,
            work_item_2: input.constructionInfo.workItem2 || null,
            work_date_2: parseDate(input.constructionInfo.workDate2),
            work_amount_2: input.constructionInfo.workAmount2 || null,
            work_status_2: input.constructionInfo.workStatus2 || null,
            permit_number: input.constructionInfo.permitNumber || null,
            application_date: parseDate(input.constructionInfo.applicationDate),
            permit_date: parseDate(input.constructionInfo.permitDate),
            permit_status: input.constructionInfo.permitStatus || null,
            payment_type_1: input.constructionInfo.paymentType1 || null,
            payment_amount_1: input.constructionInfo.paymentAmount1 || null,
            payment_date_1: parseDate(input.constructionInfo.paymentDate1),
            payment_status_1: input.constructionInfo.paymentStatus1 || null,
            payment_type_2: input.constructionInfo.paymentType2 || null,
            payment_amount_2: input.constructionInfo.paymentAmount2 || null,
            payment_scheduled_date_2: parseDate(input.constructionInfo.paymentScheduledDate2),
            payment_status_2: input.constructionInfo.paymentStatus2 || null,
            construction_notes: input.constructionInfo.constructionNotes || null,
          },
        });
      }

      // 7. FamilyContact作成（配列・任意）
      if (input.familyContacts && input.familyContacts.length > 0) {
        for (const fc of input.familyContacts) {
          await tx.familyContact.create({
            data: {
              plot_id: plot.id, // ★外部キー設定
              name: fc.name,
              birth_date: parseDate(fc.birthDate),
              relationship: fc.relationship,
              address: fc.address,
              phone_number: fc.phoneNumber,
              fax_number: fc.faxNumber || null,
              email: fc.email || null,
              registered_address: fc.registeredAddress || null,
              mailing_type: fc.mailingType || null,
              company_name: fc.companyName || null,
              company_name_kana: fc.companyNameKana || null,
              company_address: fc.companyAddress || null,
              company_phone: fc.companyPhone || null,
              notes: fc.notes || null,
            },
          });
        }
      }

      // 8. EmergencyContact作成（任意）
      if (input.emergencyContact) {
        await tx.emergencyContact.create({
          data: {
            plot_id: plot.id, // ★外部キー設定
            name: input.emergencyContact.name,
            relationship: input.emergencyContact.relationship,
            phone_number: input.emergencyContact.phoneNumber,
          },
        });
      }

      // 9. BuriedPerson作成（配列・任意）
      if (input.buriedPersons && input.buriedPersons.length > 0) {
        for (const bp of input.buriedPersons) {
          await tx.buriedPerson.create({
            data: {
              plot_id: plot.id, // ★外部キー設定
              name: bp.name,
              name_kana: bp.nameKana || null,
              relationship: bp.relationship || null,
              death_date: parseDate(bp.deathDate),
              age: bp.age || null,
              gender: bp.gender || null,
              burial_date: parseDate(bp.burialDate),
              memo: bp.memo || null,
            },
          });
        }
      }

      // 10. WorkInfo作成（任意、契約者に依存）
      if (input.workInfo && contractor) {
        await tx.workInfo.create({
          data: {
            contractor_id: contractor.id, // ★外部キー設定（contractor_id）
            company_name: input.workInfo.companyName,
            company_name_kana: input.workInfo.companyNameKana,
            work_address: input.workInfo.workAddress,
            work_postal_code: input.workInfo.workPostalCode,
            work_phone_number: input.workInfo.workPhoneNumber,
            dm_setting: input.workInfo.dmSetting,
            address_type: input.workInfo.addressType,
            notes: input.workInfo.notes || null,
          },
        });
      }

      // 11. BillingInfo作成（任意、契約者に依存）
      if (input.billingInfo && contractor) {
        await tx.billingInfo.create({
          data: {
            contractor_id: contractor.id, // ★外部キー設定（contractor_id）
            billing_type: input.billingInfo.billingType,
            bank_name: input.billingInfo.bankName,
            branch_name: input.billingInfo.branchName,
            account_type: input.billingInfo.accountType,
            account_number: input.billingInfo.accountNumber,
            account_holder: input.billingInfo.accountHolder,
          },
        });
      }

      // 12. History作成（履歴記録）
      const historyData = createHistoryRecord({
        entityType: 'Plot',
        entityId: plot.id,
        plotId: plot.id,
        actionType: 'CREATE',
        changedFields: null, // CREATEの場合はnull
        changedBy: req.user?.id.toString() || 'unknown',
        changeReason: null, // CREATEの場合は変更理由なし
        ipAddress: getIpAddress(req),
      });

      await tx.history.create({
        data: historyData,
      });

      return plot;
    });

    res.status(201).json({
      success: true,
      data: {
        id: result.id,
        plotNumber: result.plot_number,
        message: '区画情報を登録しました',
      },
    });
  } catch (error: any) {
    console.error('Error creating plot:', error);

    // Prismaの一意制約違反エラー
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_ERROR',
          message: '重複するデータが存在します',
          details: [],
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '区画情報の登録に失敗しました',
        details: [],
      },
    });
  }
};

/**
 * 区画情報更新
 * PUT /api/v1/plots/:id
 */
export const updatePlot = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'IDが指定されていません',
          details: [],
        },
      });
    }
    const input: UpdatePlotInput = req.body;

    // 1. 区画の存在確認
    const existingPlot = await prisma.plot.findUnique({
      where: { id },
      include: {
        Applicant: true,
        Contractors: {
          where: { deleted_at: null },
          include: {
            WorkInfo: true,
            BillingInfo: true,
          },
          orderBy: { created_at: 'desc' },
          take: 1,
        },
        UsageFee: true,
        ManagementFee: true,
        GravestoneInfo: true,
        ConstructionInfo: true,
        EmergencyContact: true,
        FamilyContacts: {
          where: { deleted_at: null },
        },
        BuriedPersons: {
          where: { deleted_at: null },
        },
      },
    });

    if (!existingPlot || existingPlot.deleted_at) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '指定された区画が見つかりません',
        },
      });
    }

    // 2. 区画番号の重複チェック（自分以外）
    if (input.plot?.plotNumber && input.plot.plotNumber !== existingPlot.plot_number) {
      const duplicatePlot = await prisma.plot.findUnique({
        where: { plot_number: input.plot.plotNumber },
      });

      if (duplicatePlot) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'DUPLICATE_PLOT_NUMBER',
            message: '区画番号が既に存在します',
            details: [
              {
                field: 'plotNumber',
                message: `区画番号 ${input.plot.plotNumber} は既に使用されています`,
              },
            ],
          },
        });
      }
    }

    // 3. 契約者に依存するデータのバリデーション
    const hasContractor = existingPlot.Contractors.length > 0;
    if ((input.workInfo || input.billingInfo) && !hasContractor && !input.contractor) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '契約者情報がない場合、勤務先・請求情報は登録できません',
          details: [],
        },
      });
    }

    // 4. トランザクション処理で一括更新
    const result = await prisma.$transaction(async (tx) => {
      // 更新前のデータ全体を取得（履歴用）
      const beforeData = {
        plot: {
          plot_number: existingPlot.plot_number,
          section: existingPlot.section,
          usage: existingPlot.usage,
          size: existingPlot.size,
          price: existingPlot.price,
          contract_date: existingPlot.contract_date,
          status: existingPlot.status,
          notes: existingPlot.notes,
        },
      };
      // 4-1. Plot基本情報の更新
      if (input.plot) {
        const updateData: any = {};
        if (input.plot.plotNumber !== undefined) {
          updateData.plot_number = input.plot.plotNumber;
        }
        if (input.plot.section !== undefined) {
          updateData.section = input.plot.section;
        }
        if (input.plot.usage !== undefined) {
          updateData.usage = input.plot.usage;
        }
        if (input.plot.size !== undefined) {
          updateData.size = input.plot.size;
        }
        if (input.plot.price !== undefined) {
          updateData.price = input.plot.price;
        }
        if (input.plot.contractDate !== undefined) {
          updateData.contract_date = parseDate(input.plot.contractDate);
        }
        if (input.plot.status !== undefined) {
          updateData.status = input.plot.status;
        }
        if (input.plot.notes !== undefined) {
          updateData.notes = input.plot.notes;
        }

        if (Object.keys(updateData).length > 0) {
          await tx.plot.update({
            where: { id },
            data: updateData,
          });
        }
      }

      // 4-2. Applicant（申込者）の更新・作成・削除
      if (input.applicant !== undefined) {
        if (input.applicant === null) {
          // 削除（論理削除）
          if (existingPlot.Applicant) {
            await tx.applicant.update({
              where: { id: existingPlot.Applicant.id },
              data: { deleted_at: new Date() },
            });
          }
        } else {
          const applicantData: any = {};
          if (input.applicant.applicationDate !== undefined) {
            applicantData.application_date = parseDate(input.applicant.applicationDate);
          }
          if (input.applicant.staffName !== undefined) {
            applicantData.staff_name = input.applicant.staffName;
          }
          if (input.applicant.name !== undefined) {
            applicantData.name = input.applicant.name;
          }
          if (input.applicant.nameKana !== undefined) {
            applicantData.name_kana = input.applicant.nameKana;
          }
          if (input.applicant.postalCode !== undefined) {
            applicantData.postal_code = input.applicant.postalCode;
          }
          if (input.applicant.phoneNumber !== undefined) {
            applicantData.phone_number = input.applicant.phoneNumber;
          }
          if (input.applicant.address !== undefined) {
            applicantData.address = input.applicant.address;
          }

          if (Object.keys(applicantData).length > 0) {
            if (existingPlot.Applicant) {
              // 更新
              await tx.applicant.update({
                where: { id: existingPlot.Applicant.id },
                data: applicantData,
              });
            } else {
              // 新規作成
              await tx.applicant.create({
                data: {
                  plot_id: id,
                  ...applicantData,
                },
              });
            }
          }
        }
      }

      // 4-3. Contractor（契約者）の更新
      const latestContractor = existingPlot.Contractors[0];
      let contractorId = latestContractor?.id;

      if (input.contractor && latestContractor) {
        const contractorData: any = {};
        if (input.contractor.reservationDate !== undefined) {
          contractorData.reservation_date = parseDate(input.contractor.reservationDate);
        }
        if (input.contractor.acceptanceNumber !== undefined) {
          contractorData.acceptance_number = input.contractor.acceptanceNumber;
        }
        if (input.contractor.permitDate !== undefined) {
          contractorData.permit_date = parseDate(input.contractor.permitDate);
        }
        if (input.contractor.startDate !== undefined) {
          contractorData.start_date = parseDate(input.contractor.startDate);
        }
        if (input.contractor.name !== undefined) {
          contractorData.name = input.contractor.name;
        }
        if (input.contractor.nameKana !== undefined) {
          contractorData.name_kana = input.contractor.nameKana;
        }
        if (input.contractor.birthDate !== undefined) {
          contractorData.birth_date = parseDate(input.contractor.birthDate);
        }
        if (input.contractor.gender !== undefined) {
          contractorData.gender = input.contractor.gender;
        }
        if (input.contractor.phoneNumber !== undefined) {
          contractorData.phone_number = input.contractor.phoneNumber;
        }
        if (input.contractor.faxNumber !== undefined) {
          contractorData.fax_number = input.contractor.faxNumber;
        }
        if (input.contractor.email !== undefined) {
          contractorData.email = input.contractor.email;
        }
        if (input.contractor.address !== undefined) {
          contractorData.address = input.contractor.address;
        }
        if (input.contractor.registeredAddress !== undefined) {
          contractorData.registered_address = input.contractor.registeredAddress;
        }

        if (Object.keys(contractorData).length > 0) {
          await tx.contractor.update({
            where: { id: contractorId },
            data: contractorData,
          });
        }
      } else if (input.contractor && !latestContractor) {
        // 契約者が存在しない場合は新規作成
        const newContractor = await tx.contractor.create({
          data: {
            plot_id: id,
            reservation_date: parseDate(input.contractor.reservationDate),
            acceptance_number: input.contractor.acceptanceNumber || null,
            permit_date: parseDate(input.contractor.permitDate),
            start_date: parseDate(input.contractor.startDate),
            name: input.contractor.name || '',
            name_kana: input.contractor.nameKana || '',
            birth_date: parseDate(input.contractor.birthDate),
            gender: input.contractor.gender || null,
            phone_number: input.contractor.phoneNumber || '',
            fax_number: input.contractor.faxNumber || null,
            email: input.contractor.email || null,
            address: input.contractor.address || '',
            registered_address: input.contractor.registeredAddress || null,
          },
        });
        contractorId = newContractor.id;
      }

      // 4-4. UsageFee（使用料）のupsert
      if (input.usageFee !== undefined) {
        if (input.usageFee === null) {
          // 削除
          if (existingPlot.UsageFee) {
            await tx.usageFee.update({
              where: { id: existingPlot.UsageFee.id },
              data: { deleted_at: new Date() },
            });
          }
        } else {
          const usageFeeData: any = {};
          if (input.usageFee.calculationType !== undefined) {
            usageFeeData.calculation_type = input.usageFee.calculationType;
          }
          if (input.usageFee.taxType !== undefined) {
            usageFeeData.tax_type = input.usageFee.taxType;
          }
          if (input.usageFee.billingType !== undefined) {
            usageFeeData.billing_type = input.usageFee.billingType;
          }
          if (input.usageFee.billingYears !== undefined) {
            usageFeeData.billing_years = input.usageFee.billingYears;
          }
          if (input.usageFee.area !== undefined) {
            usageFeeData.area = input.usageFee.area;
          }
          if (input.usageFee.unitPrice !== undefined) {
            usageFeeData.unit_price = input.usageFee.unitPrice;
          }
          if (input.usageFee.usageFee !== undefined) {
            usageFeeData.usage_fee = input.usageFee.usageFee;
          }
          if (input.usageFee.paymentMethod !== undefined) {
            usageFeeData.payment_method = input.usageFee.paymentMethod;
          }

          if (Object.keys(usageFeeData).length > 0) {
            if (existingPlot.UsageFee) {
              await tx.usageFee.update({
                where: { id: existingPlot.UsageFee.id },
                data: usageFeeData,
              });
            } else {
              await tx.usageFee.create({
                data: {
                  plot_id: id,
                  ...usageFeeData,
                },
              });
            }
          }
        }
      }

      // 4-5. ManagementFee（管理料）のupsert
      if (input.managementFee !== undefined) {
        if (input.managementFee === null) {
          // 削除
          if (existingPlot.ManagementFee) {
            await tx.managementFee.update({
              where: { id: existingPlot.ManagementFee.id },
              data: { deleted_at: new Date() },
            });
          }
        } else {
          const managementFeeData: any = {};
          if (input.managementFee.calculationType !== undefined) {
            managementFeeData.calculation_type = input.managementFee.calculationType;
          }
          if (input.managementFee.taxType !== undefined) {
            managementFeeData.tax_type = input.managementFee.taxType;
          }
          if (input.managementFee.billingType !== undefined) {
            managementFeeData.billing_type = input.managementFee.billingType;
          }
          if (input.managementFee.billingYears !== undefined) {
            managementFeeData.billing_years = input.managementFee.billingYears;
          }
          if (input.managementFee.area !== undefined) {
            managementFeeData.area = input.managementFee.area;
          }
          if (input.managementFee.billingMonth !== undefined) {
            managementFeeData.billing_month = input.managementFee.billingMonth;
          }
          if (input.managementFee.managementFee !== undefined) {
            managementFeeData.management_fee = input.managementFee.managementFee;
          }
          if (input.managementFee.unitPrice !== undefined) {
            managementFeeData.unit_price = input.managementFee.unitPrice;
          }
          if (input.managementFee.lastBillingMonth !== undefined) {
            managementFeeData.last_billing_month = input.managementFee.lastBillingMonth;
          }
          if (input.managementFee.paymentMethod !== undefined) {
            managementFeeData.payment_method = input.managementFee.paymentMethod;
          }

          if (Object.keys(managementFeeData).length > 0) {
            if (existingPlot.ManagementFee) {
              await tx.managementFee.update({
                where: { id: existingPlot.ManagementFee.id },
                data: managementFeeData,
              });
            } else {
              await tx.managementFee.create({
                data: {
                  plot_id: id,
                  ...managementFeeData,
                },
              });
            }
          }
        }
      }

      // 4-6. GravestoneInfo（墓石情報）のupsert
      if (input.gravestoneInfo !== undefined) {
        if (input.gravestoneInfo === null) {
          // 削除
          if (existingPlot.GravestoneInfo) {
            await tx.gravestoneInfo.update({
              where: { id: existingPlot.GravestoneInfo.id },
              data: { deleted_at: new Date() },
            });
          }
        } else {
          const gravestoneInfoData: any = {};
          if (input.gravestoneInfo.gravestoneBase !== undefined) {
            gravestoneInfoData.gravestone_base = input.gravestoneInfo.gravestoneBase;
          }
          if (input.gravestoneInfo.enclosurePosition !== undefined) {
            gravestoneInfoData.enclosure_position = input.gravestoneInfo.enclosurePosition;
          }
          if (input.gravestoneInfo.gravestoneDealer !== undefined) {
            gravestoneInfoData.gravestone_dealer = input.gravestoneInfo.gravestoneDealer;
          }
          if (input.gravestoneInfo.gravestoneType !== undefined) {
            gravestoneInfoData.gravestone_type = input.gravestoneInfo.gravestoneType;
          }
          if (input.gravestoneInfo.surroundingArea !== undefined) {
            gravestoneInfoData.surrounding_area = input.gravestoneInfo.surroundingArea;
          }
          if (input.gravestoneInfo.establishmentDeadline !== undefined) {
            gravestoneInfoData.establishment_deadline = parseDate(
              input.gravestoneInfo.establishmentDeadline
            );
          }
          if (input.gravestoneInfo.establishmentDate !== undefined) {
            gravestoneInfoData.establishment_date = parseDate(
              input.gravestoneInfo.establishmentDate
            );
          }

          if (Object.keys(gravestoneInfoData).length > 0) {
            if (existingPlot.GravestoneInfo) {
              await tx.gravestoneInfo.update({
                where: { id: existingPlot.GravestoneInfo.id },
                data: gravestoneInfoData,
              });
            } else {
              await tx.gravestoneInfo.create({
                data: {
                  plot_id: id,
                  ...gravestoneInfoData,
                },
              });
            }
          }
        }
      }

      // 4-6-2. ConstructionInfo（工事情報）のupsert
      if (input.constructionInfo !== undefined) {
        if (input.constructionInfo === null) {
          // 削除
          if (existingPlot.ConstructionInfo) {
            await tx.constructionInfo.update({
              where: { id: existingPlot.ConstructionInfo.id },
              data: { deleted_at: new Date() },
            });
          }
        } else {
          const constructionInfoData: any = {};
          if (input.constructionInfo.constructionType !== undefined) {
            constructionInfoData.construction_type = input.constructionInfo.constructionType;
          }
          if (input.constructionInfo.startDate !== undefined) {
            constructionInfoData.start_date = parseDate(input.constructionInfo.startDate);
          }
          if (input.constructionInfo.completionDate !== undefined) {
            constructionInfoData.completion_date = parseDate(input.constructionInfo.completionDate);
          }
          if (input.constructionInfo.contractor !== undefined) {
            constructionInfoData.contractor = input.constructionInfo.contractor;
          }
          if (input.constructionInfo.supervisor !== undefined) {
            constructionInfoData.supervisor = input.constructionInfo.supervisor;
          }
          if (input.constructionInfo.progress !== undefined) {
            constructionInfoData.progress = input.constructionInfo.progress;
          }
          if (input.constructionInfo.workItem1 !== undefined) {
            constructionInfoData.work_item_1 = input.constructionInfo.workItem1;
          }
          if (input.constructionInfo.workDate1 !== undefined) {
            constructionInfoData.work_date_1 = parseDate(input.constructionInfo.workDate1);
          }
          if (input.constructionInfo.workAmount1 !== undefined) {
            constructionInfoData.work_amount_1 = input.constructionInfo.workAmount1;
          }
          if (input.constructionInfo.workStatus1 !== undefined) {
            constructionInfoData.work_status_1 = input.constructionInfo.workStatus1;
          }
          if (input.constructionInfo.workItem2 !== undefined) {
            constructionInfoData.work_item_2 = input.constructionInfo.workItem2;
          }
          if (input.constructionInfo.workDate2 !== undefined) {
            constructionInfoData.work_date_2 = parseDate(input.constructionInfo.workDate2);
          }
          if (input.constructionInfo.workAmount2 !== undefined) {
            constructionInfoData.work_amount_2 = input.constructionInfo.workAmount2;
          }
          if (input.constructionInfo.workStatus2 !== undefined) {
            constructionInfoData.work_status_2 = input.constructionInfo.workStatus2;
          }
          if (input.constructionInfo.permitNumber !== undefined) {
            constructionInfoData.permit_number = input.constructionInfo.permitNumber;
          }
          if (input.constructionInfo.applicationDate !== undefined) {
            constructionInfoData.application_date = parseDate(
              input.constructionInfo.applicationDate
            );
          }
          if (input.constructionInfo.permitDate !== undefined) {
            constructionInfoData.permit_date = parseDate(input.constructionInfo.permitDate);
          }
          if (input.constructionInfo.permitStatus !== undefined) {
            constructionInfoData.permit_status = input.constructionInfo.permitStatus;
          }
          if (input.constructionInfo.paymentType1 !== undefined) {
            constructionInfoData.payment_type_1 = input.constructionInfo.paymentType1;
          }
          if (input.constructionInfo.paymentAmount1 !== undefined) {
            constructionInfoData.payment_amount_1 = input.constructionInfo.paymentAmount1;
          }
          if (input.constructionInfo.paymentDate1 !== undefined) {
            constructionInfoData.payment_date_1 = parseDate(input.constructionInfo.paymentDate1);
          }
          if (input.constructionInfo.paymentStatus1 !== undefined) {
            constructionInfoData.payment_status_1 = input.constructionInfo.paymentStatus1;
          }
          if (input.constructionInfo.paymentType2 !== undefined) {
            constructionInfoData.payment_type_2 = input.constructionInfo.paymentType2;
          }
          if (input.constructionInfo.paymentAmount2 !== undefined) {
            constructionInfoData.payment_amount_2 = input.constructionInfo.paymentAmount2;
          }
          if (input.constructionInfo.paymentScheduledDate2 !== undefined) {
            constructionInfoData.payment_scheduled_date_2 = parseDate(
              input.constructionInfo.paymentScheduledDate2
            );
          }
          if (input.constructionInfo.paymentStatus2 !== undefined) {
            constructionInfoData.payment_status_2 = input.constructionInfo.paymentStatus2;
          }
          if (input.constructionInfo.constructionNotes !== undefined) {
            constructionInfoData.construction_notes = input.constructionInfo.constructionNotes;
          }

          if (Object.keys(constructionInfoData).length > 0) {
            if (existingPlot.ConstructionInfo) {
              await tx.constructionInfo.update({
                where: { id: existingPlot.ConstructionInfo.id },
                data: constructionInfoData,
              });
            } else {
              await tx.constructionInfo.create({
                data: {
                  plot_id: id,
                  ...constructionInfoData,
                },
              });
            }
          }
        }
      }

      // 4-7. EmergencyContact（緊急連絡先）のupsert
      if (input.emergencyContact !== undefined) {
        if (input.emergencyContact === null) {
          // 削除
          if (existingPlot.EmergencyContact) {
            await tx.emergencyContact.update({
              where: { id: existingPlot.EmergencyContact.id },
              data: { deleted_at: new Date() },
            });
          }
        } else {
          const emergencyContactData: any = {};
          if (input.emergencyContact.name !== undefined) {
            emergencyContactData.name = input.emergencyContact.name;
          }
          if (input.emergencyContact.relationship !== undefined) {
            emergencyContactData.relationship = input.emergencyContact.relationship;
          }
          if (input.emergencyContact.phoneNumber !== undefined) {
            emergencyContactData.phone_number = input.emergencyContact.phoneNumber;
          }

          if (Object.keys(emergencyContactData).length > 0) {
            if (existingPlot.EmergencyContact) {
              await tx.emergencyContact.update({
                where: { id: existingPlot.EmergencyContact.id },
                data: emergencyContactData,
              });
            } else {
              await tx.emergencyContact.create({
                data: {
                  plot_id: id,
                  ...emergencyContactData,
                },
              });
            }
          }
        }
      }

      // 4-8. FamilyContacts（家族連絡先）の差分更新
      if (input.familyContacts !== undefined) {
        for (const contact of input.familyContacts) {
          if (contact._delete && contact.id) {
            // 削除フラグが立っている場合は論理削除
            await tx.familyContact.update({
              where: { id: contact.id },
              data: { deleted_at: new Date() },
            });
          } else if (contact.id) {
            // 既存データの更新
            const contactData: any = {};
            if (contact.name !== undefined) contactData.name = contact.name;
            if (contact.birthDate !== undefined)
              contactData.birth_date = parseDate(contact.birthDate);
            if (contact.relationship !== undefined) contactData.relationship = contact.relationship;
            if (contact.address !== undefined) contactData.address = contact.address;
            if (contact.phoneNumber !== undefined) contactData.phone_number = contact.phoneNumber;
            if (contact.faxNumber !== undefined) contactData.fax_number = contact.faxNumber;
            if (contact.email !== undefined) contactData.email = contact.email;
            if (contact.registeredAddress !== undefined)
              contactData.registered_address = contact.registeredAddress;
            if (contact.mailingType !== undefined) contactData.mailing_type = contact.mailingType;
            if (contact.companyName !== undefined) contactData.company_name = contact.companyName;
            if (contact.companyNameKana !== undefined)
              contactData.company_name_kana = contact.companyNameKana;
            if (contact.companyAddress !== undefined)
              contactData.company_address = contact.companyAddress;
            if (contact.companyPhone !== undefined)
              contactData.company_phone = contact.companyPhone;
            if (contact.notes !== undefined) contactData.notes = contact.notes;

            if (Object.keys(contactData).length > 0) {
              await tx.familyContact.update({
                where: { id: contact.id },
                data: contactData,
              });
            }
          } else {
            // 新規作成
            await tx.familyContact.create({
              data: {
                plot_id: id,
                name: contact.name || '',
                birth_date: parseDate(contact.birthDate),
                relationship: contact.relationship || '',
                address: contact.address || '',
                phone_number: contact.phoneNumber || '',
                fax_number: contact.faxNumber || null,
                email: contact.email || null,
                registered_address: contact.registeredAddress || null,
                mailing_type: contact.mailingType || null,
                company_name: contact.companyName || null,
                company_name_kana: contact.companyNameKana || null,
                company_address: contact.companyAddress || null,
                company_phone: contact.companyPhone || null,
                notes: contact.notes || null,
              },
            });
          }
        }
      }

      // 4-9. BuriedPersons（埋葬者）の差分更新
      if (input.buriedPersons !== undefined) {
        for (const person of input.buriedPersons) {
          if (person._delete && person.id) {
            // 削除フラグが立っている場合は論理削除
            await tx.buriedPerson.update({
              where: { id: person.id },
              data: { deleted_at: new Date() },
            });
          } else if (person.id) {
            // 既存データの更新
            const personData: any = {};
            if (person.name !== undefined) personData.name = person.name;
            if (person.nameKana !== undefined) personData.name_kana = person.nameKana;
            if (person.relationship !== undefined) personData.relationship = person.relationship;
            if (person.deathDate !== undefined) personData.death_date = parseDate(person.deathDate);
            if (person.age !== undefined) personData.age = person.age;
            if (person.gender !== undefined) personData.gender = person.gender;
            if (person.burialDate !== undefined)
              personData.burial_date = parseDate(person.burialDate);
            if (person.memo !== undefined) personData.memo = person.memo;

            if (Object.keys(personData).length > 0) {
              await tx.buriedPerson.update({
                where: { id: person.id },
                data: personData,
              });
            }
          } else {
            // 新規作成
            await tx.buriedPerson.create({
              data: {
                plot_id: id,
                name: person.name || '',
                name_kana: person.nameKana || null,
                relationship: person.relationship || null,
                death_date: parseDate(person.deathDate),
                age: person.age || null,
                gender: person.gender || null,
                burial_date: parseDate(person.burialDate),
                memo: person.memo || null,
              },
            });
          }
        }
      }

      // 4-10. WorkInfo（勤務先情報）のupsert（契約者に依存）
      if (input.workInfo !== undefined && contractorId) {
        const existingWorkInfo = latestContractor?.WorkInfo;

        if (input.workInfo === null) {
          // 削除
          if (existingWorkInfo) {
            await tx.workInfo.update({
              where: { id: existingWorkInfo.id },
              data: { deleted_at: new Date() },
            });
          }
        } else {
          const workInfoData: any = {};
          if (input.workInfo.companyName !== undefined)
            workInfoData.company_name = input.workInfo.companyName;
          if (input.workInfo.companyNameKana !== undefined)
            workInfoData.company_name_kana = input.workInfo.companyNameKana;
          if (input.workInfo.workAddress !== undefined)
            workInfoData.work_address = input.workInfo.workAddress;
          if (input.workInfo.workPostalCode !== undefined)
            workInfoData.work_postal_code = input.workInfo.workPostalCode;
          if (input.workInfo.workPhoneNumber !== undefined)
            workInfoData.work_phone_number = input.workInfo.workPhoneNumber;
          if (input.workInfo.dmSetting !== undefined)
            workInfoData.dm_setting = input.workInfo.dmSetting;
          if (input.workInfo.addressType !== undefined)
            workInfoData.address_type = input.workInfo.addressType;
          if (input.workInfo.notes !== undefined) workInfoData.notes = input.workInfo.notes;

          if (Object.keys(workInfoData).length > 0) {
            if (existingWorkInfo) {
              await tx.workInfo.update({
                where: { id: existingWorkInfo.id },
                data: workInfoData,
              });
            } else {
              await tx.workInfo.create({
                data: {
                  contractor_id: contractorId,
                  ...workInfoData,
                },
              });
            }
          }
        }
      }

      // 4-11. BillingInfo（請求情報）のupsert（契約者に依存）
      if (input.billingInfo !== undefined && contractorId) {
        const existingBillingInfo = latestContractor?.BillingInfo;

        if (input.billingInfo === null) {
          // 削除
          if (existingBillingInfo) {
            await tx.billingInfo.update({
              where: { id: existingBillingInfo.id },
              data: { deleted_at: new Date() },
            });
          }
        } else {
          const billingInfoData: any = {};
          if (input.billingInfo.billingType !== undefined)
            billingInfoData.billing_type = input.billingInfo.billingType;
          if (input.billingInfo.bankName !== undefined)
            billingInfoData.bank_name = input.billingInfo.bankName;
          if (input.billingInfo.branchName !== undefined)
            billingInfoData.branch_name = input.billingInfo.branchName;
          if (input.billingInfo.accountType !== undefined)
            billingInfoData.account_type = input.billingInfo.accountType;
          if (input.billingInfo.accountNumber !== undefined)
            billingInfoData.account_number = input.billingInfo.accountNumber;
          if (input.billingInfo.accountHolder !== undefined)
            billingInfoData.account_holder = input.billingInfo.accountHolder;

          if (Object.keys(billingInfoData).length > 0) {
            if (existingBillingInfo) {
              await tx.billingInfo.update({
                where: { id: existingBillingInfo.id },
                data: billingInfoData,
              });
            } else {
              await tx.billingInfo.create({
                data: {
                  contractor_id: contractorId,
                  ...billingInfoData,
                },
              });
            }
          }
        }
      }

      // 更新後のデータを取得
      const updatedPlot = await tx.plot.findUnique({
        where: { id },
      });

      // 更新後のデータを構築（履歴用）
      const afterData = {
        plot: {
          plot_number: updatedPlot!.plot_number,
          section: updatedPlot!.section,
          usage: updatedPlot!.usage,
          size: updatedPlot!.size,
          price: updatedPlot!.price,
          contract_date: updatedPlot!.contract_date,
          status: updatedPlot!.status,
          notes: updatedPlot!.notes,
        },
      };

      // 変更フィールドを検出
      const changedFields = detectChangedFields(beforeData.plot, afterData.plot);

      // 4-12. History作成（変更があった場合のみ）
      if (hasChanges(changedFields)) {
        const historyData = createHistoryRecord({
          entityType: 'Plot',
          entityId: id,
          plotId: id,
          actionType: 'UPDATE',
          changedFields,
          changedBy: req.user?.id.toString() || 'unknown',
          changeReason: input.changeReason || null,
          ipAddress: getIpAddress(req),
        });

        await tx.history.create({
          data: historyData,
        });
      }

      return updatedPlot;
    });

    res.status(200).json({
      success: true,
      data: {
        id: result!.id,
        plotNumber: result!.plot_number,
        message: '区画情報を更新しました',
      },
    });
  } catch (error: any) {
    console.error('Error updating plot:', error);

    // Prismaの一意制約違反エラー
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_ERROR',
          message: '重複するデータが存在します',
          details: [],
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '区画情報の更新に失敗しました',
        details: [],
      },
    });
  }
};
