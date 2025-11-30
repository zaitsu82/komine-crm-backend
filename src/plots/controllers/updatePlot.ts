/**
 * 契約区画更新エンドポイント
 * PUT /api/v1/plots/:id
 *
 * ContractPlot、SaleContract、Customer、関連情報の部分更新を行います。
 */

import { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { UpdateContractPlotInput } from '../../type';
import { updatePhysicalPlotStatus } from '../../utils/inventoryUtils';

const prisma = new PrismaClient();

/**
 * 契約区画更新
 * PUT /api/v1/plots/:id
 */
export const updatePlot = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const input: UpdateContractPlotInput = req.body;

    // トランザクション処理
    await prisma.$transaction(async (tx) => {
      // 1. 既存のContractPlotを取得
      const existingContractPlot = await tx.contractPlot.findUnique({
        where: { id, deleted_at: null },
        include: {
          PhysicalPlot: true,
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

      if (!existingContractPlot) {
        throw new Error('指定された契約区画が見つかりません');
      }

      const physicalPlotId = existingContractPlot.physical_plot_id;
      const oldContractArea = existingContractPlot.contract_area_sqm.toNumber();

      // 2. ContractPlotの更新
      if (input.contractPlot) {
        const updateData: any = {};

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
          const physicalPlotArea = existingContractPlot.PhysicalPlot.area_sqm.toNumber();

          if (totalAfterUpdate > physicalPlotArea) {
            throw new Error(
              `契約面積の合計が物理区画の面積を超えています（物理区画: ${physicalPlotArea}㎡、合計: ${totalAfterUpdate}㎡）`
            );
          }

          updateData.contract_area_sqm = new Prisma.Decimal(newAreaSqm);
        }

        if (input.contractPlot.saleStatus !== undefined) {
          updateData.sale_status = input.contractPlot.saleStatus;
        }

        if (input.contractPlot.locationDescription !== undefined) {
          updateData.location_description = input.contractPlot.locationDescription;
        }

        if (Object.keys(updateData).length > 0) {
          await tx.contractPlot.update({
            where: { id },
            data: updateData,
          });
        }
      }

      // 3. SaleContractの更新
      if (input.saleContract && existingContractPlot.SaleContract) {
        const updateData: any = {};

        if (input.saleContract.contractDate !== undefined) {
          updateData.contract_date = new Date(input.saleContract.contractDate);
        }
        if (input.saleContract.price !== undefined) {
          updateData.price = new Prisma.Decimal(input.saleContract.price);
        }
        if (input.saleContract.paymentStatus !== undefined) {
          updateData.payment_status = input.saleContract.paymentStatus;
        }
        if (input.saleContract.customerRole !== undefined) {
          updateData.customer_role = input.saleContract.customerRole;
        }
        if (input.saleContract.reservationDate !== undefined) {
          updateData.reservation_date = input.saleContract.reservationDate
            ? new Date(input.saleContract.reservationDate)
            : null;
        }
        if (input.saleContract.acceptanceNumber !== undefined) {
          updateData.acceptance_number = input.saleContract.acceptanceNumber;
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
        if (input.saleContract.notes !== undefined) {
          updateData.notes = input.saleContract.notes;
        }

        if (Object.keys(updateData).length > 0) {
          await tx.saleContract.update({
            where: { id: existingContractPlot.SaleContract.id },
            data: updateData,
          });
        }
      }

      // 4. Customerの更新
      if (input.customer && existingContractPlot.SaleContract) {
        const customerId = existingContractPlot.SaleContract.customer_id;
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
          const existingWorkInfo = existingContractPlot.SaleContract.Customer.WorkInfo;

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
          const existingBillingInfo = existingContractPlot.SaleContract.Customer.BillingInfo;

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

      // 7. UsageFeeの更新/作成/削除
      if (input.usageFee !== undefined) {
        if (input.usageFee === null) {
          // 削除
          if (existingContractPlot.UsageFee) {
            await tx.usageFee.delete({
              where: { id: existingContractPlot.UsageFee.id },
            });
          }
        } else {
          // 更新または作成
          const usageFeeData: any = {};
          if (input.usageFee.calculationType !== undefined)
            usageFeeData.calculation_type = input.usageFee.calculationType;
          if (input.usageFee.taxType !== undefined) usageFeeData.tax_type = input.usageFee.taxType;
          if (input.usageFee.usageFee !== undefined)
            usageFeeData.usage_fee = input.usageFee.usageFee.toString();
          if (input.usageFee.area !== undefined) usageFeeData.area = input.usageFee.area.toString();
          if (input.usageFee.unitPrice !== undefined)
            usageFeeData.unit_price = input.usageFee.unitPrice.toString();
          if (input.usageFee.paymentMethod !== undefined)
            usageFeeData.payment_method = input.usageFee.paymentMethod;

          if (Object.keys(usageFeeData).length > 0) {
            if (existingContractPlot.UsageFee) {
              await tx.usageFee.update({
                where: { id: existingContractPlot.UsageFee.id },
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
          if (existingContractPlot.ManagementFee) {
            await tx.managementFee.delete({
              where: { id: existingContractPlot.ManagementFee.id },
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
            managementFeeData.billing_years = input.managementFee.billingYears.toString();
          if (input.managementFee.area !== undefined)
            managementFeeData.area = input.managementFee.area.toString();
          if (input.managementFee.billingMonth !== undefined)
            managementFeeData.billing_month = input.managementFee.billingMonth;
          if (input.managementFee.managementFee !== undefined)
            managementFeeData.management_fee = input.managementFee.managementFee.toString();
          if (input.managementFee.unitPrice !== undefined)
            managementFeeData.unit_price = input.managementFee.unitPrice.toString();
          if (input.managementFee.lastBillingMonth !== undefined)
            managementFeeData.last_billing_month = input.managementFee.lastBillingMonth;
          if (input.managementFee.paymentMethod !== undefined)
            managementFeeData.payment_method = input.managementFee.paymentMethod;

          if (Object.keys(managementFeeData).length > 0) {
            if (existingContractPlot.ManagementFee) {
              await tx.managementFee.update({
                where: { id: existingContractPlot.ManagementFee.id },
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
    });

    // 更新後のデータを取得して返却
    const updatedContractPlot = await prisma.contractPlot.findUnique({
      where: { id },
      include: {
        PhysicalPlot: true,
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

    res.status(200).json({
      success: true,
      data: {
        id: updatedContractPlot?.id,
        contractAreaSqm: updatedContractPlot?.contract_area_sqm.toNumber(),
        saleStatus: updatedContractPlot?.sale_status,
        locationDescription: updatedContractPlot?.location_description,
        physicalPlot: {
          id: updatedContractPlot?.PhysicalPlot.id,
          plotNumber: updatedContractPlot?.PhysicalPlot.plot_number,
          areaName: updatedContractPlot?.PhysicalPlot.area_name,
          areaSqm: updatedContractPlot?.PhysicalPlot.area_sqm.toNumber(),
          status: updatedContractPlot?.PhysicalPlot.status,
        },
        saleContract: updatedContractPlot?.SaleContract
          ? {
              id: updatedContractPlot.SaleContract.id,
              contractDate: updatedContractPlot.SaleContract.contract_date,
              price: updatedContractPlot.SaleContract.price.toNumber(),
              paymentStatus: updatedContractPlot.SaleContract.payment_status,
              customerRole: updatedContractPlot.SaleContract.customer_role,
              customer: {
                id: updatedContractPlot.SaleContract.Customer.id,
                name: updatedContractPlot.SaleContract.Customer.name,
                nameKana: updatedContractPlot.SaleContract.Customer.name_kana,
                phoneNumber: updatedContractPlot.SaleContract.Customer.phone_number,
                address: updatedContractPlot.SaleContract.Customer.address,
              },
            }
          : null,
        updatedAt: updatedContractPlot?.updated_at,
      },
    });
  } catch (error) {
    console.error('Error updating contract plot:', error);

    if (error instanceof Error && error.message) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message,
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '契約区画の更新に失敗しました',
      },
    });
  }
};
