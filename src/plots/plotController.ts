import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { PlotListItem, plotInfo, CreatePlotInput } from '../type';

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
export const getPlots = async (req: Request, res: Response) => {
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
        if (match) {
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
 * GET /api/v1/plots/:id
 */
export const getPlotById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

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
export const createPlot = async (req: Request, res: Response) => {
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
          details: [{ field: 'plotNumber', message: `区画番号 ${plotNumber} は既に使用されています` }],
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
      await tx.history.create({
        data: {
          entity_type: 'Plot',
          entity_id: plot.id,
          plot_id: plot.id, // ★外部キー設定
          action_type: 'CREATE',
          changed_fields: ['plot_number', 'section', 'usage', 'size', 'price'],
          changed_by: req.user?.name || 'システム',
          change_reason: '新規区画登録',
          ip_address: req.ip || req.connection.remoteAddress || null,
        },
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
