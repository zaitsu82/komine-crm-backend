import { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { CreateContractPlotInput, UpdateContractPlotInput } from '../type';
import { validateContractArea, updatePhysicalPlotStatus } from '../utils/inventoryUtils';

const prisma = new PrismaClient();

/**
 * 契約区画一覧取得（ContractPlot中心）
 * GET /api/v1/plots
 */
export const getPlots = async (_req: Request, res: Response) => {
  try {
    const contractPlots = await prisma.contractPlot.findMany({
      where: {
        deleted_at: null, // 論理削除されていない契約のみ
      },
      include: {
        PhysicalPlot: {
          select: {
            plot_number: true,
            area_name: true,
            area_sqm: true,
            status: true,
          },
        },
        SaleContract: {
          include: {
            Customer: {
              select: {
                name: true,
                name_kana: true,
                phone_number: true,
                address: true,
              },
            },
          },
        },
        ManagementFee: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    const plotList = contractPlots.map((contractPlot) => {
      // 次回請求日の計算（last_billing_monthから1ヶ月後を計算）
      let nextBillingDate: Date | null = null;
      if (contractPlot.ManagementFee?.last_billing_month) {
        const match = contractPlot.ManagementFee.last_billing_month.match(/(\d{4})年(\d{1,2})月/);
        if (match && match[1] && match[2]) {
          const year = parseInt(match[1]);
          const month = parseInt(match[2]);
          const nextDate = new Date(year, month, 1); // 次の月の1日
          nextBillingDate = nextDate;
        }
      }

      return {
        // 契約区画情報
        id: contractPlot.id,
        contractAreaSqm: contractPlot.contract_area_sqm.toNumber(),
        saleStatus: contractPlot.sale_status,
        locationDescription: contractPlot.location_description,

        // 物理区画情報（表示用）
        plotNumber: contractPlot.PhysicalPlot.plot_number,
        areaName: contractPlot.PhysicalPlot.area_name,
        physicalPlotAreaSqm: contractPlot.PhysicalPlot.area_sqm.toNumber(),
        physicalPlotStatus: contractPlot.PhysicalPlot.status,

        // 顧客情報（販売契約経由）
        customerName: contractPlot.SaleContract?.Customer.name || null,
        customerNameKana: contractPlot.SaleContract?.Customer.name_kana || null,
        customerPhoneNumber: contractPlot.SaleContract?.Customer.phone_number || null,
        customerAddress: contractPlot.SaleContract?.Customer.address || null,
        customerRole: contractPlot.SaleContract?.customer_role || null,

        // 契約情報
        contractDate: contractPlot.SaleContract?.contract_date || null,
        price: contractPlot.SaleContract?.price.toNumber() || null,
        paymentStatus: contractPlot.SaleContract?.payment_status || null,

        // 料金情報
        nextBillingDate,
        managementFee: contractPlot.ManagementFee?.management_fee || null,

        // メタ情報
        createdAt: contractPlot.created_at,
        updatedAt: contractPlot.updated_at,
      };
    });

    res.status(200).json({
      success: true,
      data: plotList,
    });
  } catch (error) {
    console.error('Error fetching contract plots:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '契約区画情報の取得に失敗しました',
      },
    });
  }
};

/**
 * 契約区画詳細取得（ContractPlot中心）
 * GET /api/v1/plots/:id?includeHistory=true&historyLimit=50
 */
export const getPlotById = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const includeHistory = req.query['includeHistory'] === 'true';
    const historyLimit = parseInt((req.query['historyLimit'] as string) || '50');

    const contractPlot = await prisma.contractPlot.findUnique({
      where: { id },
      include: {
        PhysicalPlot: {
          include: {
            BuriedPersons: {
              where: { deleted_at: null },
              orderBy: { created_at: 'desc' },
            },
            FamilyContacts: {
              where: { deleted_at: null },
              orderBy: { created_at: 'desc' },
            },
            EmergencyContact: true,
            GravestoneInfo: true,
            ConstructionInfo: true,
            CollectiveBurial: true,
          },
        },
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

    if (!contractPlot || contractPlot.deleted_at) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '契約区画が見つかりません',
        },
      });
    }

    // 履歴情報取得（オプション）
    let histories: any[] = [];
    if (includeHistory) {
      histories = await prisma.history.findMany({
        where: {
          entity_type: 'ContractPlot',
          entity_id: id,
        },
        orderBy: {
          created_at: 'desc',
        },
        take: historyLimit,
      });
    }

    const response: any = {
      // 契約区画基本情報
      id: contractPlot.id,
      contractAreaSqm: contractPlot.contract_area_sqm.toNumber(),
      saleStatus: contractPlot.sale_status,
      locationDescription: contractPlot.location_description,
      createdAt: contractPlot.created_at,
      updatedAt: contractPlot.updated_at,

      // 物理区画情報
      physicalPlot: {
        id: contractPlot.PhysicalPlot.id,
        plotNumber: contractPlot.PhysicalPlot.plot_number,
        areaName: contractPlot.PhysicalPlot.area_name,
        areaSqm: contractPlot.PhysicalPlot.area_sqm.toNumber(),
        status: contractPlot.PhysicalPlot.status,
        notes: contractPlot.PhysicalPlot.notes,
      },

      // 販売契約情報
      saleContract: contractPlot.SaleContract
        ? {
            id: contractPlot.SaleContract.id,
            contractDate: contractPlot.SaleContract.contract_date,
            price: contractPlot.SaleContract.price.toNumber(),
            paymentStatus: contractPlot.SaleContract.payment_status,
            customerRole: contractPlot.SaleContract.customer_role,
            reservationDate: contractPlot.SaleContract.reservation_date,
            acceptanceNumber: contractPlot.SaleContract.acceptance_number,
            permitDate: contractPlot.SaleContract.permit_date,
            startDate: contractPlot.SaleContract.start_date,
            notes: contractPlot.SaleContract.notes,

            // 顧客情報
            customer: {
              id: contractPlot.SaleContract.Customer.id,
              name: contractPlot.SaleContract.Customer.name,
              nameKana: contractPlot.SaleContract.Customer.name_kana,
              gender: contractPlot.SaleContract.Customer.gender,
              birthDate: contractPlot.SaleContract.Customer.birth_date,
              phoneNumber: contractPlot.SaleContract.Customer.phone_number,
              faxNumber: contractPlot.SaleContract.Customer.fax_number,
              email: contractPlot.SaleContract.Customer.email,
              postalCode: contractPlot.SaleContract.Customer.postal_code,
              address: contractPlot.SaleContract.Customer.address,
              registeredAddress: contractPlot.SaleContract.Customer.registered_address,
              notes: contractPlot.SaleContract.Customer.notes,

              // 勤務先情報
              workInfo: contractPlot.SaleContract.Customer.WorkInfo
                ? {
                    companyName: contractPlot.SaleContract.Customer.WorkInfo.company_name,
                    companyNameKana: contractPlot.SaleContract.Customer.WorkInfo.company_name_kana,
                    workAddress: contractPlot.SaleContract.Customer.WorkInfo.work_address,
                    workPostalCode: contractPlot.SaleContract.Customer.WorkInfo.work_postal_code,
                    workPhoneNumber: contractPlot.SaleContract.Customer.WorkInfo.work_phone_number,
                    dmSetting: contractPlot.SaleContract.Customer.WorkInfo.dm_setting,
                    addressType: contractPlot.SaleContract.Customer.WorkInfo.address_type,
                    notes: contractPlot.SaleContract.Customer.WorkInfo.notes,
                  }
                : null,

              // 請求先情報
              billingInfo: contractPlot.SaleContract.Customer.BillingInfo
                ? {
                    billingType: contractPlot.SaleContract.Customer.BillingInfo.billing_type,
                    bankName: contractPlot.SaleContract.Customer.BillingInfo.bank_name,
                    branchName: contractPlot.SaleContract.Customer.BillingInfo.branch_name,
                    accountType: contractPlot.SaleContract.Customer.BillingInfo.account_type,
                    accountNumber: contractPlot.SaleContract.Customer.BillingInfo.account_number,
                    accountHolder: contractPlot.SaleContract.Customer.BillingInfo.account_holder,
                  }
                : null,
            },
          }
        : null,

      // 使用料情報
      usageFee: contractPlot.UsageFee
        ? {
            calculationType: contractPlot.UsageFee.calculation_type,
            taxType: contractPlot.UsageFee.tax_type,
            usageFee: contractPlot.UsageFee.usage_fee,
            area: contractPlot.UsageFee.area,
            unitPrice: contractPlot.UsageFee.unit_price,
            paymentMethod: contractPlot.UsageFee.payment_method,
          }
        : null,

      // 管理料情報
      managementFee: contractPlot.ManagementFee
        ? {
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

      // 埋葬者情報
      buriedPersons: contractPlot.PhysicalPlot.BuriedPersons.map((person) => ({
        id: person.id,
        name: person.name,
        nameKana: person.name_kana,
        relationship: person.relationship,
        deathDate: person.death_date,
        age: person.age,
        gender: person.gender,
        burialDate: person.burial_date,
        memo: person.memo,
      })),

      // 家族連絡先情報
      familyContacts: contractPlot.PhysicalPlot.FamilyContacts.map((contact) => ({
        id: contact.id,
        name: contact.name,
        birthDate: contact.birth_date,
        relationship: contact.relationship,
        address: contact.address,
        phoneNumber: contact.phone_number,
        faxNumber: contact.fax_number,
        email: contact.email,
        registeredAddress: contact.registered_address,
        mailingType: contact.mailing_type,
        companyName: contact.company_name,
        companyNameKana: contact.company_name_kana,
        companyAddress: contact.company_address,
        companyPhone: contact.company_phone,
        notes: contact.notes,
      })),

      // 緊急連絡先
      emergencyContact: contractPlot.PhysicalPlot.EmergencyContact
        ? {
            id: contractPlot.PhysicalPlot.EmergencyContact.id,
            name: contractPlot.PhysicalPlot.EmergencyContact.name,
            relationship: contractPlot.PhysicalPlot.EmergencyContact.relationship,
            phoneNumber: contractPlot.PhysicalPlot.EmergencyContact.phone_number,
          }
        : null,

      // 墓石情報
      gravestoneInfo: contractPlot.PhysicalPlot.GravestoneInfo
        ? {
            gravestoneBase: contractPlot.PhysicalPlot.GravestoneInfo.gravestone_base,
            enclosurePosition: contractPlot.PhysicalPlot.GravestoneInfo.enclosure_position,
            gravestoneDealer: contractPlot.PhysicalPlot.GravestoneInfo.gravestone_dealer,
            gravestoneType: contractPlot.PhysicalPlot.GravestoneInfo.gravestone_type,
            surroundingArea: contractPlot.PhysicalPlot.GravestoneInfo.surrounding_area,
            establishmentDeadline: contractPlot.PhysicalPlot.GravestoneInfo.establishment_deadline,
            establishmentDate: contractPlot.PhysicalPlot.GravestoneInfo.establishment_date,
          }
        : null,

      // 工事情報
      constructionInfo: contractPlot.PhysicalPlot.ConstructionInfo
        ? {
            id: contractPlot.PhysicalPlot.ConstructionInfo.id,
            constructionType: contractPlot.PhysicalPlot.ConstructionInfo.construction_type,
            startDate: contractPlot.PhysicalPlot.ConstructionInfo.start_date,
            completionDate: contractPlot.PhysicalPlot.ConstructionInfo.completion_date,
            contractor: contractPlot.PhysicalPlot.ConstructionInfo.contractor,
            supervisor: contractPlot.PhysicalPlot.ConstructionInfo.supervisor,
            progress: contractPlot.PhysicalPlot.ConstructionInfo.progress,
            workItem1: contractPlot.PhysicalPlot.ConstructionInfo.work_item_1,
            workDate1: contractPlot.PhysicalPlot.ConstructionInfo.work_date_1,
            workAmount1: contractPlot.PhysicalPlot.ConstructionInfo.work_amount_1
              ? Number(contractPlot.PhysicalPlot.ConstructionInfo.work_amount_1)
              : null,
            workStatus1: contractPlot.PhysicalPlot.ConstructionInfo.work_status_1,
            workItem2: contractPlot.PhysicalPlot.ConstructionInfo.work_item_2,
            workDate2: contractPlot.PhysicalPlot.ConstructionInfo.work_date_2,
            workAmount2: contractPlot.PhysicalPlot.ConstructionInfo.work_amount_2
              ? Number(contractPlot.PhysicalPlot.ConstructionInfo.work_amount_2)
              : null,
            workStatus2: contractPlot.PhysicalPlot.ConstructionInfo.work_status_2,
            permitNumber: contractPlot.PhysicalPlot.ConstructionInfo.permit_number,
            applicationDate: contractPlot.PhysicalPlot.ConstructionInfo.application_date,
            permitDate: contractPlot.PhysicalPlot.ConstructionInfo.permit_date,
            permitStatus: contractPlot.PhysicalPlot.ConstructionInfo.permit_status,
            paymentType1: contractPlot.PhysicalPlot.ConstructionInfo.payment_type_1,
            paymentAmount1: contractPlot.PhysicalPlot.ConstructionInfo.payment_amount_1
              ? Number(contractPlot.PhysicalPlot.ConstructionInfo.payment_amount_1)
              : null,
            paymentDate1: contractPlot.PhysicalPlot.ConstructionInfo.payment_date_1,
            paymentStatus1: contractPlot.PhysicalPlot.ConstructionInfo.payment_status_1,
            paymentType2: contractPlot.PhysicalPlot.ConstructionInfo.payment_type_2,
            paymentAmount2: contractPlot.PhysicalPlot.ConstructionInfo.payment_amount_2
              ? Number(contractPlot.PhysicalPlot.ConstructionInfo.payment_amount_2)
              : null,
            paymentScheduledDate2:
              contractPlot.PhysicalPlot.ConstructionInfo.payment_scheduled_date_2,
            paymentStatus2: contractPlot.PhysicalPlot.ConstructionInfo.payment_status_2,
            constructionNotes: contractPlot.PhysicalPlot.ConstructionInfo.construction_notes,
          }
        : null,

      // 合祀情報
      collectiveBurial: contractPlot.PhysicalPlot.CollectiveBurial
        ? {
            id: contractPlot.PhysicalPlot.CollectiveBurial.id,
            burialCapacity: contractPlot.PhysicalPlot.CollectiveBurial.burial_capacity,
            currentBurialCount: contractPlot.PhysicalPlot.CollectiveBurial.current_burial_count,
            capacityReachedDate: contractPlot.PhysicalPlot.CollectiveBurial.capacity_reached_date,
            validityPeriodYears: contractPlot.PhysicalPlot.CollectiveBurial.validity_period_years,
            billingScheduledDate: contractPlot.PhysicalPlot.CollectiveBurial.billing_scheduled_date,
            billingStatus: contractPlot.PhysicalPlot.CollectiveBurial.billing_status,
            billingAmount: contractPlot.PhysicalPlot.CollectiveBurial.billing_amount
              ? Number(contractPlot.PhysicalPlot.CollectiveBurial.billing_amount)
              : null,
            notes: contractPlot.PhysicalPlot.CollectiveBurial.notes,
          }
        : null,

      // 履歴情報
      histories: includeHistory ? histories : undefined,
    };

    res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error fetching contract plot by id:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '契約区画詳細の取得に失敗しました',
      },
    });
  }
};

