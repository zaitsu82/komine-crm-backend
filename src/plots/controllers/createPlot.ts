/**
 * 新規契約作成エンドポイント
 * POST /api/v1/plots
 *
 * ContractPlot（販売契約情報統合済み） + Customer を作成します。
 * 物理区画（PhysicalPlot）の新規作成または既存区画への契約追加に対応。
 */

import { Request, Response, NextFunction } from 'express';
import { Prisma, PaymentStatus, ContractRole, DmSetting, AddressType } from '@prisma/client';
import { CreatePlotRequest } from '@komine/types';
import { validateContractArea, updatePhysicalPlotStatus } from '../utils';
import prisma from '../../db/prisma';
import { ValidationError, NotFoundError } from '../../middleware/errorHandler';
import {
  recordContractPlotCreated,
  recordCustomerCreated,
  recordEntityCreated,
} from '../services/historyService';

type Tx = Prisma.TransactionClient;

/**
 * 新規契約作成のトランザクション内処理
 * bulkCreatePlots からも呼び出せるように外部化
 */
export async function createPlotCore(
  tx: Tx,
  input: CreatePlotRequest,
  req: Request
): Promise<{
  contractPlotId: string;
  physicalPlotId: string;
  customerId: string;
}> {
  // 入力バリデーション
  if (!input.contractPlot || !input.saleContract || !input.customer) {
    throw new ValidationError('contractPlot, saleContract, customerは必須です');
  }

  if (!input.contractPlot.contractAreaSqm || input.contractPlot.contractAreaSqm <= 0) {
    throw new ValidationError('契約面積は0より大きい値を指定してください');
  }

  // 1. PhysicalPlotの取得または作成
  let physicalPlot;
  if (input.physicalPlot.id) {
    physicalPlot = await tx.physicalPlot.findUnique({
      where: { id: input.physicalPlot.id, deleted_at: null },
    });

    if (!physicalPlot) {
      throw new NotFoundError('指定された物理区画が見つかりません');
    }
  } else {
    if (!input.physicalPlot.plotNumber || !input.physicalPlot.areaName) {
      throw new ValidationError('新規物理区画作成時は plotNumber と areaName が必須です');
    }

    physicalPlot = await tx.physicalPlot.create({
      data: {
        plot_number: input.physicalPlot.plotNumber,
        area_name: input.physicalPlot.areaName,
        area_sqm: new Prisma.Decimal(input.physicalPlot.areaSqm || 3.6),
        status: 'available',
        notes: input.physicalPlot.notes || null,
      },
    });
  }

  // 2. 契約面積の妥当性検証
  const validationResult = await validateContractArea(
    tx as any,
    physicalPlot.id,
    input.contractPlot.contractAreaSqm
  );

  if (!validationResult.isValid) {
    throw new ValidationError(validationResult.message || '契約面積の検証に失敗しました');
  }

  // 3. 顧客情報の作成
  const customer = await tx.customer.create({
    data: {
      name: input.customer.name,
      name_kana: input.customer.nameKana,
      birth_date: input.customer.birthDate ? new Date(input.customer.birthDate) : null,
      gender: input.customer.gender || null,
      postal_code: input.customer.postalCode,
      address: input.customer.address,
      address_line_2: input.customer.addressLine2 || null,
      registered_address: input.customer.registeredAddress || null,
      phone_number: input.customer.phoneNumber,
      fax_number: input.customer.faxNumber || null,
      email: input.customer.email || null,
      notes: input.customer.notes || null,
    },
  });

  // 4. 勤務先情報の作成（オプション）
  let workInfo: { id: string } | null = null;
  if (input.workInfo) {
    workInfo = await tx.workInfo.create({
      data: {
        customer_id: customer.id,
        company_name: input.workInfo.companyName,
        company_name_kana: input.workInfo.companyNameKana,
        work_postal_code: input.workInfo.workPostalCode,
        work_address: input.workInfo.workAddress,
        work_phone_number: input.workInfo.workPhoneNumber,
        dm_setting: input.workInfo.dmSetting as string as DmSetting,
        address_type: input.workInfo.addressType as string as AddressType,
        notes: input.workInfo.notes || null,
      },
    });
  }

  // 5. 請求情報の作成（オプション）
  let billingInfo: { id: string } | null = null;
  if (input.billingInfo) {
    billingInfo = await tx.billingInfo.create({
      data: {
        customer_id: customer.id,
        billing_type: input.billingInfo.billingType,
        bank_name: input.billingInfo.bankName,
        branch_name: input.billingInfo.branchName,
        account_type: input.billingInfo.accountType,
        account_number: input.billingInfo.accountNumber,
        account_holder: input.billingInfo.accountHolder,
      },
    });
  }

  // 6. 契約区画の作成（販売契約情報を統合）
  const contractPlot = await tx.contractPlot.create({
    data: {
      physical_plot_id: physicalPlot.id,
      contract_area_sqm: new Prisma.Decimal(input.contractPlot.contractAreaSqm),
      location_description: input.contractPlot.locationDescription || null,
      burial_capacity: input.collectiveBurial?.burialCapacity ?? null,
      validity_period_years: input.collectiveBurial?.validityPeriodYears ?? null,
      contract_date: new Date(input.saleContract.contractDate),
      price: input.saleContract.price,
      payment_status: input.saleContract.paymentStatus || PaymentStatus.unpaid,
      reservation_date: input.saleContract.reservationDate
        ? new Date(input.saleContract.reservationDate)
        : null,
      acceptance_number: input.saleContract.acceptanceNumber || null,
      acceptance_date: input.saleContract.acceptanceDate
        ? new Date(input.saleContract.acceptanceDate)
        : null,
      staff_in_charge: input.saleContract.staffInCharge || null,
      agent_name: input.saleContract.agentName || null,
      permit_number: input.saleContract.permitNumber || null,
      permit_date: input.saleContract.permitDate ? new Date(input.saleContract.permitDate) : null,
      start_date: input.saleContract.startDate ? new Date(input.saleContract.startDate) : null,
      uncollected_amount: input.saleContract.uncollectedAmount ?? 0,
      notes: input.saleContract.notes || null,
    },
  });

  // 6.5. 合祀情報の作成
  let collectiveBurial: { id: string } | null = null;
  if (input.collectiveBurial) {
    collectiveBurial = await tx.collectiveBurial.create({
      data: {
        contract_plot_id: contractPlot.id,
        burial_capacity: input.collectiveBurial.burialCapacity,
        validity_period_years: input.collectiveBurial.validityPeriodYears,
        billing_amount: input.collectiveBurial.billingAmount ?? null,
        notes: input.collectiveBurial.notes || null,
      },
    });
  }

  // 7. 顧客役割の作成
  const createdRoles: { id: string; role: string; customer_id: string }[] = [];
  if (input.saleContract.roles && input.saleContract.roles.length > 0) {
    for (const roleData of input.saleContract.roles) {
      const created = await tx.saleContractRole.create({
        data: {
          contract_plot_id: contractPlot.id,
          customer_id: roleData.customerId || customer.id,
          role: roleData.role,
          role_start_date: roleData.roleStartDate ? new Date(roleData.roleStartDate) : null,
          role_end_date: roleData.roleEndDate ? new Date(roleData.roleEndDate) : null,
          notes: roleData.notes || null,
        },
      });
      createdRoles.push({
        id: created.id,
        role: created.role,
        customer_id: created.customer_id,
      });
    }
  } else {
    const created = await tx.saleContractRole.create({
      data: {
        contract_plot_id: contractPlot.id,
        customer_id: customer.id,
        role: (input.saleContract.customerRole as ContractRole) || ContractRole.contractor,
      },
    });
    createdRoles.push({ id: created.id, role: created.role, customer_id: created.customer_id });
  }

  // 8. 使用料情報の作成
  let usageFee: { id: string } | null = null;
  if (input.usageFee) {
    usageFee = await tx.usageFee.create({
      data: {
        contract_plot_id: contractPlot.id,
        calculation_type: input.usageFee.calculationType || '',
        tax_type: input.usageFee.taxType || '',
        billing_type: input.usageFee.billingType || 'onetime',
        billing_years: input.usageFee.billingYears || '1',
        usage_fee: String(input.usageFee.usageFee ?? ''),
        area: String(input.usageFee.area ?? ''),
        unit_price: String(input.usageFee.unitPrice ?? ''),
        payment_method: input.usageFee.paymentMethod || '',
      },
    });
  }

  // 9. 管理料情報の作成
  let managementFee: { id: string } | null = null;
  if (input.managementFee) {
    managementFee = await tx.managementFee.create({
      data: {
        contract_plot_id: contractPlot.id,
        calculation_type: input.managementFee.calculationType || '',
        tax_type: input.managementFee.taxType || '',
        billing_type: input.managementFee.billingType || '',
        billing_years: String(input.managementFee.billingYears ?? ''),
        area: String(input.managementFee.area ?? ''),
        billing_month: input.managementFee.billingMonth || '',
        management_fee: String(input.managementFee.managementFee ?? ''),
        unit_price: String(input.managementFee.unitPrice ?? ''),
        last_billing_month: input.managementFee.lastBillingMonth || '',
        payment_method: input.managementFee.paymentMethod || '',
      },
    });
  }

  // 10. 物理区画のステータス更新
  await updatePhysicalPlotStatus(tx as any, physicalPlot.id);

  // 11. 履歴の自動記録
  if (!input.physicalPlot.id) {
    await recordEntityCreated(tx, {
      entityType: 'PhysicalPlot',
      entityId: physicalPlot.id,
      physicalPlotId: physicalPlot.id,
      afterRecord: {
        id: physicalPlot.id,
        plot_number: physicalPlot.plot_number,
        area_name: physicalPlot.area_name,
        area_sqm: physicalPlot.area_sqm.toString(),
        status: physicalPlot.status,
        notes: physicalPlot.notes,
      },
      req,
    });
  }
  await recordContractPlotCreated(tx, contractPlot, req);
  await recordCustomerCreated(tx, customer, contractPlot.id, physicalPlot.id, req);
  if (workInfo) {
    await recordEntityCreated(tx, {
      entityType: 'WorkInfo',
      entityId: workInfo.id,
      physicalPlotId: physicalPlot.id,
      contractPlotId: contractPlot.id,
      afterRecord: { id: workInfo.id, customer_id: customer.id, ...input.workInfo! },
      req,
    });
  }
  if (billingInfo) {
    await recordEntityCreated(tx, {
      entityType: 'BillingInfo',
      entityId: billingInfo.id,
      physicalPlotId: physicalPlot.id,
      contractPlotId: contractPlot.id,
      afterRecord: { id: billingInfo.id, customer_id: customer.id, ...input.billingInfo! },
      req,
    });
  }
  if (usageFee) {
    await recordEntityCreated(tx, {
      entityType: 'UsageFee',
      entityId: usageFee.id,
      physicalPlotId: physicalPlot.id,
      contractPlotId: contractPlot.id,
      afterRecord: { id: usageFee.id, ...input.usageFee! },
      req,
    });
  }
  if (managementFee) {
    await recordEntityCreated(tx, {
      entityType: 'ManagementFee',
      entityId: managementFee.id,
      physicalPlotId: physicalPlot.id,
      contractPlotId: contractPlot.id,
      afterRecord: { id: managementFee.id, ...input.managementFee! },
      req,
    });
  }
  if (collectiveBurial) {
    await recordEntityCreated(tx, {
      entityType: 'CollectiveBurial',
      entityId: collectiveBurial.id,
      physicalPlotId: physicalPlot.id,
      contractPlotId: contractPlot.id,
      afterRecord: {
        id: collectiveBurial.id,
        burial_capacity: input.collectiveBurial!.burialCapacity,
        validity_period_years: input.collectiveBurial!.validityPeriodYears,
        billing_amount: input.collectiveBurial!.billingAmount ?? null,
        notes: input.collectiveBurial!.notes || null,
      },
      req,
    });
  }
  for (const role of createdRoles) {
    await recordEntityCreated(tx, {
      entityType: 'SaleContractRole',
      entityId: role.id,
      physicalPlotId: physicalPlot.id,
      contractPlotId: contractPlot.id,
      afterRecord: {
        id: role.id,
        role: role.role,
        customer_id: role.customer_id,
      },
      req,
    });
  }

  return {
    contractPlotId: contractPlot.id,
    physicalPlotId: physicalPlot.id,
    customerId: customer.id,
  };
}

