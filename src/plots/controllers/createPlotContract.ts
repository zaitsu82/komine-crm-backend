/**
 * 物理区画への契約追加エンドポイント
 * POST /api/v1/plots/:id/contracts
 *
 * 既存の物理区画に新規契約を追加します（分割販売対応）。
 */

import { Request, Response } from 'express';
import { PrismaClient, Prisma, PaymentStatus } from '@prisma/client';
import { validateContractArea, updatePhysicalPlotStatus } from '../../utils/inventoryUtils';

const prisma = new PrismaClient();

/**
 * 物理区画に新規契約追加
 * POST /plots/:id/contracts
 */
export const createPlotContract = async (req: Request, res: Response): Promise<any> => {
  try {
    const physicalPlotId = req.params['id'] as string;
    const input = req.body;

    // PhysicalPlotの存在確認
    const physicalPlot = await prisma.physicalPlot.findUnique({
      where: { id: physicalPlotId, deleted_at: null },
    });

    if (!physicalPlot) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '指定された物理区画が見つかりません',
        },
      });
    }

    // 契約面積の検証
    const validationResult = await validateContractArea(
      prisma as any,
      physicalPlotId,
      input.contractPlot.contractAreaSqm
    );

    if (!validationResult.isValid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: validationResult.message || '契約面積の検証に失敗しました',
        },
      });
    }

    // トランザクション内で契約作成
    const result = await prisma.$transaction(async (tx) => {
      // Customer作成
      const customer = await tx.customer.create({
        data: {
          name: input.customer.name,
          name_kana: input.customer.nameKana,
          birth_date: input.customer.birthDate ? new Date(input.customer.birthDate) : null,
          gender: input.customer.gender || null,
          postal_code: input.customer.postalCode,
          address: input.customer.address,
          registered_address: input.customer.registeredAddress || null,
          phone_number: input.customer.phoneNumber,
          fax_number: input.customer.faxNumber || null,
          email: input.customer.email || null,
          notes: input.customer.notes || null,
        },
      });

      // WorkInfo作成（オプション）
      if (input.workInfo) {
        await tx.workInfo.create({
          data: {
            customer_id: customer.id,
            company_name: input.workInfo.companyName || '',
            company_name_kana: input.workInfo.companyNameKana || '',
            work_postal_code: input.workInfo.workPostalCode || '',
            work_address: input.workInfo.workAddress || '',
            work_phone_number: input.workInfo.workPhoneNumber || '',
            dm_setting: input.workInfo.dmSetting || 'allow',
            address_type: input.workInfo.addressType || 'work',
            notes: input.workInfo.notes || null,
          },
        });
      }

      // BillingInfo作成（オプション）
      if (input.billingInfo) {
        await tx.billingInfo.create({
          data: {
            customer_id: customer.id,
            billing_type: input.billingInfo.billingType || 'individual',
            bank_name: input.billingInfo.bankName || '',
            branch_name: input.billingInfo.branchName || '',
            account_type: input.billingInfo.accountType || 'ordinary',
            account_number: input.billingInfo.accountNumber || '',
            account_holder: input.billingInfo.accountHolder || '',
          },
        });
      }

      // ContractPlot作成（販売契約情報を統合）
      const contractPlot = await tx.contractPlot.create({
        data: {
          physical_plot_id: physicalPlotId,
          contract_area_sqm: new Prisma.Decimal(input.contractPlot.contractAreaSqm),
          location_description: input.contractPlot.locationDescription || null,
          // 販売契約情報（ContractPlotに統合済み）
          contract_date: new Date(input.saleContract.contractDate),
          price: new Prisma.Decimal(input.saleContract.price),
          payment_status: input.saleContract.paymentStatus || PaymentStatus.unpaid,
          reservation_date: input.saleContract.reservationDate
            ? new Date(input.saleContract.reservationDate)
            : null,
          acceptance_number: input.saleContract.acceptanceNumber || null,
          permit_date: input.saleContract.permitDate
            ? new Date(input.saleContract.permitDate)
            : null,
          start_date: input.saleContract.startDate ? new Date(input.saleContract.startDate) : null,
          notes: input.saleContract.notes || null,
        },
      });

      // 契約における顧客役割の作成
      // 新方式: roles配列が指定されている場合
      if (input.saleContract.roles && input.saleContract.roles.length > 0) {
        for (const roleData of input.saleContract.roles) {
          await tx.saleContractRole.create({
            data: {
              contract_plot_id: contractPlot.id, // sale_contract_id → contract_plot_idに変更
              customer_id: roleData.customerId || customer.id, // 指定がなければ作成した顧客を使用
              role: roleData.role,
              is_primary: roleData.isPrimary ?? false,
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
            role: input.saleContract.customerRole || 'contractor',
            is_primary: true, // デフォルトで主役割とする
          },
        });
      }

      // UsageFee作成（オプション）
      if (input.usageFee) {
        await tx.usageFee.create({
          data: {
            contract_plot_id: contractPlot.id,
            calculation_type: input.usageFee.calculationType || null,
            tax_type: input.usageFee.taxType || null,
            billing_type: input.usageFee.billingType || 'onetime',
            billing_years: input.usageFee.billingYears || '1',
            area: input.usageFee.area ? input.usageFee.area.toString() : null,
            unit_price: input.usageFee.unitPrice ? input.usageFee.unitPrice.toString() : null,
            usage_fee: input.usageFee.usageFee ? input.usageFee.usageFee.toString() : null,
            payment_method: input.usageFee.paymentMethod || null,
          },
        });
      }

      // ManagementFee作成（オプション）
      if (input.managementFee) {
        await tx.managementFee.create({
          data: {
            contract_plot_id: contractPlot.id,
            calculation_type: input.managementFee.calculationType || null,
            tax_type: input.managementFee.taxType || null,
            billing_type: input.managementFee.billingType || 'yearly',
            billing_years: input.managementFee.billingYears || '1',
            area: input.managementFee.area ? input.managementFee.area.toString() : null,
            billing_month: input.managementFee.billingMonth || null,
            management_fee: input.managementFee.managementFee
              ? input.managementFee.managementFee.toString()
              : null,
            unit_price: input.managementFee.unitPrice
              ? input.managementFee.unitPrice.toString()
              : null,
            last_billing_month: input.managementFee.lastBillingMonth || null,
            payment_method: input.managementFee.paymentMethod || null,
          },
        });
      }

      // PhysicalPlotのステータス更新
      await updatePhysicalPlotStatus(tx as any, physicalPlotId);

      return { contractPlot, customer };
    });

    // 作成完了後、詳細情報を取得して返却
    const createdContractPlot = await prisma.contractPlot.findUnique({
      where: { id: result.contractPlot.id },
      include: {
        PhysicalPlot: true,
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

    // 主契約者（is_primary=true）を取得（後方互換性のため）
    const primaryRole = createdContractPlot?.SaleContractRoles?.find((role) => role.is_primary);
    const primaryCustomer = primaryRole?.Customer;

    res.status(201).json({
      success: true,
      data: {
        id: createdContractPlot?.id,
        contractAreaSqm: createdContractPlot?.contract_area_sqm.toNumber(),
        locationDescription: createdContractPlot?.location_description,

        // 販売契約情報（ContractPlotに統合済み）
        contractDate: createdContractPlot?.contract_date,
        price: createdContractPlot?.price.toNumber(),
        paymentStatus: createdContractPlot?.payment_status,
        reservationDate: createdContractPlot?.reservation_date,
        acceptanceNumber: createdContractPlot?.acceptance_number,
        permitDate: createdContractPlot?.permit_date,
        startDate: createdContractPlot?.start_date,
        notes: createdContractPlot?.notes,

        physicalPlot: {
          id: createdContractPlot?.PhysicalPlot.id,
          plotNumber: createdContractPlot?.PhysicalPlot.plot_number,
          areaName: createdContractPlot?.PhysicalPlot.area_name,
          areaSqm: createdContractPlot?.PhysicalPlot.area_sqm.toNumber(),
          status: createdContractPlot?.PhysicalPlot.status,
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
        roles: createdContractPlot?.SaleContractRoles?.map((role) => ({
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
            phoneNumber: role.Customer.phone_number,
            address: role.Customer.address,
          },
        })),

        createdAt: createdContractPlot?.created_at,
        updatedAt: createdContractPlot?.updated_at,
      },
    });
  } catch (error) {
    console.error('Error creating plot contract:', error);

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
        message: '契約の作成に失敗しました',
      },
    });
  }
};
