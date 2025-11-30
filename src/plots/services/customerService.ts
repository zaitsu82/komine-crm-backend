/**
 * 顧客サービス
 * Customer、WorkInfo、BillingInfoに関する共通処理を提供
 */

import { PrismaClient, Prisma } from '@prisma/client';

/**
 * 顧客を関連情報とともに作成
 * @param prisma - PrismaClientまたはTransactionClient
 * @param customerData - 顧客基本情報
 * @param workInfoData - 勤務先情報（オプション）
 * @param billingInfoData - 請求情報（オプション）
 * @returns 作成された顧客
 */
export async function createCustomerWithRelations(
  prisma: PrismaClient | Prisma.TransactionClient,
  customerData: any,
  workInfoData?: any,
  billingInfoData?: any
) {
  // 顧客を作成
  const customer = await prisma.customer.create({
    data: {
      name: customerData.name,
      name_kana: customerData.nameKana,
      birth_date: customerData.birthDate,
      gender: customerData.gender,
      postal_code: customerData.postalCode,
      address: customerData.address,
      registered_address: customerData.registeredAddress,
      phone_number: customerData.phoneNumber,
      fax_number: customerData.faxNumber,
      email: customerData.email,
      notes: customerData.notes,
    },
  });

  // 勤務先情報を作成（オプション）
  if (workInfoData) {
    await prisma.workInfo.create({
      data: {
        customer_id: customer.id,
        company_name: workInfoData.companyName,
        company_name_kana: workInfoData.companyNameKana,
        work_postal_code: workInfoData.workPostalCode,
        work_address: workInfoData.workAddress,
        work_phone_number: workInfoData.workPhoneNumber,
        dm_setting: workInfoData.dmSetting,
        address_type: workInfoData.addressType,
        notes: workInfoData.notes,
      },
    });
  }

  // 請求情報を作成（オプション）
  if (billingInfoData) {
    await prisma.billingInfo.create({
      data: {
        customer_id: customer.id,
        billing_type: billingInfoData.billingType,
        account_type: billingInfoData.accountType,
        bank_name: billingInfoData.bankName,
        branch_name: billingInfoData.branchName,
        account_number: billingInfoData.accountNumber,
        account_holder: billingInfoData.accountHolder,
      },
    });
  }

  return customer;
}

/**
 * 顧客情報を更新
 * @param prisma - PrismaClientまたはTransactionClient
 * @param customerId - 顧客ID
 * @param customerData - 更新する顧客情報
 * @param workInfoData - 更新する勤務先情報（オプション）
 * @param billingInfoData - 更新する請求情報（オプション）
 */
export async function updateCustomerWithRelations(
  prisma: PrismaClient | Prisma.TransactionClient,
  customerId: string,
  customerData?: any,
  workInfoData?: any,
  billingInfoData?: any
) {
  // 顧客基本情報を更新
  if (customerData) {
    await prisma.customer.update({
      where: { id: customerId },
      data: {
        name: customerData.name,
        name_kana: customerData.nameKana,
        birth_date: customerData.birthDate,
        gender: customerData.gender,
        postal_code: customerData.postalCode,
        address: customerData.address,
        registered_address: customerData.registeredAddress,
        phone_number: customerData.phoneNumber,
        fax_number: customerData.faxNumber,
        email: customerData.email,
        notes: customerData.notes,
      },
    });
  }

  // 勤務先情報を更新または作成
  if (workInfoData) {
    const existingWorkInfo = await prisma.workInfo.findUnique({
      where: { customer_id: customerId },
    });

    if (existingWorkInfo) {
      await prisma.workInfo.update({
        where: { customer_id: customerId },
        data: {
          company_name: workInfoData.companyName,
          company_name_kana: workInfoData.companyNameKana,
          work_postal_code: workInfoData.workPostalCode,
          work_address: workInfoData.workAddress,
          work_phone_number: workInfoData.workPhoneNumber,
          dm_setting: workInfoData.dmSetting,
          address_type: workInfoData.addressType,
          notes: workInfoData.notes,
        },
      });
    } else {
      await prisma.workInfo.create({
        data: {
          customer_id: customerId,
          company_name: workInfoData.companyName,
          company_name_kana: workInfoData.companyNameKana,
          work_postal_code: workInfoData.workPostalCode,
          work_address: workInfoData.workAddress,
          work_phone_number: workInfoData.workPhoneNumber,
          dm_setting: workInfoData.dmSetting,
          address_type: workInfoData.addressType,
          notes: workInfoData.notes,
        },
      });
    }
  }

  // 請求情報を更新または作成
  if (billingInfoData) {
    const existingBillingInfo = await prisma.billingInfo.findUnique({
      where: { customer_id: customerId },
    });

    if (existingBillingInfo) {
      await prisma.billingInfo.update({
        where: { customer_id: customerId },
        data: {
          billing_type: billingInfoData.billingType,
          account_type: billingInfoData.accountType,
          bank_name: billingInfoData.bankName,
          branch_name: billingInfoData.branchName,
          account_number: billingInfoData.accountNumber,
          account_holder: billingInfoData.accountHolder,
        },
      });
    } else {
      await prisma.billingInfo.create({
        data: {
          customer_id: customerId,
          billing_type: billingInfoData.billingType,
          account_type: billingInfoData.accountType,
          bank_name: billingInfoData.bankName,
          branch_name: billingInfoData.branchName,
          account_number: billingInfoData.accountNumber,
          account_holder: billingInfoData.accountHolder,
        },
      });
    }
  }
}

/**
 * 顧客が他の契約で使用されていないか確認し、安全であれば削除
 * @param prisma - PrismaClientまたはTransactionClient
 * @param customerId - 顧客ID
 * @param excludeContractId - 除外する契約ID（削除中の契約）
 */
export async function deleteCustomerIfUnused(
  prisma: PrismaClient | Prisma.TransactionClient,
  customerId: string,
  excludeContractId?: string
) {
  // この顧客を参照している他の契約を検索
  const otherContracts = await prisma.saleContract.findMany({
    where: {
      customer_id: customerId,
      deleted_at: null,
      ...(excludeContractId && { id: { not: excludeContractId } }),
    },
  });

  // 他の契約がない場合のみ削除
  if (otherContracts.length === 0) {
    // 勤務先情報を削除
    await prisma.workInfo.deleteMany({
      where: { customer_id: customerId },
    });

    // 請求情報を削除
    await prisma.billingInfo.deleteMany({
      where: { customer_id: customerId },
    });

    // 顧客を論理削除
    await prisma.customer.update({
      where: { id: customerId },
      data: { deleted_at: new Date() },
    });
  }
}

/**
 * 顧客をIDで検索
 * @param prisma - PrismaClientインスタンス
 * @param id - 顧客ID
 * @returns 顧客またはnull
 */
export async function findCustomerById(
  prisma: PrismaClient | Prisma.TransactionClient,
  id: string
) {
  return prisma.customer.findUnique({
    where: { id, deleted_at: null },
    include: {
      WorkInfo: true,
      BillingInfo: true,
    },
  });
}

/**
 * 顧客の存在を検証
 * @param prisma - PrismaClientインスタンス
 * @param id - 顧客ID
 * @returns 顧客
 * @throws 顧客が見つからない場合にエラー
 */
export async function validateCustomerExists(
  prisma: PrismaClient | Prisma.TransactionClient,
  id: string
) {
  const customer = await findCustomerById(prisma, id);
  if (!customer) {
    throw new Error('指定された顧客が見つかりません');
  }
  return customer;
}
