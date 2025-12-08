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
      SaleContractRoles: {
        where: { deleted_at: null },
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
  // 主契約者（is_primary=true）を取得（後方互換性のため）
  const primaryRole = contractPlot.SaleContractRoles?.find((role: any) => role.is_primary);
  const primaryCustomer = primaryRole?.Customer;

  return {
    id: contractPlot.id,
    contractAreaSqm: contractPlot.contract_area_sqm.toNumber(),
    locationDescription: contractPlot.location_description,

    // 販売契約情報（ContractPlotに統合済み）
    contractDate: contractPlot.contract_date,
    price: contractPlot.price.toNumber(),
    paymentStatus: contractPlot.payment_status,
    reservationDate: contractPlot.reservation_date,
    acceptanceNumber: contractPlot.acceptance_number,
    permitDate: contractPlot.permit_date,
    startDate: contractPlot.start_date,
    notes: contractPlot.notes,

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

    // 後方互換性のため、主契約者の情報を設定
    primaryCustomer: primaryCustomer
      ? {
          id: primaryCustomer.id,
          name: primaryCustomer.name,
          nameKana: primaryCustomer.name_kana,
          birthDate: primaryCustomer.birth_date,
          gender: primaryCustomer.gender,
          postalCode: primaryCustomer.postal_code,
          address: primaryCustomer.address,
          registeredAddress: primaryCustomer.registered_address,
          phoneNumber: primaryCustomer.phone_number,
          faxNumber: primaryCustomer.fax_number,
          email: primaryCustomer.email,
          notes: primaryCustomer.notes,
          role: primaryRole?.role || null,

          WorkInfo: primaryCustomer.WorkInfo
            ? {
                id: primaryCustomer.WorkInfo.id,
                companyName: primaryCustomer.WorkInfo.company_name,
                companyNameKana: primaryCustomer.WorkInfo.company_name_kana,
                workPostalCode: primaryCustomer.WorkInfo.work_postal_code,
                workAddress: primaryCustomer.WorkInfo.work_address,
                workPhoneNumber: primaryCustomer.WorkInfo.work_phone_number,
                dmSetting: primaryCustomer.WorkInfo.dm_setting,
                addressType: primaryCustomer.WorkInfo.address_type,
                notes: primaryCustomer.WorkInfo.notes,
              }
            : null,

          BillingInfo: primaryCustomer.BillingInfo
            ? {
                id: primaryCustomer.BillingInfo.id,
                billingType: primaryCustomer.BillingInfo.billing_type,
                accountType: primaryCustomer.BillingInfo.account_type,
                bankName: primaryCustomer.BillingInfo.bank_name,
                branchName: primaryCustomer.BillingInfo.branch_name,
                accountNumber: primaryCustomer.BillingInfo.account_number,
                accountHolder: primaryCustomer.BillingInfo.account_holder,
              }
            : null,
        }
      : null,

    // 全ての役割と顧客情報
    roles:
      contractPlot.SaleContractRoles?.map((role: any) => ({
        id: role.id,
        role: role.role,
        isPrimary: role.is_primary,
        roleStartDate: role.role_start_date,
        roleEndDate: role.role_end_date,
        notes: role.notes,
        customer: {
          id: role.Customer.id,
          name: role.Customer.name,
          nameKana: role.Customer.name_kana,
          gender: role.Customer.gender,
          birthDate: role.Customer.birth_date,
          phoneNumber: role.Customer.phone_number,
          faxNumber: role.Customer.fax_number,
          email: role.Customer.email,
          postalCode: role.Customer.postal_code,
          address: role.Customer.address,
          registeredAddress: role.Customer.registered_address,
          notes: role.Customer.notes,
          workInfo: role.Customer.WorkInfo
            ? {
                companyName: role.Customer.WorkInfo.company_name,
                companyNameKana: role.Customer.WorkInfo.company_name_kana,
                workAddress: role.Customer.WorkInfo.work_address,
                workPostalCode: role.Customer.WorkInfo.work_postal_code,
                workPhoneNumber: role.Customer.WorkInfo.work_phone_number,
                dmSetting: role.Customer.WorkInfo.dm_setting,
                addressType: role.Customer.WorkInfo.address_type,
                notes: role.Customer.WorkInfo.notes,
              }
            : null,
          billingInfo: role.Customer.BillingInfo
            ? {
                billingType: role.Customer.BillingInfo.billing_type,
                bankName: role.Customer.BillingInfo.bank_name,
                branchName: role.Customer.BillingInfo.branch_name,
                accountType: role.Customer.BillingInfo.account_type,
                accountNumber: role.Customer.BillingInfo.account_number,
                accountHolder: role.Customer.BillingInfo.account_holder,
              }
            : null,
        },
      })) || [],

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
  // 主契約者（is_primary=true）を取得（後方互換性のため）
  const primaryRole = contractPlot.SaleContractRoles?.find((role: any) => role.is_primary);
  const primaryCustomer = primaryRole?.Customer;

  return {
    id: contractPlot.id,
    contractAreaSqm: contractPlot.contract_area_sqm.toNumber(),
    locationDescription: contractPlot.location_description,
    plotNumber: contractPlot.PhysicalPlot.plot_number,
    areaName: contractPlot.PhysicalPlot.area_name,
    physicalPlotAreaSqm: contractPlot.PhysicalPlot.area_sqm.toNumber(),
    physicalPlotStatus: contractPlot.PhysicalPlot.status,

    // 販売契約情報（ContractPlotに統合済み）
    contractDate: contractPlot.contract_date,
    price: contractPlot.price.toNumber(),
    paymentStatus: contractPlot.payment_status,

    // 後方互換性のため、主契約者の情報を設定
    customerName: primaryCustomer?.name || null,
    customerNameKana: primaryCustomer?.name_kana || null,
    customerPhoneNumber: primaryCustomer?.phone_number || null,
    customerAddress: primaryCustomer?.address || null,
    customerRole: primaryRole?.role || null,

    createdAt: contractPlot.created_at,
    updatedAt: contractPlot.updated_at,

    // 全ての役割と顧客情報
    roles:
      contractPlot.SaleContractRoles?.map((role: any) => ({
        role: role.role,
        isPrimary: role.is_primary,
        customer: {
          id: role.Customer.id,
          name: role.Customer.name,
          nameKana: role.Customer.name_kana,
          phoneNumber: role.Customer.phone_number,
          address: role.Customer.address,
        },
      })) || [],
  };
}
