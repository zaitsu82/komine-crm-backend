/**
 * 契約区画詳細取得コントローラー
 * GET /api/v1/plots/:id
 */

import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 契約区画詳細取得（ContractPlot中心）
 * GET /api/v1/plots/:id?includeHistory=true&historyLimit=50
 */
export const getPlotById = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const includeHistory = req.query['includeHistory'] === 'true';
    const historyLimit = parseInt((req.query['historyLimit'] as string) || '50');

    const contractPlot = await prisma.contractPlot.findUnique({
      where: { id },
      include: {
        PhysicalPlot: {
          include: {
            BuriedPersons: {
              where: { deleted_at: null },
              orderBy: { created_at: 'desc' },
            },
            FamilyContacts: {
              where: { deleted_at: null },
              orderBy: { created_at: 'desc' },
            },
            EmergencyContact: true,
            GravestoneInfo: true,
            ConstructionInfo: true,
            CollectiveBurial: true,
          },
        },
        SaleContract: {
          include: {
            Customer: {
              include: {
                WorkInfo: true,
                BillingInfo: true,
              },
            },
          },
        },
        UsageFee: true,
        ManagementFee: true,
      },
    });

    if (!contractPlot || contractPlot.deleted_at) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '契約区画が見つかりません',
        },
      });
    }

    // 履歴情報取得（オプション）
    let histories: any[] = [];
    if (includeHistory) {
      histories = await prisma.history.findMany({
        where: {
          entity_type: 'ContractPlot',
          entity_id: id,
        },
        orderBy: {
          created_at: 'desc',
        },
        take: historyLimit,
      });
    }

    const response: any = {
      // 契約区画基本情報
      id: contractPlot.id,
      contractAreaSqm: contractPlot.contract_area_sqm.toNumber(),
      saleStatus: contractPlot.sale_status,
      locationDescription: contractPlot.location_description,
      createdAt: contractPlot.created_at,
      updatedAt: contractPlot.updated_at,

      // 物理区画情報
      physicalPlot: {
        id: contractPlot.PhysicalPlot.id,
        plotNumber: contractPlot.PhysicalPlot.plot_number,
        areaName: contractPlot.PhysicalPlot.area_name,
        areaSqm: contractPlot.PhysicalPlot.area_sqm.toNumber(),
        status: contractPlot.PhysicalPlot.status,
        notes: contractPlot.PhysicalPlot.notes,
      },

      // 販売契約情報
      saleContract: contractPlot.SaleContract
        ? {
            id: contractPlot.SaleContract.id,
            contractDate: contractPlot.SaleContract.contract_date,
            price: contractPlot.SaleContract.price.toNumber(),
            paymentStatus: contractPlot.SaleContract.payment_status,
            customerRole: contractPlot.SaleContract.customer_role,
            reservationDate: contractPlot.SaleContract.reservation_date,
            acceptanceNumber: contractPlot.SaleContract.acceptance_number,
            permitDate: contractPlot.SaleContract.permit_date,
            startDate: contractPlot.SaleContract.start_date,
            notes: contractPlot.SaleContract.notes,

            // 顧客情報
            customer: {
              id: contractPlot.SaleContract.Customer.id,
              name: contractPlot.SaleContract.Customer.name,
              nameKana: contractPlot.SaleContract.Customer.name_kana,
              gender: contractPlot.SaleContract.Customer.gender,
              birthDate: contractPlot.SaleContract.Customer.birth_date,
              phoneNumber: contractPlot.SaleContract.Customer.phone_number,
              faxNumber: contractPlot.SaleContract.Customer.fax_number,
              email: contractPlot.SaleContract.Customer.email,
              postalCode: contractPlot.SaleContract.Customer.postal_code,
              address: contractPlot.SaleContract.Customer.address,
              registeredAddress: contractPlot.SaleContract.Customer.registered_address,
              notes: contractPlot.SaleContract.Customer.notes,

              // 勤務先情報
              workInfo: contractPlot.SaleContract.Customer.WorkInfo
                ? {
                    companyName: contractPlot.SaleContract.Customer.WorkInfo.company_name,
                    companyNameKana: contractPlot.SaleContract.Customer.WorkInfo.company_name_kana,
                    workAddress: contractPlot.SaleContract.Customer.WorkInfo.work_address,
                    workPostalCode: contractPlot.SaleContract.Customer.WorkInfo.work_postal_code,
                    workPhoneNumber: contractPlot.SaleContract.Customer.WorkInfo.work_phone_number,
                    dmSetting: contractPlot.SaleContract.Customer.WorkInfo.dm_setting,
                    addressType: contractPlot.SaleContract.Customer.WorkInfo.address_type,
                    notes: contractPlot.SaleContract.Customer.WorkInfo.notes,
                  }
                : null,

              // 請求先情報
              billingInfo: contractPlot.SaleContract.Customer.BillingInfo
                ? {
                    billingType: contractPlot.SaleContract.Customer.BillingInfo.billing_type,
                    bankName: contractPlot.SaleContract.Customer.BillingInfo.bank_name,
                    branchName: contractPlot.SaleContract.Customer.BillingInfo.branch_name,
                    accountType: contractPlot.SaleContract.Customer.BillingInfo.account_type,
                    accountNumber: contractPlot.SaleContract.Customer.BillingInfo.account_number,
                    accountHolder: contractPlot.SaleContract.Customer.BillingInfo.account_holder,
                  }
                : null,
            },
          }
        : null,

      // 使用料情報
      usageFee: contractPlot.UsageFee
        ? {
            calculationType: contractPlot.UsageFee.calculation_type,
            taxType: contractPlot.UsageFee.tax_type,
            usageFee: contractPlot.UsageFee.usage_fee,
            area: contractPlot.UsageFee.area,
            unitPrice: contractPlot.UsageFee.unit_price,
            paymentMethod: contractPlot.UsageFee.payment_method,
          }
        : null,

      // 管理料情報
      managementFee: contractPlot.ManagementFee
        ? {
            calculationType: contractPlot.ManagementFee.calculation_type,
            taxType: contractPlot.ManagementFee.tax_type,
            billingType: contractPlot.ManagementFee.billing_type,
            billingYears: contractPlot.ManagementFee.billing_years,
            area: contractPlot.ManagementFee.area,
            billingMonth: contractPlot.ManagementFee.billing_month,
            managementFee: contractPlot.ManagementFee.management_fee,
            unitPrice: contractPlot.ManagementFee.unit_price,
            lastBillingMonth: contractPlot.ManagementFee.last_billing_month,
            paymentMethod: contractPlot.ManagementFee.payment_method,
          }
        : null,

      // 埋葬者情報
      buriedPersons: contractPlot.PhysicalPlot.BuriedPersons.map((person: any) => ({
        id: person.id,
        name: person.name,
        nameKana: person.name_kana,
        relationship: person.relationship,
        deathDate: person.death_date,
        age: person.age,
        gender: person.gender,
        burialDate: person.burial_date,
        memo: person.memo,
      })),

      // 家族連絡先情報
      familyContacts: contractPlot.PhysicalPlot.FamilyContacts.map((contact: any) => ({
        id: contact.id,
        name: contact.name,
        birthDate: contact.birth_date,
        relationship: contact.relationship,
        address: contact.address,
        phoneNumber: contact.phone_number,
        faxNumber: contact.fax_number,
        email: contact.email,
        registeredAddress: contact.registered_address,
        mailingType: contact.mailing_type,
        companyName: contact.company_name,
        companyNameKana: contact.company_name_kana,
        companyAddress: contact.company_address,
        companyPhone: contact.company_phone,
        notes: contact.notes,
      })),

      // 緊急連絡先
      emergencyContact: contractPlot.PhysicalPlot.EmergencyContact
        ? {
            id: contractPlot.PhysicalPlot.EmergencyContact.id,
            name: contractPlot.PhysicalPlot.EmergencyContact.name,
            relationship: contractPlot.PhysicalPlot.EmergencyContact.relationship,
            phoneNumber: contractPlot.PhysicalPlot.EmergencyContact.phone_number,
          }
        : null,

      // 墓石情報
      gravestoneInfo: contractPlot.PhysicalPlot.GravestoneInfo
        ? {
            gravestoneBase: contractPlot.PhysicalPlot.GravestoneInfo.gravestone_base,
            enclosurePosition: contractPlot.PhysicalPlot.GravestoneInfo.enclosure_position,
            gravestoneDealer: contractPlot.PhysicalPlot.GravestoneInfo.gravestone_dealer,
            gravestoneType: contractPlot.PhysicalPlot.GravestoneInfo.gravestone_type,
            surroundingArea: contractPlot.PhysicalPlot.GravestoneInfo.surrounding_area,
            establishmentDeadline: contractPlot.PhysicalPlot.GravestoneInfo.establishment_deadline,
            establishmentDate: contractPlot.PhysicalPlot.GravestoneInfo.establishment_date,
          }
        : null,

      // 工事情報
      constructionInfo: contractPlot.PhysicalPlot.ConstructionInfo
        ? {
            id: contractPlot.PhysicalPlot.ConstructionInfo.id,
            constructionType: contractPlot.PhysicalPlot.ConstructionInfo.construction_type,
            startDate: contractPlot.PhysicalPlot.ConstructionInfo.start_date,
            completionDate: contractPlot.PhysicalPlot.ConstructionInfo.completion_date,
            contractor: contractPlot.PhysicalPlot.ConstructionInfo.contractor,
            supervisor: contractPlot.PhysicalPlot.ConstructionInfo.supervisor,
            progress: contractPlot.PhysicalPlot.ConstructionInfo.progress,
            workItem1: contractPlot.PhysicalPlot.ConstructionInfo.work_item_1,
            workDate1: contractPlot.PhysicalPlot.ConstructionInfo.work_date_1,
            workAmount1: contractPlot.PhysicalPlot.ConstructionInfo.work_amount_1
              ? Number(contractPlot.PhysicalPlot.ConstructionInfo.work_amount_1)
              : null,
            workStatus1: contractPlot.PhysicalPlot.ConstructionInfo.work_status_1,
            workItem2: contractPlot.PhysicalPlot.ConstructionInfo.work_item_2,
            workDate2: contractPlot.PhysicalPlot.ConstructionInfo.work_date_2,
            workAmount2: contractPlot.PhysicalPlot.ConstructionInfo.work_amount_2
              ? Number(contractPlot.PhysicalPlot.ConstructionInfo.work_amount_2)
              : null,
            workStatus2: contractPlot.PhysicalPlot.ConstructionInfo.work_status_2,
            permitNumber: contractPlot.PhysicalPlot.ConstructionInfo.permit_number,
            applicationDate: contractPlot.PhysicalPlot.ConstructionInfo.application_date,
            permitDate: contractPlot.PhysicalPlot.ConstructionInfo.permit_date,
            permitStatus: contractPlot.PhysicalPlot.ConstructionInfo.permit_status,
            paymentType1: contractPlot.PhysicalPlot.ConstructionInfo.payment_type_1,
            paymentAmount1: contractPlot.PhysicalPlot.ConstructionInfo.payment_amount_1
              ? Number(contractPlot.PhysicalPlot.ConstructionInfo.payment_amount_1)
              : null,
            paymentDate1: contractPlot.PhysicalPlot.ConstructionInfo.payment_date_1,
            paymentStatus1: contractPlot.PhysicalPlot.ConstructionInfo.payment_status_1,
            paymentType2: contractPlot.PhysicalPlot.ConstructionInfo.payment_type_2,
            paymentAmount2: contractPlot.PhysicalPlot.ConstructionInfo.payment_amount_2
              ? Number(contractPlot.PhysicalPlot.ConstructionInfo.payment_amount_2)
              : null,
            paymentScheduledDate2:
              contractPlot.PhysicalPlot.ConstructionInfo.payment_scheduled_date_2,
            paymentStatus2: contractPlot.PhysicalPlot.ConstructionInfo.payment_status_2,
            constructionNotes: contractPlot.PhysicalPlot.ConstructionInfo.construction_notes,
          }
        : null,

      // 合祀情報
      collectiveBurial: contractPlot.PhysicalPlot.CollectiveBurial
        ? {
            id: contractPlot.PhysicalPlot.CollectiveBurial.id,
            burialCapacity: contractPlot.PhysicalPlot.CollectiveBurial.burial_capacity,
            currentBurialCount: contractPlot.PhysicalPlot.CollectiveBurial.current_burial_count,
            capacityReachedDate: contractPlot.PhysicalPlot.CollectiveBurial.capacity_reached_date,
            validityPeriodYears: contractPlot.PhysicalPlot.CollectiveBurial.validity_period_years,
            billingScheduledDate: contractPlot.PhysicalPlot.CollectiveBurial.billing_scheduled_date,
            billingStatus: contractPlot.PhysicalPlot.CollectiveBurial.billing_status,
            billingAmount: contractPlot.PhysicalPlot.CollectiveBurial.billing_amount
              ? Number(contractPlot.PhysicalPlot.CollectiveBurial.billing_amount)
              : null,
            notes: contractPlot.PhysicalPlot.CollectiveBurial.notes,
          }
        : null,

      // 履歴情報
      histories: includeHistory ? histories : undefined,
    };

    res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error fetching contract plot by id:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '契約区画詳細の取得に失敗しました',
      },
    });
  }
};
