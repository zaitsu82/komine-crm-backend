import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 請求情報登録
export const createBillingInfo = async (req: Request, res: Response) => {
  try {
    const {
      gravestone_id,
      contractor_id,
      billing_type,
      bank_name,
      branch_name,
      account_type,
      account_number,
      account_holder,
      remarks,
      effective_start_date,
      effective_end_date,
    } = req.body;

    // 必須フィールドの検証
    if (!gravestone_id || !contractor_id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '必須項目が不足しています',
          details: [
            { message: '墓石IDと契約者IDは必須です' },
          ],
        },
      });
    }

    // 墓石の存在確認
    const gravestone = await prisma.gravestone.findFirst({
      where: {
        id: gravestone_id,
        deleted_at: null,
      },
    });

    if (!gravestone) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '指定された墓石が見つかりません',
          details: [],
        },
      });
    }

    // 契約者の存在確認
    const contractor = await prisma.contractor.findFirst({
      where: {
        id: contractor_id,
        deleted_at: null,
      },
    });

    if (!contractor) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '指定された契約者が見つかりません',
          details: [],
        },
      });
    }

    // 請求情報登録
    const billingInfo = await prisma.billingInfo.create({
      data: {
        gravestone_id,
        contractor_id,
        billing_type,
        bank_name,
        branch_name,
        account_type,
        account_number,
        account_holder,
        remarks,
        effective_start_date: effective_start_date ? new Date(effective_start_date) : null,
        effective_end_date: effective_end_date ? new Date(effective_end_date) : null,
      },
      include: {
        Gravestone: true,
        Contractor: true,
      },
    });

    res.status(201).json({
      success: true,
      data: billingInfo,
    });
  } catch (error) {
    console.error('請求情報登録エラー:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'サーバー内部エラー',
        details: [],
      },
    });
  }
};

// 請求情報更新
export const updateBillingInfo = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      billing_type,
      bank_name,
      branch_name,
      account_type,
      account_number,
      account_holder,
      remarks,
      effective_start_date,
      effective_end_date,
    } = req.body;

    // 請求情報の存在確認
    const existingBillingInfo = await prisma.billingInfo.findFirst({
      where: {
        id: parseInt(id),
        deleted_at: null,
      },
    });

    if (!existingBillingInfo) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '請求情報が見つかりません',
          details: [],
        },
      });
    }

    // 請求情報更新
    const updatedBillingInfo = await prisma.billingInfo.update({
      where: { id: parseInt(id) },
      data: {
        billing_type,
        bank_name,
        branch_name,
        account_type,
        account_number,
        account_holder,
        remarks,
        effective_start_date: effective_start_date ? new Date(effective_start_date) : undefined,
        effective_end_date: effective_end_date ? new Date(effective_end_date) : undefined,
      },
      include: {
        Gravestone: true,
        Contractor: true,
      },
    });

    res.json({
      success: true,
      data: updatedBillingInfo,
    });
  } catch (error) {
    console.error('請求情報更新エラー:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'サーバー内部エラー',
        details: [],
      },
    });
  }
};

// 請求情報削除（論理削除）
export const deleteBillingInfo = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // 請求情報の存在確認
    const existingBillingInfo = await prisma.billingInfo.findFirst({
      where: {
        id: parseInt(id),
        deleted_at: null,
      },
    });

    if (!existingBillingInfo) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '請求情報が見つかりません',
          details: [],
        },
      });
    }

    // 論理削除の実行
    await prisma.billingInfo.update({
      where: { id: parseInt(id) },
      data: {
        deleted_at: new Date(),
      },
    });

    res.json({
      success: true,
      data: { message: '請求情報を削除しました' },
    });
  } catch (error) {
    console.error('請求情報削除エラー:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'サーバー内部エラー',
        details: [],
      },
    });
  }
};

// 請求データ生成（業務固有API）
export const generateBillingData = async (req: Request, res: Response) => {
  try {
    const {
      billing_month,
      billing_year,
      billing_types,
      gravestone_ids,
    } = req.body;

    // 必須フィールドの検証
    if (!billing_month || !billing_year) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '必須項目が不足しています',
          details: [
            { message: '請求月と請求年は必須です' },
          ],
        },
      });
    }

    // 検索条件の構築
    const whereConditions: any = {
      deleted_at: null,
      Gravestone: {
        deleted_at: null,
      },
      Contractor: {
        deleted_at: null,
      },
    };

    if (billing_types && billing_types.length > 0) {
      whereConditions.billing_type = {
        in: billing_types,
      };
    }

    if (gravestone_ids && gravestone_ids.length > 0) {
      whereConditions.gravestone_id = {
        in: gravestone_ids,
      };
    }

    // 該当する請求情報を取得
    const billingInfos = await prisma.billingInfo.findMany({
      where: whereConditions,
      include: {
        Gravestone: {
          include: {
            UsageFees: {
              where: { deleted_at: null },
            },
            ManagementFees: {
              where: { deleted_at: null },
            },
          },
        },
        Contractor: true,
      },
    });

    // 請求データの生成
    const generatedBillingData = billingInfos.map((billingInfo) => {
      const usageFeeTotal = billingInfo.Gravestone.UsageFees.reduce(
        (sum, fee) => sum + parseFloat(fee.fee.toString()), 0
      );
      const managementFeeTotal = billingInfo.Gravestone.ManagementFees.reduce(
        (sum, fee) => sum + parseFloat(fee.fee.toString()), 0
      );
      const totalAmount = usageFeeTotal + managementFeeTotal;

      return {
        billing_info_id: billingInfo.id,
        gravestone_code: billingInfo.Gravestone.gravestone_code,
        contractor_name: billingInfo.Contractor.name,
        contractor_address: billingInfo.Contractor.address,
        billing_month: parseInt(billing_month),
        billing_year: parseInt(billing_year),
        usage_fee_total: usageFeeTotal,
        management_fee_total: managementFeeTotal,
        total_amount: totalAmount,
        bank_info: {
          bank_name: billingInfo.bank_name,
          branch_name: billingInfo.branch_name,
          account_type: billingInfo.account_type,
          account_number: billingInfo.account_number,
          account_holder: billingInfo.account_holder,
        },
        billing_type: billingInfo.billing_type,
        generated_at: new Date(),
      };
    });

    res.json({
      success: true,
      data: {
        billing_data: generatedBillingData,
        summary: {
          total_records: generatedBillingData.length,
          total_amount: generatedBillingData.reduce((sum, data) => sum + data.total_amount, 0),
          billing_period: `${billing_year}年${billing_month}月`,
        },
      },
    });
  } catch (error) {
    console.error('請求データ生成エラー:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'サーバー内部エラー',
        details: [],
      },
    });
  }
};