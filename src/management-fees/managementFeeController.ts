import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 管理料情報登録
export const createManagementFee = async (req: Request, res: Response) => {
  try {
    const {
      gravestone_id,
      calc_type,
      billing_type,
      area,
      fee,
      last_billing_date,
      tax_type,
      billing_years,
      billing_month,
      unit_price,
      payment_method,
      remarks,
      effective_start_date,
      effective_end_date,
    } = req.body;

    // 必須フィールドの検証
    if (!gravestone_id || !fee || !payment_method) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '必須項目が不足しています',
          details: [
            { message: '墓石ID、料金、支払い方法は必須です' },
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

    // 管理料登録
    const managementFee = await prisma.managementFee.create({
      data: {
        gravestone_id,
        calc_type,
        billing_type,
        area: area ? parseFloat(area) : null,
        fee: parseFloat(fee),
        last_billing_date: last_billing_date ? new Date(last_billing_date) : null,
        tax_type,
        billing_years,
        billing_month,
        unit_price: unit_price ? parseFloat(unit_price) : null,
        payment_method,
        remarks,
        effective_start_date: effective_start_date ? new Date(effective_start_date) : null,
        effective_end_date: effective_end_date ? new Date(effective_end_date) : null,
      },
      include: {
        Gravestone: true,
      },
    });

    res.status(201).json({
      success: true,
      data: managementFee,
    });
  } catch (error) {
    console.error('管理料登録エラー:', error);
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

// 管理料情報更新
export const updateManagementFee = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      calc_type,
      billing_type,
      area,
      fee,
      last_billing_date,
      tax_type,
      billing_years,
      billing_month,
      unit_price,
      payment_method,
      remarks,
      effective_start_date,
      effective_end_date,
    } = req.body;

    // 管理料の存在確認
    const existingManagementFee = await prisma.managementFee.findFirst({
      where: {
        id: parseInt(id),
        deleted_at: null,
      },
    });

    if (!existingManagementFee) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '管理料が見つかりません',
          details: [],
        },
      });
    }

    // 管理料情報更新
    const updatedManagementFee = await prisma.managementFee.update({
      where: { id: parseInt(id) },
      data: {
        calc_type,
        billing_type,
        area: area ? parseFloat(area) : undefined,
        fee: fee ? parseFloat(fee) : undefined,
        last_billing_date: last_billing_date ? new Date(last_billing_date) : undefined,
        tax_type,
        billing_years,
        billing_month,
        unit_price: unit_price ? parseFloat(unit_price) : undefined,
        payment_method,
        remarks,
        effective_start_date: effective_start_date ? new Date(effective_start_date) : undefined,
        effective_end_date: effective_end_date ? new Date(effective_end_date) : undefined,
      },
      include: {
        Gravestone: true,
      },
    });

    res.json({
      success: true,
      data: updatedManagementFee,
    });
  } catch (error) {
    console.error('管理料更新エラー:', error);
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

// 管理料情報削除（論理削除）
export const deleteManagementFee = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // 管理料の存在確認
    const existingManagementFee = await prisma.managementFee.findFirst({
      where: {
        id: parseInt(id),
        deleted_at: null,
      },
    });

    if (!existingManagementFee) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '管理料が見つかりません',
          details: [],
        },
      });
    }

    // 論理削除の実行
    await prisma.managementFee.update({
      where: { id: parseInt(id) },
      data: {
        deleted_at: new Date(),
      },
    });

    res.json({
      success: true,
      data: { message: '管理料を削除しました' },
    });
  } catch (error) {
    console.error('管理料削除エラー:', error);
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

// 管理料計算（業務固有API）
export const calculateManagementFee = async (req: Request, res: Response) => {
  try {
    const {
      gravestone_id,
      calc_type,
      area,
      billing_years,
      unit_price,
      tax_rate,
    } = req.body;

    // 必須フィールドの検証
    if (!gravestone_id || !calc_type) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '必須項目が不足しています',
          details: [
            { message: '墓石IDと計算タイプは必須です' },
          ],
        },
      });
    }

    let calculatedFee = 0;
    let calculationDetails = '';

    // 計算タイプに応じた料金計算
    switch (calc_type) {
      case 'area_based':
        if (!area || !unit_price) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: '面積ベース計算には面積と単価が必要です',
              details: [],
            },
          });
        }
        calculatedFee = parseFloat(area) * parseFloat(unit_price);
        calculationDetails = `面積: ${area}㎡ × 単価: ¥${unit_price} = ¥${calculatedFee}`;
        break;

      case 'fixed_amount':
        if (!unit_price) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: '定額計算には金額が必要です',
              details: [],
            },
          });
        }
        calculatedFee = parseFloat(unit_price);
        calculationDetails = `定額: ¥${calculatedFee}`;
        break;

      case 'years_based':
        if (!billing_years || !unit_price) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: '年数ベース計算には請求年数と単価が必要です',
              details: [],
            },
          });
        }
        calculatedFee = parseInt(billing_years) * parseFloat(unit_price);
        calculationDetails = `請求年数: ${billing_years}年 × 単価: ¥${unit_price} = ¥${calculatedFee}`;
        break;

      default:
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '無効な計算タイプです',
            details: [],
          },
        });
    }

    // 税額計算
    let taxAmount = 0;
    let totalFee = calculatedFee;

    if (tax_rate) {
      taxAmount = calculatedFee * (parseFloat(tax_rate) / 100);
      totalFee = calculatedFee + taxAmount;
      calculationDetails += `\n税額: ¥${calculatedFee} × ${tax_rate}% = ¥${taxAmount}`;
      calculationDetails += `\n合計: ¥${totalFee}`;
    }

    res.json({
      success: true,
      data: {
        calculation_details: calculationDetails,
        base_fee: calculatedFee,
        tax_amount: taxAmount,
        total_fee: totalFee,
        calculation_type: calc_type,
        input_parameters: {
          gravestone_id,
          calc_type,
          area,
          billing_years,
          unit_price,
          tax_rate,
        },
      },
    });
  } catch (error) {
    console.error('管理料計算エラー:', error);
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