/**
 * 新規契約作成（ContractPlot + SaleContract + Customer）
 * POST /api/v1/plots
 */
export const createPlot = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const input: CreatePlotRequest = req.body;

    const result = await prisma.$transaction(async (tx) => {
      return createPlotCore(tx, input, req);
    });

    // 作成完了後、詳細情報を取得して返却
    const createdContractPlot = await prisma.contractPlot.findUnique({
      where: { id: result.contractPlotId },
      include: {
        physicalPlot: true,
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
        collectiveBurial: true,
      },
    });

    const firstRole = createdContractPlot?.saleContractRoles?.[0];
    const firstCustomer = firstRole?.customer;

    res.status(201).json({
      success: true,
      data: {
        id: createdContractPlot?.id,
        contractAreaSqm: createdContractPlot?.contract_area_sqm.toNumber(),
        locationDescription: createdContractPlot?.location_description,

        contractDate: createdContractPlot?.contract_date,
        price: createdContractPlot?.price,
        paymentStatus: createdContractPlot?.payment_status,
        reservationDate: createdContractPlot?.reservation_date,
        acceptanceNumber: createdContractPlot?.acceptance_number,
        permitDate: createdContractPlot?.permit_date,
        permitNumber: createdContractPlot?.permit_number,
        startDate: createdContractPlot?.start_date,
        uncollectedAmount: createdContractPlot?.uncollected_amount,
        agentName: createdContractPlot?.agent_name,
        notes: createdContractPlot?.notes,

        physicalPlot: {
          id: createdContractPlot?.physicalPlot.id,
          plotNumber: createdContractPlot?.physicalPlot.plot_number,
          areaName: createdContractPlot?.physicalPlot.area_name,
          areaSqm: createdContractPlot?.physicalPlot.area_sqm.toNumber(),
          status: createdContractPlot?.physicalPlot.status,
        },

        primaryCustomer: firstCustomer
          ? {
              id: firstCustomer.id,
              name: firstCustomer.name,
              nameKana: firstCustomer.name_kana,
              phoneNumber: firstCustomer.phone_number,
              address: firstCustomer.address,
              role: firstRole?.role,
            }
          : null,

        roles: createdContractPlot?.saleContractRoles?.map((role) => ({
          id: role.id,
          role: role.role,
          roleStartDate: role.role_start_date,
          roleEndDate: role.role_end_date,
          notes: role.notes,
          customer: {
            id: role.customer.id,
            name: role.customer.name,
            nameKana: role.customer.name_kana,
            phoneNumber: role.customer.phone_number,
            address: role.customer.address,
          },
        })),

        collectiveBurial: createdContractPlot?.collectiveBurial
          ? {
              id: createdContractPlot.collectiveBurial.id,
              burialCapacity: createdContractPlot.collectiveBurial.burial_capacity,
              currentBurialCount: createdContractPlot.collectiveBurial.current_burial_count,
              capacityReachedDate: createdContractPlot.collectiveBurial.capacity_reached_date,
              validityPeriodYears: createdContractPlot.collectiveBurial.validity_period_years,
              billingScheduledDate: createdContractPlot.collectiveBurial.billing_scheduled_date,
              billingStatus: createdContractPlot.collectiveBurial.billing_status,
              billingAmount: createdContractPlot.collectiveBurial.billing_amount,
              notes: createdContractPlot.collectiveBurial.notes,
            }
          : null,

        createdAt: createdContractPlot?.created_at,
        updatedAt: createdContractPlot?.updated_at,
      },
    });
  } catch (error) {
    next(error);
  }
};
