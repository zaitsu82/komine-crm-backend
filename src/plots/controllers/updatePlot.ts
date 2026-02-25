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
import { recordContractPlotUpdated, recordCustomerUpdated } from '../services/historyService';

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
    const { id } = req.params;
    const input: UpdatePlotRequest = req.body;

    // トランザクション処理
    await prisma.$transaction(async (tx) => {
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
        },
      });

      if (!existingContractPlot) {
        throw new NotFoundError('指定された契約区画が見つかりません');
      }

      const physicalPlotId = existingContractPlot.physical_plot_id;
      const oldContractArea = existingContractPlot.contract_area_sqm.toNumber();

      // 2. ContractPlot（販売契約情報統合済み）の更新
      const updateData: any = {};

      // 契約区画情報の更新
      if (input.contractPlot) {
        if (input.contractPlot.contractAreaSqm !== undefined) {
          // 契約面積が変更された場合は妥当性検証
          const newAreaSqm = input.contractPlot.contractAreaSqm;

          // 他の契約の合計面積を計算（現在の契約を除く）
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

      // 販売契約情報の更新（ContractPlotに統合済み）
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

      // ContractPlotの更新を実行
      if (Object.keys(updateData).length > 0) {
        await tx.contractPlot.update({
          where: { id },
          data: updateData,
        });
      }

      // 3. 顧客役割の更新
      if (input.saleContract?.roles !== undefined) {
        // 既存の役割を論理削除
        await tx.saleContractRole.updateMany({
          where: {
            contract_plot_id: id, // sale_contract_id → contract_plot_idに変更
            deleted_at: null,
          },
          data: {
            deleted_at: new Date(),
          },
        });

        // 新しい役割を作成
        for (const roleData of input.saleContract.roles) {
          // customerId が指定されていない場合はエラー
          if (!roleData.customerId) {
            throw new ValidationError('役割更新時は customerId が必須です');
          }

          await tx.saleContractRole.create({
            data: {
              contract_plot_id: existingContractPlot.id, // sale_contract_id → contract_plot_idに変更
              customer_id: roleData.customerId,
              role: roleData.role,
              role_start_date: roleData.roleStartDate ? new Date(roleData.roleStartDate) : null,
              role_end_date: roleData.roleEndDate ? new Date(roleData.roleEndDate) : null,
              notes: roleData.notes || null,
            },
          });
        }
      }

      // 4. Customerの更新（主契約者を対象）
      if (input.customer) {
        // 主契約者を取得
        const primaryRole = existingContractPlot.saleContractRoles?.find(
          (role: any) => role.role === 'contractor'
        );
        const customerId = primaryRole?.customer.id;

        if (customerId) {
          const updateData: any = {};

          if (input.customer.name !== undefined) updateData.name = input.customer.name;
          if (input.customer.nameKana !== undefined) updateData.name_kana = input.customer.nameKana;
          if (input.customer.birthDate !== undefined) {
            updateData.birth_date = input.customer.birthDate
              ? new Date(input.customer.birthDate)
              : null;
          }
          if (input.customer.gender !== undefined) updateData.gender = input.customer.gender;
          if (input.customer.postalCode !== undefined)
            updateData.postal_code = input.customer.postalCode;
          if (input.customer.address !== undefined) updateData.address = input.customer.address;
          if (input.customer.addressLine2 !== undefined)
            updateData.address_line_2 = input.customer.addressLine2;
          if (input.customer.registeredAddress !== undefined)
            updateData.registered_address = input.customer.registeredAddress;
          if (input.customer.phoneNumber !== undefined)
            updateData.phone_number = input.customer.phoneNumber;
          if (input.customer.faxNumber !== undefined)
            updateData.fax_number = input.customer.faxNumber;
          if (input.customer.email !== undefined) updateData.email = input.customer.email;
          if (input.customer.notes !== undefined) updateData.notes = input.customer.notes;

          if (Object.keys(updateData).length > 0) {
            await tx.customer.update({
              where: { id: customerId },
              data: updateData,
            });
          }

          // 5. WorkInfoの更新/作成/削除
          if (input.workInfo !== undefined) {
            const existingWorkInfo = primaryRole?.customer.workInfo;

            if (input.workInfo === null) {
              // 削除
              if (existingWorkInfo) {
                await tx.workInfo.delete({
                  where: { id: existingWorkInfo.id },
                });
              }
            } else {
              // 更新または作成
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
                  await tx.workInfo.update({
                    where: { id: existingWorkInfo.id },
                    data: workInfoData,
                  });
                } else {
                  await tx.workInfo.create({
                    data: {
                      customer_id: customerId,
                      ...workInfoData,
                    },
                  });
                }
              }
            }
          }

          // 6. BillingInfoの更新/作成/削除
          if (input.billingInfo !== undefined) {
            const existingBillingInfo = primaryRole?.customer.billingInfo;

            if (input.billingInfo === null) {
              // 削除
              if (existingBillingInfo) {
                await tx.billingInfo.delete({
                  where: { id: existingBillingInfo.id },
                });
              }
            } else {
              // 更新または作成
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
                  await tx.billingInfo.update({
                    where: { id: existingBillingInfo.id },
                    data: billingInfoData,
                  });
                } else {
                  await tx.billingInfo.create({
                    data: {
                      customer_id: customerId,
                      ...billingInfoData,
                    },
                  });
                }
              }
            }
          }
        }
      }

      // 7. UsageFeeの更新/作成/削除
      if (input.usageFee !== undefined) {
        if (input.usageFee === null) {
          // 削除
          if (existingContractPlot.usageFee) {
            await tx.usageFee.delete({
              where: { id: existingContractPlot.usageFee.id },
            });
          }
        } else {
          // 更新または作成
          const usageFeeData: any = {};
          if (input.usageFee.calculationType !== undefined)
            usageFeeData.calculation_type = input.usageFee.calculationType;
          if (input.usageFee.taxType !== undefined) usageFeeData.tax_type = input.usageFee.taxType;
          if (input.usageFee.usageFee !== undefined)
            usageFeeData.usage_fee = String(input.usageFee.usageFee ?? '');
          if (input.usageFee.area !== undefined)
            usageFeeData.area = String(input.usageFee.area ?? '');
          if (input.usageFee.unitPrice !== undefined)
            usageFeeData.unit_price = String(input.usageFee.unitPrice ?? '');
          if (input.usageFee.paymentMethod !== undefined)
            usageFeeData.payment_method = input.usageFee.paymentMethod;

          if (Object.keys(usageFeeData).length > 0) {
            if (existingContractPlot.usageFee) {
              await tx.usageFee.update({
                where: { id: existingContractPlot.usageFee.id },
                data: usageFeeData,
              });
            } else {
              await tx.usageFee.create({
                data: {
                  contract_plot_id: id,
                  billing_type: 'onetime',
                  billing_years: '1',
                  ...usageFeeData,
                },
              });
            }
          }
        }
      }

      // 8. ManagementFeeの更新/作成/削除
      if (input.managementFee !== undefined) {
        if (input.managementFee === null) {
          // 削除
          if (existingContractPlot.managementFee) {
            await tx.managementFee.delete({
              where: { id: existingContractPlot.managementFee.id },
            });
          }
        } else {
          // 更新または作成
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
              await tx.managementFee.update({
                where: { id: existingContractPlot.managementFee.id },
                data: managementFeeData,
              });
            } else {
              await tx.managementFee.create({
                data: {
                  contract_plot_id: id,
                  ...managementFeeData,
                },
              });
            }
          }
        }
      }

      // 9. 契約面積が変更された場合、物理区画のステータス更新
      if (
        input.contractPlot?.contractAreaSqm !== undefined &&
        input.contractPlot.contractAreaSqm !== oldContractArea
      ) {
        await updatePhysicalPlotStatus(tx as any, physicalPlotId);
      }

      // 10. 履歴の自動記録
      // ContractPlotの更新履歴
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

        const updatedCp = await tx.contractPlot.findUnique({ where: { id } });
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
          id as string,
          req
        );
      }

      // Customerの更新履歴
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

          const updatedCustomer = await tx.customer.findUnique({
            where: { id: existingCustomer.id },
          });
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
            id as string,
            physicalPlotId,
            req
          );
        }
      }
    });

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
      },
    });

    // 主契約者（role='contractor'）を取得（後方互換性のため）
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

        // 販売契約情報（ContractPlotに統合済み）
        contractDate: updatedContractPlot?.contract_date,
        price: updatedContractPlot?.price,
        paymentStatus: updatedContractPlot?.payment_status,
        reservationDate: updatedContractPlot?.reservation_date,
        acceptanceNumber: updatedContractPlot?.acceptance_number,
        permitDate: updatedContractPlot?.permit_date,
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

        // 後方互換性: 主契約者の情報
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

        // 全ての役割と顧客情報
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

        updatedAt: updatedContractPlot?.updated_at,
      },
    });
  } catch (error) {
    next(error);
  }
};
