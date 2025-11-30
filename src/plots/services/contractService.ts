/**
 * 契約区画サービス
 * ContractPlotに関する共通処理を提供
 */

import { PrismaClient, Prisma } from '@prisma/client';

/**
 * 契約区画をIDで検索（論理削除を除外）
 * @param prisma - PrismaClientインスタンス
 * @param id - 契約区画ID
 * @returns 契約区画またはnull
 */
export async function findContractPlotById(
  prisma: PrismaClient | Prisma.TransactionClient,
  id: string
) {
  return prisma.contractPlot.findUnique({
    where: { id, deleted_at: null },
    include: {
      PhysicalPlot: {
        include: {
          BuriedPersons: {
            where: { deleted_at: null },
            orderBy: { created_at: 'desc' },
          },
          CollectiveBurial: true,
          FamilyContacts: {
            where: { deleted_at: null },
            orderBy: { created_at: 'desc' },
          },
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
}

/**
 * 契約区画の存在を検証
 * @param prisma - PrismaClientインスタンス
 * @param id - 契約区画ID
 * @returns 契約区画
 * @throws 契約区画が見つからない場合にエラー
 */
export async function validateContractPlotExists(
  prisma: PrismaClient | Prisma.TransactionClient,
  id: string
) {
  const contractPlot = await findContractPlotById(prisma, id);
  if (!contractPlot) {
    throw new Error('指定された契約区画が見つかりません');
  }
  return contractPlot;
}

/**
 * 契約区画の詳細レスポンスを構築
 * @param contractPlot - 契約区画データ
 * @returns フォーマット済みレスポンス
 */
export function buildContractPlotDetailResponse(contractPlot: any) {
  return {
    id: contractPlot.id,
    contractAreaSqm: contractPlot.contract_area_sqm.toNumber(),
    saleStatus: contractPlot.sale_status,
    locationDescription: contractPlot.location_description,
    createdAt: contractPlot.created_at,
    updatedAt: contractPlot.updated_at,

    PhysicalPlot: {
      id: contractPlot.PhysicalPlot.id,
      plotNumber: contractPlot.PhysicalPlot.plot_number,
      areaName: contractPlot.PhysicalPlot.area_name,
      areaSqm: contractPlot.PhysicalPlot.area_sqm.toNumber(),
      status: contractPlot.PhysicalPlot.status,
      notes: contractPlot.PhysicalPlot.notes,
      BuriedPersons: contractPlot.PhysicalPlot.BuriedPersons.map((bp: any) => ({
        id: bp.id,
        name: bp.name,
        nameKana: bp.name_kana,
        relationship: bp.relationship,
        deathDate: bp.death_date,
        age: bp.age,
        gender: bp.gender,
        burialDate: bp.burial_date,
        graveNumber: bp.grave_number,
        notes: bp.notes,
      })),
      CollectiveBurial: contractPlot.PhysicalPlot.CollectiveBurial
        ? {
            id: contractPlot.PhysicalPlot.CollectiveBurial.id,
            burialCapacity: contractPlot.PhysicalPlot.CollectiveBurial.burial_capacity,
            currentBurialCount: contractPlot.PhysicalPlot.CollectiveBurial.current_burial_count,
            capacityReachedDate: contractPlot.PhysicalPlot.CollectiveBurial.capacity_reached_date,
            validityPeriodYears: contractPlot.PhysicalPlot.CollectiveBurial.validity_period_years,
            billingScheduledDate: contractPlot.PhysicalPlot.CollectiveBurial.billing_scheduled_date,
            billingStatus: contractPlot.PhysicalPlot.CollectiveBurial.billing_status,
            billingAmount: contractPlot.PhysicalPlot.CollectiveBurial.billing_amount
              ? contractPlot.PhysicalPlot.CollectiveBurial.billing_amount.toNumber()
              : null,
            notes: contractPlot.PhysicalPlot.CollectiveBurial.notes,
          }
        : null,
      FamilyContacts: contractPlot.PhysicalPlot.FamilyContacts.map((fc: any) => ({
        id: fc.id,
        name: fc.name,
        birthDate: fc.birth_date,
        relationship: fc.relationship,
        address: fc.address,
        phoneNumber: fc.phone_number,
        email: fc.email,
      })),
    },

    SaleContract: {
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

      Customer: {
        id: contractPlot.SaleContract.Customer.id,
        name: contractPlot.SaleContract.Customer.name,
        nameKana: contractPlot.SaleContract.Customer.name_kana,
        birthDate: contractPlot.SaleContract.Customer.birth_date,
        gender: contractPlot.SaleContract.Customer.gender,
        postalCode: contractPlot.SaleContract.Customer.postal_code,
        address: contractPlot.SaleContract.Customer.address,
        registeredAddress: contractPlot.SaleContract.Customer.registered_address,
        phoneNumber: contractPlot.SaleContract.Customer.phone_number,
        faxNumber: contractPlot.SaleContract.Customer.fax_number,
        email: contractPlot.SaleContract.Customer.email,
        notes: contractPlot.SaleContract.Customer.notes,

        WorkInfo: contractPlot.SaleContract.Customer.WorkInfo
          ? {
              id: contractPlot.SaleContract.Customer.WorkInfo.id,
              companyName: contractPlot.SaleContract.Customer.WorkInfo.company_name,
              companyNameKana: contractPlot.SaleContract.Customer.WorkInfo.company_name_kana,
              workPostalCode: contractPlot.SaleContract.Customer.WorkInfo.work_postal_code,
              workAddress: contractPlot.SaleContract.Customer.WorkInfo.work_address,
              workPhoneNumber: contractPlot.SaleContract.Customer.WorkInfo.work_phone_number,
              dmSetting: contractPlot.SaleContract.Customer.WorkInfo.dm_setting,
              addressType: contractPlot.SaleContract.Customer.WorkInfo.address_type,
              notes: contractPlot.SaleContract.Customer.WorkInfo.notes,
            }
          : null,

        BillingInfo: contractPlot.SaleContract.Customer.BillingInfo
          ? {
              id: contractPlot.SaleContract.Customer.BillingInfo.id,
              billingType: contractPlot.SaleContract.Customer.BillingInfo.billing_type,
              accountType: contractPlot.SaleContract.Customer.BillingInfo.account_type,
              bankName: contractPlot.SaleContract.Customer.BillingInfo.bank_name,
              branchName: contractPlot.SaleContract.Customer.BillingInfo.branch_name,
              accountNumber: contractPlot.SaleContract.Customer.BillingInfo.account_number,
              accountHolder: contractPlot.SaleContract.Customer.BillingInfo.account_holder,
            }
          : null,
      },
    },

    UsageFee: contractPlot.UsageFee
      ? {
          id: contractPlot.UsageFee.id,
          calculationType: contractPlot.UsageFee.calculation_type,
          taxType: contractPlot.UsageFee.tax_type,
          billingType: contractPlot.UsageFee.billing_type,
          billingYears: contractPlot.UsageFee.billing_years,
          area: contractPlot.UsageFee.area,
          unitPrice: contractPlot.UsageFee.unit_price,
          usageFee: contractPlot.UsageFee.usage_fee,
          paymentMethod: contractPlot.UsageFee.payment_method,
        }
      : null,

    ManagementFee: contractPlot.ManagementFee
      ? {
          id: contractPlot.ManagementFee.id,
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
  };
}

/**
 * 契約区画のサマリーレスポンスを構築（一覧用）
 * @param contractPlot - 契約区画データ
 * @returns フォーマット済みサマリー
 */
export function buildContractPlotSummaryResponse(contractPlot: any) {
  return {
    id: contractPlot.id,
    contractAreaSqm: contractPlot.contract_area_sqm.toNumber(),
    saleStatus: contractPlot.sale_status,
    locationDescription: contractPlot.location_description,
    plotNumber: contractPlot.PhysicalPlot.plot_number,
    areaName: contractPlot.PhysicalPlot.area_name,
    physicalPlotAreaSqm: contractPlot.PhysicalPlot.area_sqm.toNumber(),
    physicalPlotStatus: contractPlot.PhysicalPlot.status,
    customerName: contractPlot.SaleContract?.Customer.name || null,
    customerNameKana: contractPlot.SaleContract?.Customer.name_kana || null,
    customerPhoneNumber: contractPlot.SaleContract?.Customer.phone_number || null,
    customerAddress: contractPlot.SaleContract?.Customer.address || null,
    customerRole: contractPlot.SaleContract?.customer_role || null,
    contractDate: contractPlot.SaleContract?.contract_date || null,
    price: contractPlot.SaleContract?.price.toNumber() || null,
    paymentStatus: contractPlot.SaleContract?.payment_status || null,
    createdAt: contractPlot.created_at,
    updatedAt: contractPlot.updated_at,
  };
}
