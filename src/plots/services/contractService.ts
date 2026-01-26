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
      physicalPlot: true,
      buriedPersons: {
        where: { deleted_at: null },
        orderBy: { created_at: 'desc' },
      },
      collectiveBurial: true,
      familyContacts: {
        where: { deleted_at: null },
        orderBy: { created_at: 'desc' },
      },
      saleContractRoles: {
        where: { deleted_at: null },
        include: {
          customer: {
            include: {
              workInfo: true,
              billingInfo: true,
            },
          },
        },
      },
      usageFee: true,
      managementFee: true,
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
  // 主契約者（role='contractor'）を取得
  const primaryRole = contractPlot.saleContractRoles?.find(
    (role: any) => role.role === 'contractor'
  );
  const primaryCustomer = primaryRole?.customer;

  return {
    id: contractPlot.id,
    contractAreaSqm: contractPlot.contract_area_sqm.toNumber(),
    locationDescription: contractPlot.location_description,

    // 販売契約情報（ContractPlotに統合済み）
    contractDate: contractPlot.contract_date,
    price: contractPlot.price,
    paymentStatus: contractPlot.payment_status,
    reservationDate: contractPlot.reservation_date,
    acceptanceNumber: contractPlot.acceptance_number,
    permitDate: contractPlot.permit_date,
    startDate: contractPlot.start_date,
    notes: contractPlot.notes,

    createdAt: contractPlot.created_at,
    updatedAt: contractPlot.updated_at,

    physicalPlot: {
      id: contractPlot.physicalPlot.id,
      plotNumber: contractPlot.physicalPlot.plot_number,
      areaName: contractPlot.physicalPlot.area_name,
      areaSqm: contractPlot.physicalPlot.area_sqm.toNumber(),
      status: contractPlot.physicalPlot.status,
      notes: contractPlot.physicalPlot.notes,
      buriedPersons: contractPlot.buriedPersons.map((bp: any) => ({
        id: bp.id,
        name: bp.name,
        nameKana: bp.name_kana,
        relationship: bp.relationship,
        deathDate: bp.death_date,
        age: bp.age,
        gender: bp.gender,
        burialDate: bp.burial_date,
        notes: bp.notes,
      })),
      collectiveBurial: contractPlot.collectiveBurial
        ? {
            id: contractPlot.collectiveBurial.id,
            burialCapacity: contractPlot.collectiveBurial.burial_capacity,
            currentBurialCount: contractPlot.collectiveBurial.current_burial_count,
            capacityReachedDate: contractPlot.collectiveBurial.capacity_reached_date,
            validityPeriodYears: contractPlot.collectiveBurial.validity_period_years,
            billingScheduledDate: contractPlot.collectiveBurial.billing_scheduled_date,
            billingStatus: contractPlot.collectiveBurial.billing_status,
            billingAmount: contractPlot.collectiveBurial.billing_amount
              ? contractPlot.collectiveBurial.billing_amount.toNumber()
              : null,
            notes: contractPlot.collectiveBurial.notes,
          }
        : null,
      familyContacts: contractPlot.familyContacts.map((fc: any) => ({
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

          workInfo: primaryCustomer.workInfo
            ? {
                id: primaryCustomer.workInfo.id,
                companyName: primaryCustomer.workInfo.company_name,
                companyNameKana: primaryCustomer.workInfo.company_name_kana,
                workPostalCode: primaryCustomer.workInfo.work_postal_code,
                workAddress: primaryCustomer.workInfo.work_address,
                workPhoneNumber: primaryCustomer.workInfo.work_phone_number,
                dmSetting: primaryCustomer.workInfo.dm_setting,
                addressType: primaryCustomer.workInfo.address_type,
                notes: primaryCustomer.workInfo.notes,
              }
            : null,

          billingInfo: primaryCustomer.billingInfo
            ? {
                id: primaryCustomer.billingInfo.id,
                billingType: primaryCustomer.billingInfo.billing_type,
                accountType: primaryCustomer.billingInfo.account_type,
                bankName: primaryCustomer.billingInfo.bank_name,
                branchName: primaryCustomer.billingInfo.branch_name,
                accountNumber: primaryCustomer.billingInfo.account_number,
                accountHolder: primaryCustomer.billingInfo.account_holder,
              }
            : null,
        }
      : null,

    // 全ての役割と顧客情報
    roles:
      contractPlot.saleContractRoles?.map((role: any) => ({
        id: role.id,
        role: role.role,
        roleStartDate: role.role_start_date,
        roleEndDate: role.role_end_date,
        notes: role.notes,
        customer: {
          id: role.customer.id,
          name: role.customer.name,
          nameKana: role.customer.name_kana,
          gender: role.customer.gender,
          birthDate: role.customer.birth_date,
          phoneNumber: role.customer.phone_number,
          faxNumber: role.customer.fax_number,
          email: role.customer.email,
          postalCode: role.customer.postal_code,
          address: role.customer.address,
          registeredAddress: role.customer.registered_address,
          notes: role.customer.notes,
          workInfo: role.customer.workInfo
            ? {
                companyName: role.customer.workInfo.company_name,
                companyNameKana: role.customer.workInfo.company_name_kana,
                workAddress: role.customer.workInfo.work_address,
                workPostalCode: role.customer.workInfo.work_postal_code,
                workPhoneNumber: role.customer.workInfo.work_phone_number,
                dmSetting: role.customer.workInfo.dm_setting,
                addressType: role.customer.workInfo.address_type,
                notes: role.customer.workInfo.notes,
              }
            : null,
          billingInfo: role.customer.billingInfo
            ? {
                billingType: role.customer.billingInfo.billing_type,
                bankName: role.customer.billingInfo.bank_name,
                branchName: role.customer.billingInfo.branch_name,
                accountType: role.customer.billingInfo.account_type,
                accountNumber: role.customer.billingInfo.account_number,
                accountHolder: role.customer.billingInfo.account_holder,
              }
            : null,
        },
      })) || [],

    usageFee: contractPlot.usageFee
      ? {
          id: contractPlot.usageFee.id,
          calculationType: contractPlot.usageFee.calculation_type,
          taxType: contractPlot.usageFee.tax_type,
          billingType: contractPlot.usageFee.billing_type,
          billingYears: contractPlot.usageFee.billing_years,
          area: contractPlot.usageFee.area,
          unitPrice: contractPlot.usageFee.unit_price,
          usageFee: contractPlot.usageFee.usage_fee,
          paymentMethod: contractPlot.usageFee.payment_method,
        }
      : null,

    managementFee: contractPlot.managementFee
      ? {
          id: contractPlot.managementFee.id,
          calculationType: contractPlot.managementFee.calculation_type,
          taxType: contractPlot.managementFee.tax_type,
          billingType: contractPlot.managementFee.billing_type,
          billingYears: contractPlot.managementFee.billing_years,
          area: contractPlot.managementFee.area,
          billingMonth: contractPlot.managementFee.billing_month,
          managementFee: contractPlot.managementFee.management_fee,
          unitPrice: contractPlot.managementFee.unit_price,
          lastBillingMonth: contractPlot.managementFee.last_billing_month,
          paymentMethod: contractPlot.managementFee.payment_method,
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
  // 主契約者（role='contractor'）を取得
  const primaryRole = contractPlot.saleContractRoles?.find(
    (role: any) => role.role === 'contractor'
  );
  const primaryCustomer = primaryRole?.customer;

  return {
    id: contractPlot.id,
    contractAreaSqm: contractPlot.contract_area_sqm.toNumber(),
    locationDescription: contractPlot.location_description,
    plotNumber: contractPlot.physicalPlot.plot_number,
    areaName: contractPlot.physicalPlot.area_name,
    physicalPlotAreaSqm: contractPlot.physicalPlot.area_sqm.toNumber(),
    physicalPlotStatus: contractPlot.physicalPlot.status,

    // 販売契約情報（ContractPlotに統合済み）
    contractDate: contractPlot.contract_date,
    price: contractPlot.price,
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
      contractPlot.saleContractRoles?.map((role: any) => ({
        role: role.role,
        customer: {
          id: role.customer.id,
          name: role.customer.name,
          nameKana: role.customer.name_kana,
          phoneNumber: role.customer.phone_number,
          address: role.customer.address,
        },
      })) || [],
  };
}
