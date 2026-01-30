/**
 * レスポンスビルダーユーティリティ
 * Prismaモデルから一貫したAPIレスポンスを構築するためのヘルパー関数
 */

import { Decimal } from '@prisma/client/runtime/library';

/**
 * Prisma DecimalやBigIntを数値に変換
 */
export function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  if (value instanceof Decimal) return value.toNumber();
  if (
    typeof value === 'object' &&
    'toNumber' in value &&
    typeof (value as { toNumber: () => number }).toNumber === 'function'
  ) {
    return (value as { toNumber: () => number }).toNumber();
  }
  const num = Number(value);
  return isNaN(num) ? 0 : num;
}

/**
 * Prisma Decimal値をnumber | nullに変換
 */
export function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return toNumber(value);
}

/**
 * 物理区画レスポンスの共通ビルダー
 */
export interface PhysicalPlotResponse {
  id: string;
  plotNumber: string;
  areaName: string;
  areaSqm: number;
  status: string;
  notes?: string | null;
}

export function buildPhysicalPlotResponse(physicalPlot: {
  id: string;
  plot_number: string;
  area_name: string;
  area_sqm: unknown;
  status: string;
  notes?: string | null;
}): PhysicalPlotResponse {
  return {
    id: physicalPlot.id,
    plotNumber: physicalPlot.plot_number,
    areaName: physicalPlot.area_name,
    areaSqm: toNumber(physicalPlot.area_sqm),
    status: physicalPlot.status,
    notes: physicalPlot.notes ?? null,
  };
}

/**
 * 顧客レスポンスの共通ビルダー
 */
export interface CustomerResponse {
  id: string;
  name: string;
  nameKana: string | null;
  gender?: string | null;
  birthDate?: Date | null;
  phoneNumber: string | null;
  faxNumber?: string | null;
  email?: string | null;
  postalCode: string | null;
  address: string | null;
  registeredAddress?: string | null;
  notes?: string | null;
}

export function buildCustomerResponse(customer: {
  id: string;
  name: string;
  name_kana: string | null;
  gender?: string | null;
  birth_date?: Date | null;
  phone_number: string | null;
  fax_number?: string | null;
  email?: string | null;
  postal_code: string | null;
  address: string | null;
  registered_address?: string | null;
  notes?: string | null;
}): CustomerResponse {
  return {
    id: customer.id,
    name: customer.name,
    nameKana: customer.name_kana,
    gender: customer.gender ?? null,
    birthDate: customer.birth_date ?? null,
    phoneNumber: customer.phone_number,
    faxNumber: customer.fax_number ?? null,
    email: customer.email ?? null,
    postalCode: customer.postal_code,
    address: customer.address,
    registeredAddress: customer.registered_address ?? null,
    notes: customer.notes ?? null,
  };
}

/**
 * 勤務先情報レスポンスの共通ビルダー
 */
export interface WorkInfoResponse {
  companyName: string | null;
  companyNameKana: string | null;
  workPostalCode: string | null;
  workAddress: string | null;
  workPhoneNumber: string | null;
  dmSetting: string | null;
  addressType: string | null;
  notes?: string | null;
}

export function buildWorkInfoResponse(
  workInfo: {
    company_name: string | null;
    company_name_kana: string | null;
    work_postal_code: string | null;
    work_address: string | null;
    work_phone_number: string | null;
    dm_setting: string | null;
    address_type: string | null;
    notes?: string | null;
  } | null
): WorkInfoResponse | null {
  if (!workInfo) return null;
  return {
    companyName: workInfo.company_name,
    companyNameKana: workInfo.company_name_kana,
    workPostalCode: workInfo.work_postal_code,
    workAddress: workInfo.work_address,
    workPhoneNumber: workInfo.work_phone_number,
    dmSetting: workInfo.dm_setting,
    addressType: workInfo.address_type,
    notes: workInfo.notes ?? null,
  };
}

/**
 * 請求情報レスポンスの共通ビルダー
 */
export interface BillingInfoResponse {
  billingType: string | null;
  bankName: string | null;
  branchName: string | null;
  accountType: string | null;
  accountNumber: string | null;
  accountHolder: string | null;
}

export function buildBillingInfoResponse(
  billingInfo: {
    billing_type: string | null;
    bank_name: string | null;
    branch_name: string | null;
    account_type: string | null;
    account_number: string | null;
    account_holder: string | null;
  } | null
): BillingInfoResponse | null {
  if (!billingInfo) return null;
  return {
    billingType: billingInfo.billing_type,
    bankName: billingInfo.bank_name,
    branchName: billingInfo.branch_name,
    accountType: billingInfo.account_type,
    accountNumber: billingInfo.account_number,
    accountHolder: billingInfo.account_holder,
  };
}

/**
 * ページネーション情報の共通ビルダー
 */
export interface PaginationResponse {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function buildPaginationResponse(
  page: number,
  limit: number,
  total: number
): PaginationResponse {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}
