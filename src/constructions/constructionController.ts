import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getConstructions = async (req: Request, res: Response) => {
  try {
    const { contract_id } = req.params;
    const gravestone_id = parseInt(contract_id);

    // パラメータバリデーション
    if (isNaN(gravestone_id)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PARAMETER',
          message: '無効な契約IDです',
          details: [],
        },
      });
    }

    const constructions = await prisma.construction.findMany({
      where: {
        gravestone_id: gravestone_id,
      },
      select: {
        id: true,
        contractor_name: true,
        start_date: true,
        planned_end_date: true,
        end_date: true,
        description: true,
        cost: true,
        payment_amount: true,
        construction_type: true,
        remarks: true,
      },
      orderBy: {
        start_date: 'desc',
      },
    });

    const formattedConstructions = constructions.map(construction => ({
      id: construction.id,
      contractor_name: construction.contractor_name,
      start_date: construction.start_date,
      planned_end_date: construction.planned_end_date,
      end_date: construction.end_date,
      description: construction.description,
      cost: construction.cost,
      payment_amount: construction.payment_amount,
      construction_type: construction.construction_type,
      remarks: construction.remarks,
    }));

    return res.json({
      success: true,
      data: formattedConstructions,
    });
  } catch (error) {
    console.error('Error fetching constructions:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'サーバー内部エラーが発生しました',
        details: [],
      },
    });
  }
};

export const createConstruction = async (req: Request, res: Response) => {
  try {
    const { contract_id } = req.params;
    const gravestone_id = parseInt(contract_id);
    const data = req.body;

    // バリデーション
    if (!data.contractor_name || !data.construction_type) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'バリデーションエラーが発生しました',
          details: [
            ...(data.contractor_name ? [] : ['contractor_name は必須です']),
            ...(data.construction_type ? [] : ['construction_type は必須です'])
          ],
        },
      });
    }

    // パラメータバリデーション
    if (isNaN(gravestone_id)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PARAMETER',
          message: '無効な契約IDです',
          details: [],
        },
      });
    }

    const construction = await prisma.construction.create({
      data: {
        gravestone_id: gravestone_id,
        contractor_name: data.contractor_name,
        start_date: data.start_date ? new Date(data.start_date) : null,
        planned_end_date: data.planned_end_date ? new Date(data.planned_end_date) : null,
        end_date: data.end_date ? new Date(data.end_date) : null,
        description: data.description,
        cost: data.cost,
        payment_amount: data.payment_amount,
        construction_type: data.construction_type,
        remarks: data.remarks,
      },
    });

    return res.status(201).json({
      success: true,
      data: {
        id: construction.id,
        message: '工事情報が正常に作成されました',
      },
    });
  } catch (error) {
    console.error('Error creating construction:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'サーバー内部エラーが発生しました',
        details: [],
      },
    });
  }
};

export const updateConstruction = async (req: Request, res: Response) => {
  try {
    const { construction_id } = req.params;
    const data = req.body;

    // バリデーション
    if (!data.contractor_name || !data.construction_type) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'バリデーションエラーが発生しました',
          details: [
            ...(data.contractor_name ? [] : ['contractor_name は必須です']),
            ...(data.construction_type ? [] : ['construction_type は必須です'])
          ],
        },
      });
    }

    const construction = await prisma.construction.update({
      where: {
        id: parseInt(construction_id),
      },
      data: {
        contractor_name: data.contractor_name,
        start_date: data.start_date ? new Date(data.start_date) : null,
        planned_end_date: data.planned_end_date ? new Date(data.planned_end_date) : null,
        end_date: data.end_date ? new Date(data.end_date) : null,
        description: data.description,
        cost: data.cost,
        payment_amount: data.payment_amount,
        construction_type: data.construction_type,
        remarks: data.remarks,
      },
    });

    return res.json({
      success: true,
      data: {
        id: construction.id,
        message: '工事情報が正常に更新されました',
      },
    });
  } catch (error) {
    console.error('Error updating construction:', error);
    if (error instanceof Error && error.message.includes('Record to update not found')) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '指定された工事情報が見つかりません',
          details: [],
        },
      });
    }

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'サーバー内部エラーが発生しました',
        details: [],
      },
    });
  }
};

export const deleteConstruction = async (req: Request, res: Response) => {
  try {
    const { construction_id } = req.params;

    await prisma.construction.delete({
      where: {
        id: parseInt(construction_id),
      },
    });

    return res.json({
      success: true,
      data: {
        message: '工事情報が正常に削除されました',
      },
    });
  } catch (error) {
    console.error('Error deleting construction:', error);
    if (error instanceof Error && error.message.includes('Record to delete does not exist')) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '指定された工事情報が見つかりません',
          details: [],
        },
      });
    }

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'サーバー内部エラーが発生しました',
        details: [],
      },
    });
  }
};