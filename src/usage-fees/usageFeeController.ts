import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 使用料情報登録
export const createUsageFee = async (req: Request, res: Response) => {
  try {
    const {
      gravestone_id,
      calc_type,
      area,
      fee,
      tax_type,
      billing_years,
      unit_price,
      payment_method,
      remarks,
      effective_start_date,
      effective_end_date,
    } = req.body;

    // 必須フィールドの検証
    if (!gravestone_id || !fee) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '必須項目が不足しています',
          details: [
            { message: '墓石IDと料金は必須です' },
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

    // 使用料登録
    const usageFee = await prisma.usageFee.create({
      data: {
        gravestone_id,
        calc_type,
        area: area ? parseFloat(area) : null,
        fee: parseFloat(fee),
        tax_type,
        billing_years,
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
      data: usageFee,
    });
  } catch (error) {
    console.error('使用料登録エラー:', error);
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

// 使用料情報更新
export const updateUsageFee = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      calc_type,
      area,
      fee,
      tax_type,
      billing_years,
      unit_price,
      payment_method,
      remarks,
      effective_start_date,
      effective_end_date,
    } = req.body;

    // 使用料の存在確認
    const existingUsageFee = await prisma.usageFee.findFirst({
      where: {
        id: parseInt(id),
        deleted_at: null,
      },
    });

    if (!existingUsageFee) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '使用料が見つかりません',
          details: [],
        },
      });
    }

    // 使用料情報更新
    const updatedUsageFee = await prisma.usageFee.update({
      where: { id: parseInt(id) },
      data: {
        calc_type,
        area: area ? parseFloat(area) : undefined,
        fee: fee ? parseFloat(fee) : undefined,
        tax_type,
        billing_years,
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
      data: updatedUsageFee,
    });
  } catch (error) {
    console.error('使用料更新エラー:', error);
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

// 使用料情報削除（論理削除）
export const deleteUsageFee = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // 使用料の存在確認
    const existingUsageFee = await prisma.usageFee.findFirst({
      where: {
        id: parseInt(id),
        deleted_at: null,
      },
    });

    if (!existingUsageFee) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '使用料が見つかりません',
          details: [],
        },
      });
    }

    // 論理削除の実行
    await prisma.usageFee.update({
      where: { id: parseInt(id) },
      data: {
        deleted_at: new Date(),
      },
    });

    res.json({
      success: true,
      data: { message: '使用料を削除しました' },
    });
  } catch (error) {
    console.error('使用料削除エラー:', error);
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