/**
 * 新規契約作成（ContractPlot + SaleContract + Customer）
 * POST /api/v1/plots
 */
export const createPlot = async (req: Request, res: Response): Promise<any> => {
  try {
    const input: CreateContractPlotInput = req.body;

    // 入力バリデーション
    if (!input.contractPlot || !input.saleContract || !input.customer) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'contractPlot, saleContract, customerは必須です',
        },
      });
    }

    // 契約面積のバリデーション
    if (!input.contractPlot.contractAreaSqm || input.contractPlot.contractAreaSqm <= 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '契約面積は0より大きい値を指定してください',
        },
      });
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
          throw new Error('指定された物理区画が見つかりません');
        }
      } else {
        // 新規物理区画を作成
        if (!input.physicalPlot.plotNumber || !input.physicalPlot.areaName) {
          throw new Error('新規物理区画作成時は plotNumber と areaName が必須です');
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
        throw new Error(validationResult.message || '契約面積の検証に失敗しました');
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

      // 6. 契約区画の作成
      const contractPlot = await tx.contractPlot.create({
        data: {
          physical_plot_id: physicalPlot.id,
          contract_area_sqm: new Prisma.Decimal(input.contractPlot.contractAreaSqm),
          sale_status: input.contractPlot.saleStatus || 'contracted',
          location_description: input.contractPlot.locationDescription || null,
        },
      });

      // 7. 販売契約の作成
      const saleContract = await tx.saleContract.create({
        data: {
          contract_plot_id: contractPlot.id,
          customer_id: customer.id,
          customer_role: input.saleContract.customerRole || 'contractor',
          contract_date: new Date(input.saleContract.contractDate),
          price: new Prisma.Decimal(input.saleContract.price),
          payment_status: input.saleContract.paymentStatus || 'unpaid',
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

      // 10. 物理区画のステータス更新
      await updatePhysicalPlotStatus(tx as any, physicalPlot.id);

      return {
        contractPlot,
        saleContract,
        customer,
        physicalPlot,
      };
    });

    // 作成完了後、詳細情報を取得して返却
    const createdContractPlot = await prisma.contractPlot.findUnique({
      where: { id: result.contractPlot.id },
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

    res.status(201).json({
      success: true,
      data: {
        id: createdContractPlot?.id,
        contractAreaSqm: createdContractPlot?.contract_area_sqm.toNumber(),
        saleStatus: createdContractPlot?.sale_status,
        locationDescription: createdContractPlot?.location_description,
        physicalPlot: {
          id: createdContractPlot?.PhysicalPlot.id,
          plotNumber: createdContractPlot?.PhysicalPlot.plot_number,
          areaName: createdContractPlot?.PhysicalPlot.area_name,
          areaSqm: createdContractPlot?.PhysicalPlot.area_sqm.toNumber(),
          status: createdContractPlot?.PhysicalPlot.status,
        },
        saleContract: {
          id: createdContractPlot?.SaleContract?.id,
          contractDate: createdContractPlot?.SaleContract?.contract_date,
          price: createdContractPlot?.SaleContract?.price.toNumber(),
          paymentStatus: createdContractPlot?.SaleContract?.payment_status,
          customerRole: createdContractPlot?.SaleContract?.customer_role,
          customer: {
            id: createdContractPlot?.SaleContract?.Customer.id,
            name: createdContractPlot?.SaleContract?.Customer.name,
            nameKana: createdContractPlot?.SaleContract?.Customer.name_kana,
            phoneNumber: createdContractPlot?.SaleContract?.Customer.phone_number,
            address: createdContractPlot?.SaleContract?.Customer.address,
          },
        },
        createdAt: createdContractPlot?.created_at,
        updatedAt: createdContractPlot?.updated_at,
      },
    });
  } catch (error) {
    console.error('Error creating contract plot:', error);

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
        message: '契約区画の作成に失敗しました',
      },
    });
  }
};

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
