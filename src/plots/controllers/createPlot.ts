/**
 * 新規契約作成エンドポイント
 * POST /api/v1/plots
 *
 * ContractPlot（販売契約情報統合済み） + Customer を作成します。
 * 物理区画（PhysicalPlot）の新規作成または既存区画への契約追加に対応。
 */

import { Request, Response, NextFunction } from 'express';
import { Prisma, PaymentStatus, ContractRole } from '@prisma/client';
import { CreateContractPlotInput } from '../types';
import { validateContractArea, updatePhysicalPlotStatus } from '../utils';
import prisma from '../../db/prisma';
import { ValidationError, NotFoundError } from '../../middleware/errorHandler';
import { recordContractPlotCreated, recordCustomerCreated } from '../services/historyService';

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
    const input: CreateContractPlotInput = req.body;

    // 入力バリデーション
    if (!input.contractPlot || !input.saleContract || !input.customer) {
      throw new ValidationError('contractPlot, saleContract, customerは必須です');
    }

    // 契約面積のバリデーション
    if (!input.contractPlot.contractAreaSqm || input.contractPlot.contractAreaSqm <= 0) {
      throw new ValidationError('契約面積は0より大きい値を指定してください');
    }

    // トランザクション処理
    const result = await prisma.$transaction(async (tx) => {
      // 1. PhysicalPlotの取得または作成
      let physicalPlot;
      if (input.physicalPlot.id) {
        // 既存の物理区画を取得
        physicalPlot = await tx.physicalPlot.findUnique({
          where: { id: input.physicalPlot.id, deleted_at: null },
        });

        if (!physicalPlot) {
          throw new NotFoundError('指定された物理区画が見つかりません');
        }
      } else {
        // 新規物理区画を作成
        if (!input.physicalPlot.plotNumber || !input.physicalPlot.areaName) {
          throw new ValidationError('新規物理区画作成時は plotNumber と areaName が必須です');
        }

        physicalPlot = await tx.physicalPlot.create({
          data: {
            plot_number: input.physicalPlot.plotNumber,
            area_name: input.physicalPlot.areaName,
            area_sqm: new Prisma.Decimal(input.physicalPlot.areaSqm || 3.6),
            status: 'available', // 初期ステータス
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
      if (input.workInfo) {
        await tx.workInfo.create({
          data: {
            customer_id: customer.id,
            company_name: input.workInfo.companyName,
            company_name_kana: input.workInfo.companyNameKana,
            work_postal_code: input.workInfo.workPostalCode,
            work_address: input.workInfo.workAddress,
            work_phone_number: input.workInfo.workPhoneNumber,
            dm_setting: input.workInfo.dmSetting,
            address_type: input.workInfo.addressType,
            notes: input.workInfo.notes || null,
          },
        });
      }

      // 5. 請求情報の作成（オプション）
      if (input.billingInfo) {
        await tx.billingInfo.create({
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
          // 販売契約情報（ContractPlotに統合済み）
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
          permit_date: input.saleContract.permitDate
            ? new Date(input.saleContract.permitDate)
            : null,
          start_date: input.saleContract.startDate ? new Date(input.saleContract.startDate) : null,
          uncollected_amount: input.saleContract.uncollectedAmount ?? 0,
          notes: input.saleContract.notes || null,
        },
      });

      // 7. 契約における顧客役割の作成
      // 新方式: roles配列が指定されている場合
      if (input.saleContract.roles && input.saleContract.roles.length > 0) {
        for (const roleData of input.saleContract.roles) {
          await tx.saleContractRole.create({
            data: {
              contract_plot_id: contractPlot.id, // sale_contract_id → contract_plot_idに変更
              customer_id: roleData.customerId || customer.id, // 指定がなければ作成した顧客を使用
              role: roleData.role,
              role_start_date: roleData.roleStartDate ? new Date(roleData.roleStartDate) : null,
              role_end_date: roleData.roleEndDate ? new Date(roleData.roleEndDate) : null,
              notes: roleData.notes || null,
            },
          });
        }
      } else {
        // 旧方式（後方互換性）: customerとcustomerRoleから1つの役割を作成
        await tx.saleContractRole.create({
          data: {
            contract_plot_id: contractPlot.id, // sale_contract_id → contract_plot_idに変更
            customer_id: customer.id,
            role: (input.saleContract.customerRole as ContractRole) || ContractRole.contractor,
          },
        });
      }

      // 8. 使用料情報の作成（オプション）
      if (input.usageFee) {
        await tx.usageFee.create({
          data: {
            contract_plot_id: contractPlot.id,
            calculation_type: input.usageFee.calculationType,
            tax_type: input.usageFee.taxType,
            billing_type: 'onetime', // デフォルト値
            billing_years: '1', // デフォルト値
            usage_fee: input.usageFee.usageFee.toString(),
            area: input.usageFee.area.toString(),
            unit_price: input.usageFee.unitPrice.toString(),
            payment_method: input.usageFee.paymentMethod,
          },
        });
      }

      // 9. 管理料情報の作成（オプション）
      if (input.managementFee) {
        await tx.managementFee.create({
          data: {
            contract_plot_id: contractPlot.id,
            calculation_type: input.managementFee.calculationType,
            tax_type: input.managementFee.taxType,
            billing_type: input.managementFee.billingType,
            billing_years: input.managementFee.billingYears.toString(),
            area: input.managementFee.area.toString(),
            billing_month: input.managementFee.billingMonth,
            management_fee: input.managementFee.managementFee.toString(),
            unit_price: input.managementFee.unitPrice.toString(),
            last_billing_month: input.managementFee.lastBillingMonth,
            payment_method: input.managementFee.paymentMethod,
          },
        });
      }

      // 9. 物理区画のステータス更新
      await updatePhysicalPlotStatus(tx as any, physicalPlot.id);

      // 10. 履歴の自動記録
      await recordContractPlotCreated(tx, contractPlot, req);
      await recordCustomerCreated(tx, customer, contractPlot.id, physicalPlot.id, req);

      return {
        contractPlot,
        customer,
        physicalPlot,
      };
    });

    // 作成完了後、詳細情報を取得して返却
    const createdContractPlot = await prisma.contractPlot.findUnique({
      where: { id: result.contractPlot.id },
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

    // 最初の役割を取得（後方互換性のため）
    const firstRole = createdContractPlot?.saleContractRoles?.[0];
    const firstCustomer = firstRole?.customer;

    res.status(201).json({
      success: true,
      data: {
        id: createdContractPlot?.id,
        contractAreaSqm: createdContractPlot?.contract_area_sqm.toNumber(),
        locationDescription: createdContractPlot?.location_description,

        // 販売契約情報（ContractPlotに統合済み）
        contractDate: createdContractPlot?.contract_date,
        price: createdContractPlot?.price,
        paymentStatus: createdContractPlot?.payment_status,
        reservationDate: createdContractPlot?.reservation_date,
        acceptanceNumber: createdContractPlot?.acceptance_number,
        permitDate: createdContractPlot?.permit_date,
        startDate: createdContractPlot?.start_date,
        uncollectedAmount: createdContractPlot?.uncollected_amount,
        notes: createdContractPlot?.notes,

        physicalPlot: {
          id: createdContractPlot?.physicalPlot.id,
          plotNumber: createdContractPlot?.physicalPlot.plot_number,
          areaName: createdContractPlot?.physicalPlot.area_name,
          areaSqm: createdContractPlot?.physicalPlot.area_sqm.toNumber(),
          status: createdContractPlot?.physicalPlot.status,
        },

        // 後方互換性: 最初の顧客の情報
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

        // 全ての役割と顧客情報
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

        createdAt: createdContractPlot?.created_at,
        updatedAt: createdContractPlot?.updated_at,
      },
    });
  } catch (error) {
    next(error);
  }
};
