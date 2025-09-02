import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getConstructions = async (req: Request, res: Response) => {
  try {
    const { contract_id } = req.params;

    const constructions = await prisma.construction.findMany({
      where: {
        contractId: parseInt(contract_id),
      },
      select: {
        id: true,
        contractorName: true,
        startDate: true,
        scheduledEndDate: true,
        endDate: true,
        constructionDetails: true,
        constructionAmount: true,
        paymentAmount: true,
        constructionType: true,
        notes: true,
      },
      orderBy: {
        startDate: 'desc',
      },
    });

    const formattedConstructions = constructions.map(construction => ({
      id: construction.id,
      contractor_name: construction.contractorName,
      start_date: construction.startDate,
      scheduled_end_date: construction.scheduledEndDate,
      end_date: construction.endDate,
      construction_details: construction.constructionDetails,
      construction_amount: construction.constructionAmount,
      payment_amount: construction.paymentAmount,
      construction_type: construction.constructionType,
      notes: construction.notes,
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
    const data = req.body;

    const construction = await prisma.construction.create({
      data: {
        contractId: parseInt(contract_id),
        contractorName: data.contractor_name,
        startDate: data.start_date ? new Date(data.start_date) : null,
        scheduledEndDate: data.scheduled_end_date ? new Date(data.scheduled_end_date) : null,
        endDate: data.end_date ? new Date(data.end_date) : null,
        constructionDetails: data.construction_details,
        constructionAmount: data.construction_amount,
        paymentAmount: data.payment_amount,
        constructionType: data.construction_type,
        notes: data.notes,
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

    const construction = await prisma.construction.update({
      where: {
        id: parseInt(construction_id),
      },
      data: {
        contractorName: data.contractor_name,
        startDate: data.start_date ? new Date(data.start_date) : null,
        scheduledEndDate: data.scheduled_end_date ? new Date(data.scheduled_end_date) : null,
        endDate: data.end_date ? new Date(data.end_date) : null,
        constructionDetails: data.construction_details,
        constructionAmount: data.construction_amount,
        paymentAmount: data.payment_amount,
        constructionType: data.construction_type,
        notes: data.notes,
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