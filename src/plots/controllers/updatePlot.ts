/**
 * 契約区画更新エンドポイント
 * PUT /api/v1/plots/:id
 *
 * ContractPlot（販売契約情報統合済み）、Customer、関連情報の部分更新を行います。
 */

import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { UpdatePlotRequest } from '@komine/types';
import { updatePhysicalPlotStatus } from '../utils';
import prisma from '../../db/prisma';
import { ValidationError, NotFoundError } from '../../middleware/errorHandler';
import {
  recordContractPlotUpdated,
  recordCustomerUpdated,
  recordEntityCreated,
  recordEntityUpdated,
  recordEntityDeleted,
  recordHistoryBatch,
  type CreateHistoryInput,
} from '../services/historyService';
import { updateCollectiveBurialCount } from '../../collective-burials/utils';

type Tx = Prisma.TransactionClient;

/**
 * 契約区画更新のトランザクション内処理
 * bulkUpdatePlots からも呼び出せるように外部化
 */
export async function updatePlotCore(
  tx: Tx,
  id: string,
  input: UpdatePlotRequest,
  req: Request
): Promise<void> {
  // 1. 既存のContractPlotを取得
  const existingContractPlot = await tx.contractPlot.findUnique({
    where: { id, deleted_at: null },
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

  if (!existingContractPlot) {
    throw new NotFoundError('指定された契約区画が見つかりません');
  }

  const physicalPlotId = existingContractPlot.physical_plot_id;
  const oldContractArea = existingContractPlot.contract_area_sqm.toNumber();

  // 1.5. 物理区画情報の更新
  const physicalPlotInput = input.physicalPlot;
  if (physicalPlotInput) {
    const ppUpdateData: Record<string, unknown> = {};
    if (physicalPlotInput.plotNumber !== undefined)
      ppUpdateData['plot_number'] = physicalPlotInput.plotNumber;
    if (physicalPlotInput.areaName !== undefined)
      ppUpdateData['area_name'] = physicalPlotInput.areaName;
    if (physicalPlotInput.areaSqm !== undefined)
      ppUpdateData['area_sqm'] = new Prisma.Decimal(physicalPlotInput.areaSqm);
    if (physicalPlotInput.status !== undefined) ppUpdateData['status'] = physicalPlotInput.status;
    if (physicalPlotInput.notes !== undefined) ppUpdateData['notes'] = physicalPlotInput.notes;

    if (Object.keys(ppUpdateData).length > 0) {
      const beforePp = existingContractPlot.physicalPlot;
      const updatedPp = await tx.physicalPlot.update({
        where: { id: physicalPlotId },
        data: ppUpdateData,
      });
      await recordEntityUpdated(tx, {
        entityType: 'PhysicalPlot',
        entityId: physicalPlotId,
        physicalPlotId,
        beforeRecord: {
          plot_number: beforePp.plot_number,
          area_name: beforePp.area_name,
          area_sqm: beforePp.area_sqm.toString(),
          status: beforePp.status,
          notes: beforePp.notes,
        },
        afterRecord: {
          plot_number: updatedPp.plot_number,
          area_name: updatedPp.area_name,
          area_sqm: updatedPp.area_sqm.toString(),
          status: updatedPp.status,
          notes: updatedPp.notes,
        },
        req,
      });
    }
  }

  // 2. ContractPlotの更新
  const updateData: any = {};

  if (input.contractPlot) {
    if (input.contractPlot.contractAreaSqm !== undefined) {
      const newAreaSqm = input.contractPlot.contractAreaSqm;

      const otherContracts = await tx.contractPlot.findMany({
        where: {
          physical_plot_id: physicalPlotId,
          id: { not: id },
          deleted_at: null,
        },
      });

      const otherContractsTotal = otherContracts.reduce(
        (sum, contract) => sum + contract.contract_area_sqm.toNumber(),
        0
      );

      const totalAfterUpdate = otherContractsTotal + newAreaSqm;
      const physicalPlotArea = existingContractPlot.physicalPlot.area_sqm.toNumber();

      if (totalAfterUpdate > physicalPlotArea) {
        throw new ValidationError(
          `契約面積の合計が物理区画の面積を超えています（物理区画: ${physicalPlotArea}㎡、合計: ${totalAfterUpdate}㎡）`
        );
      }

      updateData.contract_area_sqm = new Prisma.Decimal(newAreaSqm);
    }

    if (input.contractPlot.locationDescription !== undefined) {
      updateData.location_description = input.contractPlot.locationDescription;
    }
  }

  if (input.saleContract) {
    if (input.saleContract.contractDate !== undefined) {
      updateData.contract_date = new Date(input.saleContract.contractDate);
    }
    if (input.saleContract.price !== undefined) {
      updateData.price = new Prisma.Decimal(input.saleContract.price);
    }
    if (input.saleContract.paymentStatus !== undefined) {
      updateData.payment_status = input.saleContract.paymentStatus;
    }
    if (input.saleContract.reservationDate !== undefined) {
      updateData.reservation_date = input.saleContract.reservationDate
        ? new Date(input.saleContract.reservationDate)
        : null;
    }
    if (input.saleContract.acceptanceNumber !== undefined) {
      updateData.acceptance_number = input.saleContract.acceptanceNumber;
    }
    if (input.saleContract.acceptanceDate !== undefined) {
      updateData.acceptance_date = input.saleContract.acceptanceDate
        ? new Date(input.saleContract.acceptanceDate)
        : null;
    }
    if (input.saleContract.staffInCharge !== undefined) {
      updateData.staff_in_charge = input.saleContract.staffInCharge;
    }
    if (input.saleContract.agentName !== undefined) {
      updateData.agent_name = input.saleContract.agentName;
    }
    if (input.saleContract.permitNumber !== undefined) {
      updateData.permit_number = input.saleContract.permitNumber || null;
    }
    if (input.saleContract.permitDate !== undefined) {
      updateData.permit_date = input.saleContract.permitDate
        ? new Date(input.saleContract.permitDate)
        : null;
    }
    if (input.saleContract.startDate !== undefined) {
      updateData.start_date = input.saleContract.startDate
        ? new Date(input.saleContract.startDate)
        : null;
    }
    if (input.saleContract.uncollectedAmount !== undefined) {
      updateData.uncollected_amount = input.saleContract.uncollectedAmount;
    }
    if (input.saleContract.notes !== undefined) {
      updateData.notes = input.saleContract.notes;
    }
  }

  // issue #66: update 戻り値を保持し section 13 で再取得しないようにする
  let updatedContractPlotRecord: Awaited<ReturnType<typeof tx.contractPlot.update>> | null = null;
  let updatedCustomerRecord: Awaited<ReturnType<typeof tx.customer.update>> | null = null;
  if (Object.keys(updateData).length > 0) {
    updatedContractPlotRecord = await tx.contractPlot.update({
      where: { id },
      data: updateData,
    });
  }

  // 3. 顧客役割の更新
  if (input.saleContract?.roles !== undefined) {
    const existingRoles = await tx.saleContractRole.findMany({
      where: {
        contract_plot_id: id,
        deleted_at: null,
      },
    });

    await tx.saleContractRole.updateMany({
      where: {
        contract_plot_id: id,
        deleted_at: null,
      },
      data: {
        deleted_at: new Date(),
      },
    });

    // バッチ用履歴エントリ（issue #66）
    const roleHistoryEntries: CreateHistoryInput[] = [];

    for (const oldRole of existingRoles) {
      roleHistoryEntries.push({
        entityType: 'SaleContractRole',
        entityId: oldRole.id,
        physicalPlotId,
        contractPlotId: id,
        actionType: 'DELETE',
        beforeRecord: {
          id: oldRole.id,
          role: oldRole.role,
          customer_id: oldRole.customer_id,
        },
        req,
      });
    }

    for (const roleData of input.saleContract.roles) {
      if (!roleData.customerId) {
        throw new ValidationError('役割更新時は customerId が必須です');
      }

      const created = await tx.saleContractRole.create({
        data: {
          contract_plot_id: existingContractPlot.id,
          customer_id: roleData.customerId,
          role: roleData.role,
          role_start_date: roleData.roleStartDate ? new Date(roleData.roleStartDate) : null,
          role_end_date: roleData.roleEndDate ? new Date(roleData.roleEndDate) : null,
          notes: roleData.notes || null,
        },
      });
      roleHistoryEntries.push({
        entityType: 'SaleContractRole',
        entityId: created.id,
        physicalPlotId,
        contractPlotId: id,
        actionType: 'CREATE',
        afterRecord: {
          id: created.id,
          role: created.role,
          customer_id: created.customer_id,
        },
        req,
      });
    }

    await recordHistoryBatch(tx, roleHistoryEntries);
  }

  // 4. Customerの更新
  if (input.customer) {
    const primaryRole = existingContractPlot.saleContractRoles?.find(
      (role: any) => role.role === 'contractor'
    );
    const customerId = primaryRole?.customer.id;

    if (customerId) {
      const customerUpdateData: any = {};

      if (input.customer.name !== undefined) customerUpdateData.name = input.customer.name;
      if (input.customer.nameKana !== undefined)
        customerUpdateData.name_kana = input.customer.nameKana;
      if (input.customer.birthDate !== undefined) {
        customerUpdateData.birth_date = input.customer.birthDate
          ? new Date(input.customer.birthDate)
          : null;
      }
      if (input.customer.gender !== undefined) customerUpdateData.gender = input.customer.gender;
      if (input.customer.postalCode !== undefined)
        customerUpdateData.postal_code = input.customer.postalCode;
      if (input.customer.address !== undefined) customerUpdateData.address = input.customer.address;
      if (input.customer.addressLine2 !== undefined)
        customerUpdateData.address_line_2 = input.customer.addressLine2;
      if (input.customer.registeredAddress !== undefined)
        customerUpdateData.registered_address = input.customer.registeredAddress;
      if (input.customer.phoneNumber !== undefined)
        customerUpdateData.phone_number = input.customer.phoneNumber;
      if (input.customer.faxNumber !== undefined)
        customerUpdateData.fax_number = input.customer.faxNumber;
      if (input.customer.email !== undefined) customerUpdateData.email = input.customer.email;
      if (input.customer.notes !== undefined) customerUpdateData.notes = input.customer.notes;

      // issue #66: update 戻り値を保持し section 13 で再取得しないようにする
      if (Object.keys(customerUpdateData).length > 0) {
        updatedCustomerRecord = await tx.customer.update({
          where: { id: customerId },
          data: customerUpdateData,
        });
      }

      // 5. WorkInfoの更新/作成/削除
      if (input.workInfo !== undefined) {
        const existingWorkInfo = primaryRole?.customer.workInfo;

        if (input.workInfo === null) {
          if (existingWorkInfo) {
            await tx.workInfo.delete({
              where: { id: existingWorkInfo.id },
            });
            await recordEntityDeleted(tx, {
              entityType: 'WorkInfo',
              entityId: existingWorkInfo.id,
              physicalPlotId,
              contractPlotId: id,
              beforeRecord: {
                id: existingWorkInfo.id,
                company_name: existingWorkInfo.company_name,
                work_address: existingWorkInfo.work_address,
                work_phone_number: existingWorkInfo.work_phone_number,
              },
              req,
            });
          }
        } else {
          const workInfoData: any = {};
          if (input.workInfo.companyName !== undefined)
            workInfoData.company_name = input.workInfo.companyName;
          if (input.workInfo.companyNameKana !== undefined)
            workInfoData.company_name_kana = input.workInfo.companyNameKana;
          if (input.workInfo.workPostalCode !== undefined)
            workInfoData.work_postal_code = input.workInfo.workPostalCode;
          if (input.workInfo.workAddress !== undefined)
            workInfoData.work_address = input.workInfo.workAddress;
          if (input.workInfo.workPhoneNumber !== undefined)
            workInfoData.work_phone_number = input.workInfo.workPhoneNumber;
          if (input.workInfo.dmSetting !== undefined)
            workInfoData.dm_setting = input.workInfo.dmSetting;
          if (input.workInfo.addressType !== undefined)
            workInfoData.address_type = input.workInfo.addressType;
          if (input.workInfo.notes !== undefined) workInfoData.notes = input.workInfo.notes;

          if (Object.keys(workInfoData).length > 0) {
            if (existingWorkInfo) {
              const updated = await tx.workInfo.update({
                where: { id: existingWorkInfo.id },
                data: workInfoData,
              });
              await recordEntityUpdated(tx, {
                entityType: 'WorkInfo',
                entityId: existingWorkInfo.id,
                physicalPlotId,
                contractPlotId: id,
                beforeRecord: {
                  company_name: existingWorkInfo.company_name,
                  company_name_kana: existingWorkInfo.company_name_kana,
                  work_postal_code: existingWorkInfo.work_postal_code,
                  work_address: existingWorkInfo.work_address,
                  work_phone_number: existingWorkInfo.work_phone_number,
                  dm_setting: existingWorkInfo.dm_setting,
                  address_type: existingWorkInfo.address_type,
                  notes: existingWorkInfo.notes,
                },
                afterRecord: {
                  company_name: updated.company_name,
                  company_name_kana: updated.company_name_kana,
                  work_postal_code: updated.work_postal_code,
                  work_address: updated.work_address,
                  work_phone_number: updated.work_phone_number,
                  dm_setting: updated.dm_setting,
                  address_type: updated.address_type,
                  notes: updated.notes,
                },
                req,
              });
            } else {
              const created = await tx.workInfo.create({
                data: {
                  customer_id: customerId,
                  ...workInfoData,
                },
              });
              await recordEntityCreated(tx, {
                entityType: 'WorkInfo',
                entityId: created.id,
                physicalPlotId,
                contractPlotId: id,
                afterRecord: {
                  id: created.id,
                  customer_id: customerId,
                  ...workInfoData,
                },
                req,
              });
            }
          }
        }
      }

      // 6. BillingInfoの更新/作成/削除
      if (input.billingInfo !== undefined) {
        const existingBillingInfo = primaryRole?.customer.billingInfo;

        if (input.billingInfo === null) {
          if (existingBillingInfo) {
            await tx.billingInfo.delete({
              where: { id: existingBillingInfo.id },
            });
            await recordEntityDeleted(tx, {
              entityType: 'BillingInfo',
              entityId: existingBillingInfo.id,
              physicalPlotId,
              contractPlotId: id,
              beforeRecord: {
                id: existingBillingInfo.id,
                billing_type: existingBillingInfo.billing_type,
                bank_name: existingBillingInfo.bank_name,
                branch_name: existingBillingInfo.branch_name,
              },
              req,
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
              const updated = await tx.billingInfo.update({
                where: { id: existingBillingInfo.id },
                data: billingInfoData,
              });
              await recordEntityUpdated(tx, {
                entityType: 'BillingInfo',
                entityId: existingBillingInfo.id,
                physicalPlotId,
                contractPlotId: id,
                beforeRecord: {
                  billing_type: existingBillingInfo.billing_type,
                  bank_name: existingBillingInfo.bank_name,
                  branch_name: existingBillingInfo.branch_name,
                  account_type: existingBillingInfo.account_type,
                  account_number: existingBillingInfo.account_number,
                  account_holder: existingBillingInfo.account_holder,
                },
                afterRecord: {
                  billing_type: updated.billing_type,
                  bank_name: updated.bank_name,
                  branch_name: updated.branch_name,
                  account_type: updated.account_type,
                  account_number: updated.account_number,
                  account_holder: updated.account_holder,
                },
                req,
              });
            } else {
              const created = await tx.billingInfo.create({
                data: {
                  customer_id: customerId,
                  ...billingInfoData,
                },
              });
              await recordEntityCreated(tx, {
                entityType: 'BillingInfo',
                entityId: created.id,
                physicalPlotId,
                contractPlotId: id,
                afterRecord: {
                  id: created.id,
                  customer_id: customerId,
                  ...billingInfoData,
                },
                req,
              });
            }
          }
        }
      }
    }
  }

  // 7. UsageFee
  if (input.usageFee !== undefined) {
    if (input.usageFee === null) {
      if (existingContractPlot.usageFee) {
        const before = existingContractPlot.usageFee;
        await tx.usageFee.delete({
          where: { id: before.id },
        });
        await recordEntityDeleted(tx, {
          entityType: 'UsageFee',
          entityId: before.id,
          physicalPlotId,
          contractPlotId: id,
          beforeRecord: {
            id: before.id,
            calculation_type: before.calculation_type,
            tax_type: before.tax_type,
            usage_fee: before.usage_fee,
            area: before.area,
            unit_price: before.unit_price,
            payment_method: before.payment_method,
          },
          req,
        });
      }
    } else {
      const usageFeeData: any = {};
      if (input.usageFee.calculationType !== undefined)
        usageFeeData.calculation_type = input.usageFee.calculationType;
      if (input.usageFee.taxType !== undefined) usageFeeData.tax_type = input.usageFee.taxType;
      if (input.usageFee.usageFee !== undefined)
        usageFeeData.usage_fee = String(input.usageFee.usageFee ?? '');
      if (input.usageFee.area !== undefined) usageFeeData.area = String(input.usageFee.area ?? '');
      if (input.usageFee.unitPrice !== undefined)
        usageFeeData.unit_price = String(input.usageFee.unitPrice ?? '');
      if (input.usageFee.paymentMethod !== undefined)
        usageFeeData.payment_method = input.usageFee.paymentMethod;

      if (Object.keys(usageFeeData).length > 0) {
        if (existingContractPlot.usageFee) {
          const before = existingContractPlot.usageFee;
          const updated = await tx.usageFee.update({
            where: { id: before.id },
            data: usageFeeData,
          });
          await recordEntityUpdated(tx, {
            entityType: 'UsageFee',
            entityId: before.id,
            physicalPlotId,
            contractPlotId: id,
            beforeRecord: {
              calculation_type: before.calculation_type,
              tax_type: before.tax_type,
              usage_fee: before.usage_fee,
              area: before.area,
              unit_price: before.unit_price,
              payment_method: before.payment_method,
            },
            afterRecord: {
              calculation_type: updated.calculation_type,
              tax_type: updated.tax_type,
              usage_fee: updated.usage_fee,
              area: updated.area,
              unit_price: updated.unit_price,
              payment_method: updated.payment_method,
            },
            req,
          });
        } else {
          const created = await tx.usageFee.create({
            data: {
              contract_plot_id: id,
              billing_type: 'onetime',
              billing_years: '1',
              ...usageFeeData,
            },
          });
          await recordEntityCreated(tx, {
            entityType: 'UsageFee',
            entityId: created.id,
            physicalPlotId,
            contractPlotId: id,
            afterRecord: {
              id: created.id,
              calculation_type: created.calculation_type,
              tax_type: created.tax_type,
              usage_fee: created.usage_fee,
              area: created.area,
              unit_price: created.unit_price,
              payment_method: created.payment_method,
            },
            req,
          });
        }
      }
    }
  }

  // 8. ManagementFee
  if (input.managementFee !== undefined) {
    if (input.managementFee === null) {
      if (existingContractPlot.managementFee) {
        const before = existingContractPlot.managementFee;
        await tx.managementFee.delete({
          where: { id: before.id },
        });
        await recordEntityDeleted(tx, {
          entityType: 'ManagementFee',
          entityId: before.id,
          physicalPlotId,
          contractPlotId: id,
          beforeRecord: {
            id: before.id,
            management_fee: before.management_fee,
            billing_type: before.billing_type,
            billing_years: before.billing_years,
          },
          req,
        });
      }
    } else {
      const managementFeeData: any = {};
      if (input.managementFee.calculationType !== undefined)
        managementFeeData.calculation_type = input.managementFee.calculationType;
      if (input.managementFee.taxType !== undefined)
        managementFeeData.tax_type = input.managementFee.taxType;
      if (input.managementFee.billingType !== undefined)
        managementFeeData.billing_type = input.managementFee.billingType;
      if (input.managementFee.billingYears !== undefined)
        managementFeeData.billing_years = String(input.managementFee.billingYears ?? '');
      if (input.managementFee.area !== undefined)
        managementFeeData.area = String(input.managementFee.area ?? '');
      if (input.managementFee.billingMonth !== undefined)
        managementFeeData.billing_month = input.managementFee.billingMonth;
      if (input.managementFee.managementFee !== undefined)
        managementFeeData.management_fee = String(input.managementFee.managementFee ?? '');
      if (input.managementFee.unitPrice !== undefined)
        managementFeeData.unit_price = String(input.managementFee.unitPrice ?? '');
      if (input.managementFee.lastBillingMonth !== undefined)
        managementFeeData.last_billing_month = input.managementFee.lastBillingMonth;
      if (input.managementFee.paymentMethod !== undefined)
        managementFeeData.payment_method = input.managementFee.paymentMethod;

      if (Object.keys(managementFeeData).length > 0) {
        if (existingContractPlot.managementFee) {
          const before = existingContractPlot.managementFee;
          const updated = await tx.managementFee.update({
            where: { id: before.id },
            data: managementFeeData,
          });
          await recordEntityUpdated(tx, {
            entityType: 'ManagementFee',
            entityId: before.id,
            physicalPlotId,
            contractPlotId: id,
            beforeRecord: {
              calculation_type: before.calculation_type,
              tax_type: before.tax_type,
              billing_type: before.billing_type,
              billing_years: before.billing_years,
              area: before.area,
              billing_month: before.billing_month,
              management_fee: before.management_fee,
              unit_price: before.unit_price,
              last_billing_month: before.last_billing_month,
              payment_method: before.payment_method,
            },
            afterRecord: {
              calculation_type: updated.calculation_type,
              tax_type: updated.tax_type,
              billing_type: updated.billing_type,
              billing_years: updated.billing_years,
              area: updated.area,
              billing_month: updated.billing_month,
              management_fee: updated.management_fee,
              unit_price: updated.unit_price,
              last_billing_month: updated.last_billing_month,
              payment_method: updated.payment_method,
            },
            req,
          });
        } else {
          const created = await tx.managementFee.create({
            data: {
              contract_plot_id: id,
              ...managementFeeData,
            },
          });
          await recordEntityCreated(tx, {
            entityType: 'ManagementFee',
            entityId: created.id,
            physicalPlotId,
            contractPlotId: id,
            afterRecord: {
              id: created.id,
              ...managementFeeData,
            },
            req,
          });
        }
      }
    }
  }

  // 9. CollectiveBurial
  if (input.collectiveBurial !== undefined) {
    const existingCB = existingContractPlot.collectiveBurial;

    if (input.collectiveBurial === null) {
      await tx.contractPlot.update({
        where: { id },
        data: {
          burial_capacity: null,
          validity_period_years: null,
        },
      });
      if (existingCB && !existingCB.deleted_at) {
        await tx.collectiveBurial.update({
          where: { id: existingCB.id },
          data: { deleted_at: new Date() },
        });
        await recordEntityDeleted(tx, {
          entityType: 'CollectiveBurial',
          entityId: existingCB.id,
          physicalPlotId,
          contractPlotId: id,
          beforeRecord: {
            id: existingCB.id,
            burial_capacity: existingCB.burial_capacity,
            validity_period_years: existingCB.validity_period_years,
            billing_amount: existingCB.billing_amount,
            notes: existingCB.notes,
          },
          req,
        });
      }
    } else {
      await tx.contractPlot.update({
        where: { id },
        data: {
          burial_capacity: input.collectiveBurial.burialCapacity,
          validity_period_years: input.collectiveBurial.validityPeriodYears,
        },
      });

      if (existingCB && !existingCB.deleted_at) {
        const updated = await tx.collectiveBurial.update({
          where: { id: existingCB.id },
          data: {
            burial_capacity: input.collectiveBurial.burialCapacity,
            validity_period_years: input.collectiveBurial.validityPeriodYears,
            billing_amount: input.collectiveBurial.billingAmount ?? existingCB.billing_amount,
            notes:
              input.collectiveBurial.notes !== undefined
                ? input.collectiveBurial.notes || null
                : existingCB.notes,
          },
        });
        await recordEntityUpdated(tx, {
          entityType: 'CollectiveBurial',
          entityId: existingCB.id,
          physicalPlotId,
          contractPlotId: id,
          beforeRecord: {
            burial_capacity: existingCB.burial_capacity,
            validity_period_years: existingCB.validity_period_years,
            billing_amount: existingCB.billing_amount,
            notes: existingCB.notes,
          },
          afterRecord: {
            burial_capacity: updated.burial_capacity,
            validity_period_years: updated.validity_period_years,
            billing_amount: updated.billing_amount,
            notes: updated.notes,
          },
          req,
        });
      } else {
        const cbCapacity = input.collectiveBurial.burialCapacity;
        const cbPeriod = input.collectiveBurial.validityPeriodYears;
        if (!cbCapacity || !cbPeriod) {
          throw new ValidationError(
            '新規合祀設定には burialCapacity と validityPeriodYears が必須です'
          );
        }

        let cbCreated: { id: string };
        if (existingCB?.deleted_at) {
          cbCreated = await tx.collectiveBurial.update({
            where: { id: existingCB.id },
            data: {
              burial_capacity: cbCapacity,
              validity_period_years: cbPeriod,
              billing_amount: input.collectiveBurial.billingAmount ?? null,
              notes: input.collectiveBurial.notes || null,
              deleted_at: null,
            },
          });
        } else {
          cbCreated = await tx.collectiveBurial.create({
            data: {
              contract_plot_id: id,
              burial_capacity: cbCapacity,
              validity_period_years: cbPeriod,
              billing_amount: input.collectiveBurial.billingAmount ?? null,
              notes: input.collectiveBurial.notes || null,
            },
          });
        }
        await recordEntityCreated(tx, {
          entityType: 'CollectiveBurial',
          entityId: cbCreated.id,
          physicalPlotId,
          contractPlotId: id,
          afterRecord: {
            id: cbCreated.id,
            burial_capacity: cbCapacity,
            validity_period_years: cbPeriod,
            billing_amount: input.collectiveBurial.billingAmount ?? null,
            notes: input.collectiveBurial.notes || null,
          },
          req,
        });
      }
    }
  }

  // 10. 埋葬者の全置換
  if (input.buriedPersons !== undefined) {
    const existingBuriedPersons = await tx.buriedPerson.findMany({
      where: { contract_plot_id: id, deleted_at: null },
    });
    const existingIds = existingBuriedPersons.map((bp) => bp.id);
    const existingMap = new Map(existingBuriedPersons.map((bp) => [bp.id, bp]));
    const inputIds = input.buriedPersons.filter((bp) => bp.id).map((bp) => bp.id as string);

    // バッチ用履歴エントリ（このセクション終わりに createMany で一括 INSERT）
    const bpHistoryEntries: CreateHistoryInput[] = [];

    const idsToDelete = existingIds.filter((eid) => !inputIds.includes(eid));
    if (idsToDelete.length > 0) {
      await tx.buriedPerson.updateMany({
        where: { id: { in: idsToDelete } },
        data: { deleted_at: new Date() },
      });
      for (const delId of idsToDelete) {
        const before = existingMap.get(delId)!;
        bpHistoryEntries.push({
          entityType: 'BuriedPerson',
          entityId: delId,
          physicalPlotId,
          contractPlotId: id,
          actionType: 'DELETE',
          beforeRecord: {
            id: before.id,
            name: before.name,
            death_date: before.death_date?.toISOString() ?? null,
            burial_date: before.burial_date?.toISOString() ?? null,
          },
          req,
        });
      }
    }

    for (const bp of input.buriedPersons) {
      const bpData = {
        name: bp.name,
        name_kana: bp.nameKana || null,
        relationship: bp.relationship || null,
        birth_date: bp.birthDate ? new Date(bp.birthDate) : null,
        death_date: bp.deathDate ? new Date(bp.deathDate) : null,
        age: bp.age ?? null,
        gender: bp.gender || null,
        burial_date: bp.burialDate ? new Date(bp.burialDate) : null,
        posthumous_name: bp.posthumousName || null,
        report_date: bp.reportDate ? new Date(bp.reportDate) : null,
        religion: bp.religion || null,
        notes: bp.notes || null,
      };

      const serialize = (data: typeof bpData) => ({
        name: data.name,
        name_kana: data.name_kana,
        relationship: data.relationship,
        birth_date: data.birth_date?.toISOString() ?? null,
        death_date: data.death_date?.toISOString() ?? null,
        age: data.age,
        gender: data.gender,
        burial_date: data.burial_date?.toISOString() ?? null,
        posthumous_name: data.posthumous_name,
        report_date: data.report_date?.toISOString() ?? null,
        religion: data.religion,
        notes: data.notes,
      });

      if (bp.id && existingIds.includes(bp.id)) {
        const before = existingMap.get(bp.id)!;
        await tx.buriedPerson.update({
          where: { id: bp.id },
          data: bpData,
        });
        bpHistoryEntries.push({
          entityType: 'BuriedPerson',
          entityId: bp.id,
          physicalPlotId,
          contractPlotId: id,
          actionType: 'UPDATE',
          beforeRecord: {
            name: before.name,
            name_kana: before.name_kana,
            relationship: before.relationship,
            birth_date: before.birth_date?.toISOString() ?? null,
            death_date: before.death_date?.toISOString() ?? null,
            age: before.age,
            gender: before.gender,
            burial_date: before.burial_date?.toISOString() ?? null,
            posthumous_name: before.posthumous_name,
            report_date: before.report_date?.toISOString() ?? null,
            religion: before.religion,
            notes: before.notes,
          },
          afterRecord: serialize(bpData),
          req,
        });
      } else {
        const created = await tx.buriedPerson.create({
          data: {
            contract_plot_id: id,
            ...bpData,
          },
        });
        bpHistoryEntries.push({
          entityType: 'BuriedPerson',
          entityId: created.id,
          physicalPlotId,
          contractPlotId: id,
          actionType: 'CREATE',
          afterRecord: { id: created.id, ...serialize(bpData) },
          req,
        });
      }
    }

    // 履歴エントリをまとめて INSERT（issue #66: N 件の個別 INSERT を 1 回に）
    await recordHistoryBatch(tx, bpHistoryEntries);

    const contractPlotForCB = await tx.contractPlot.findUnique({
      where: { id },
      select: { burial_capacity: true },
    });
    if (contractPlotForCB?.burial_capacity) {
      await updateCollectiveBurialCount(tx, id);
    }
  }

  // 11. 工事情報の全置換
  if (input.constructionInfos !== undefined) {
    const existingConstructionInfos = await tx.constructionInfo.findMany({
      where: { contract_plot_id: id, deleted_at: null },
    });
    const existingCiIds = existingConstructionInfos.map((ci) => ci.id);
    const existingCiMap = new Map(existingConstructionInfos.map((ci) => [ci.id, ci]));
    const inputCiIds = input.constructionInfos.filter((ci) => ci.id).map((ci) => ci.id as string);

    // バッチ用履歴エントリ（issue #66）
    const ciHistoryEntries: CreateHistoryInput[] = [];

    const ciIdsToDelete = existingCiIds.filter((eid) => !inputCiIds.includes(eid));
    if (ciIdsToDelete.length > 0) {
      await tx.constructionInfo.updateMany({
        where: { id: { in: ciIdsToDelete } },
        data: { deleted_at: new Date() },
      });
      for (const delId of ciIdsToDelete) {
        const before = existingCiMap.get(delId)!;
        ciHistoryEntries.push({
          entityType: 'ConstructionInfo',
          entityId: delId,
          physicalPlotId,
          contractPlotId: id,
          actionType: 'DELETE',
          beforeRecord: {
            id: before.id,
            construction_type: before.construction_type,
            contractor: before.contractor,
            start_date: before.start_date?.toISOString() ?? null,
            completion_date: before.completion_date?.toISOString() ?? null,
          },
          req,
        });
      }
    }

    for (const ci of input.constructionInfos) {
      const ciData = {
        construction_type: ci.constructionType || null,
        start_date: ci.startDate ? new Date(ci.startDate) : null,
        completion_date: ci.completionDate ? new Date(ci.completionDate) : null,
        contractor: ci.contractor || null,
        supervisor: ci.supervisor || null,
        progress: ci.progress || null,
        work_item_1: ci.workItem1 || null,
        work_date_1: ci.workDate1 ? new Date(ci.workDate1) : null,
        work_amount_1: ci.workAmount1 ?? null,
        work_status_1: ci.workStatus1 || null,
        work_item_2: ci.workItem2 || null,
        work_date_2: ci.workDate2 ? new Date(ci.workDate2) : null,
        work_amount_2: ci.workAmount2 ?? null,
        work_status_2: ci.workStatus2 || null,
        permit_number: ci.permitNumber || null,
        application_date: ci.applicationDate ? new Date(ci.applicationDate) : null,
        permit_date: ci.permitDate ? new Date(ci.permitDate) : null,
        permit_status: ci.permitStatus || null,
        payment_type_1: ci.paymentType1 || null,
        payment_amount_1: ci.paymentAmount1 ?? null,
        payment_date_1: ci.paymentDate1 ? new Date(ci.paymentDate1) : null,
        payment_status_1: ci.paymentStatus1 || null,
        payment_type_2: ci.paymentType2 || null,
        payment_amount_2: ci.paymentAmount2 ?? null,
        payment_date_2: ci.paymentScheduledDate2 ? new Date(ci.paymentScheduledDate2) : null,
        payment_status_2: ci.paymentStatus2 || null,
        scheduled_end_date: ci.scheduledEndDate ? new Date(ci.scheduledEndDate) : null,
        construction_content: ci.constructionContent || null,
        notes: ci.notes || null,
      };

      const serializeCi = (data: typeof ciData) => {
        const result: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(data)) {
          result[k] = v instanceof Date ? v.toISOString() : v;
        }
        return result;
      };

      if (ci.id && existingCiIds.includes(ci.id)) {
        const before = existingCiMap.get(ci.id)!;
        await tx.constructionInfo.update({
          where: { id: ci.id },
          data: ciData,
        });
        const beforeSerialized: Record<string, unknown> = {};
        for (const key of Object.keys(ciData)) {
          const v = (before as any)[key];
          beforeSerialized[key] = v instanceof Date ? v.toISOString() : v;
        }
        ciHistoryEntries.push({
          entityType: 'ConstructionInfo',
          entityId: ci.id,
          physicalPlotId,
          contractPlotId: id,
          actionType: 'UPDATE',
          beforeRecord: beforeSerialized,
          afterRecord: serializeCi(ciData),
          req,
        });
      } else {
        const created = await tx.constructionInfo.create({
          data: {
            contract_plot_id: id,
            ...ciData,
          },
        });
        ciHistoryEntries.push({
          entityType: 'ConstructionInfo',
          entityId: created.id,
          physicalPlotId,
          contractPlotId: id,
          actionType: 'CREATE',
          afterRecord: { id: created.id, ...serializeCi(ciData) },
          req,
        });
      }
    }

    // 履歴エントリをまとめて INSERT（issue #66）
    await recordHistoryBatch(tx, ciHistoryEntries);
  }

  // 12. 契約面積が変更された場合、物理区画のステータス更新
  if (
    input.contractPlot?.contractAreaSqm !== undefined &&
    input.contractPlot.contractAreaSqm !== oldContractArea
  ) {
    await updatePhysicalPlotStatus(tx as any, physicalPlotId);
  }

  // 13. 履歴の自動記録（ContractPlot、Customer）
  if (Object.keys(updateData).length > 0) {
    const beforeContractPlotData = {
      contract_area_sqm: existingContractPlot.contract_area_sqm.toString(),
      location_description: existingContractPlot.location_description,
      contract_date: existingContractPlot.contract_date?.toISOString(),
      price: existingContractPlot.price,
      payment_status: existingContractPlot.payment_status,
      reservation_date: existingContractPlot.reservation_date?.toISOString(),
      acceptance_number: existingContractPlot.acceptance_number,
      permit_date: existingContractPlot.permit_date?.toISOString(),
      start_date: existingContractPlot.start_date?.toISOString(),
      uncollected_amount: existingContractPlot.uncollected_amount,
      notes: existingContractPlot.notes,
    };

    // issue #66: section 2 の update 戻り値を再利用（findUnique 1 クエリ削減）
    const updatedCp = updatedContractPlotRecord;
    const afterContractPlotData = updatedCp
      ? {
          contract_area_sqm: updatedCp.contract_area_sqm.toString(),
          location_description: updatedCp.location_description,
          contract_date: updatedCp.contract_date?.toISOString(),
          price: updatedCp.price,
          payment_status: updatedCp.payment_status,
          reservation_date: updatedCp.reservation_date?.toISOString(),
          acceptance_number: updatedCp.acceptance_number,
          permit_date: updatedCp.permit_date?.toISOString(),
          start_date: updatedCp.start_date?.toISOString(),
          uncollected_amount: updatedCp.uncollected_amount,
          notes: updatedCp.notes,
        }
      : beforeContractPlotData;

    await recordContractPlotUpdated(
      tx,
      beforeContractPlotData,
      afterContractPlotData,
      physicalPlotId,
      id,
      req
    );
  }

  if (input.customer) {
    const primaryRole = existingContractPlot.saleContractRoles?.find(
      (role: any) => role.role === 'contractor'
    );
    const existingCustomer = primaryRole?.customer;

    if (existingCustomer) {
      const beforeCustomerData = {
        name: existingCustomer.name,
        name_kana: existingCustomer.name_kana,
        birth_date: existingCustomer.birth_date?.toISOString(),
        gender: existingCustomer.gender,
        postal_code: existingCustomer.postal_code,
        address: existingCustomer.address,
        phone_number: existingCustomer.phone_number,
        email: existingCustomer.email,
      };

      // issue #66: section 4 の update 戻り値を再利用（findUnique 1 クエリ削減）
      const updatedCustomer = updatedCustomerRecord;
      const afterCustomerData = updatedCustomer
        ? {
            name: updatedCustomer.name,
            name_kana: updatedCustomer.name_kana,
            birth_date: updatedCustomer.birth_date?.toISOString(),
            gender: updatedCustomer.gender,
            postal_code: updatedCustomer.postal_code,
            address: updatedCustomer.address,
            phone_number: updatedCustomer.phone_number,
            email: updatedCustomer.email,
          }
        : beforeCustomerData;

      await recordCustomerUpdated(
        tx,
        beforeCustomerData,
        afterCustomerData,
        existingCustomer.id,
        id,
        physicalPlotId,
        req
      );
    }
  }
}

/**
 * 契約区画更新
 * PUT /api/v1/plots/:id
 */
export const updatePlot = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params as Record<string, string>;
    const input: UpdatePlotRequest = req.body;

    // 履歴記録の createMany バッチ化・不要な findUnique 削減（issue #66）で
    // クエリ数は線形増加から定数的な増加に抑制。暫定 30 秒から 10 秒に短縮。
    await prisma.$transaction(
      async (tx) => {
        await updatePlotCore(tx, id as string, input, req);
      },
      {
        timeout: 10000,
      }
    );

    // 更新後のデータを取得して返却
    const updatedContractPlot = await prisma.contractPlot.findUnique({
      where: { id },
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

    const primaryRole = updatedContractPlot?.saleContractRoles?.find(
      (role) => role.role === 'contractor'
    );
    const primaryCustomer = primaryRole?.customer;

    res.status(200).json({
      success: true,
      data: {
        id: updatedContractPlot?.id,
        contractAreaSqm: updatedContractPlot?.contract_area_sqm.toNumber(),
        locationDescription: updatedContractPlot?.location_description,

        contractDate: updatedContractPlot?.contract_date,
        price: updatedContractPlot?.price,
        paymentStatus: updatedContractPlot?.payment_status,
        reservationDate: updatedContractPlot?.reservation_date,
        acceptanceNumber: updatedContractPlot?.acceptance_number,
        permitDate: updatedContractPlot?.permit_date,
        permitNumber: updatedContractPlot?.permit_number,
        startDate: updatedContractPlot?.start_date,
        uncollectedAmount: updatedContractPlot?.uncollected_amount,
        notes: updatedContractPlot?.notes,

        physicalPlot: {
          id: updatedContractPlot?.physicalPlot.id,
          plotNumber: updatedContractPlot?.physicalPlot.plot_number,
          areaName: updatedContractPlot?.physicalPlot.area_name,
          areaSqm: updatedContractPlot?.physicalPlot.area_sqm.toNumber(),
          status: updatedContractPlot?.physicalPlot.status,
        },

        primaryCustomer: primaryCustomer
          ? {
              id: primaryCustomer.id,
              name: primaryCustomer.name,
              nameKana: primaryCustomer.name_kana,
              phoneNumber: primaryCustomer.phone_number,
              address: primaryCustomer.address,
              role: primaryRole?.role,
            }
          : null,

        roles:
          updatedContractPlot?.saleContractRoles?.map((role) => ({
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
          })) || [],

        collectiveBurial:
          updatedContractPlot?.collectiveBurial && !updatedContractPlot.collectiveBurial.deleted_at
            ? {
                id: updatedContractPlot.collectiveBurial.id,
                burialCapacity: updatedContractPlot.collectiveBurial.burial_capacity,
                currentBurialCount: updatedContractPlot.collectiveBurial.current_burial_count,
                capacityReachedDate: updatedContractPlot.collectiveBurial.capacity_reached_date,
                validityPeriodYears: updatedContractPlot.collectiveBurial.validity_period_years,
                billingScheduledDate: updatedContractPlot.collectiveBurial.billing_scheduled_date,
                billingStatus: updatedContractPlot.collectiveBurial.billing_status,
                billingAmount: updatedContractPlot.collectiveBurial.billing_amount,
                notes: updatedContractPlot.collectiveBurial.notes,
              }
            : null,

        updatedAt: updatedContractPlot?.updated_at,
      },
    });
  } catch (error) {
    next(error);
  }
};
