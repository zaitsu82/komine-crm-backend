import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { PlotListItem, plotInfo } from '../type';

const prisma = new PrismaClient();

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
