import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getBurials = async (req: Request, res: Response) => {
  try {
    const { contract_id } = req.params;

    const burials = await prisma.burial.findMany({
      where: {
        contractId: parseInt(contract_id),
      },
      include: {
        religiousSect: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        burialDate: 'desc',
      },
    });

    const formattedBurials = burials.map(burial => ({
      id: burial.id,
      name: burial.name,
      name_kana: burial.nameKana,
      birth_date: burial.birthDate,
      gender: burial.gender,
      posthumous_name1: burial.posthumousName1,
      posthumous_name2: burial.posthumousName2,
      death_date: burial.deathDate,
      age_at_death: burial.ageAtDeath,
      burial_date: burial.burialDate,
      notification_date: burial.notificationDate,
      religious_sect: burial.religiousSect,
      memo: burial.memo,
    }));

    return res.json({
      success: true,
      data: formattedBurials,
    });
  } catch (error) {
    console.error('Error fetching burials:', error);
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

export const createBurial = async (req: Request, res: Response) => {
  try {
    const { contract_id } = req.params;
    const data = req.body;

    // 必須項目チェック
    if (!data.name || !data.name_kana || !data.gender || !data.death_date || !data.burial_date) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '必須項目が不足しています',
          details: [
            !data.name && { field: 'name', message: '氏名は必須です' },
            !data.name_kana && { field: 'name_kana', message: 'ふりがなは必須です' },
            !data.gender && { field: 'gender', message: '性別は必須です' },
            !data.death_date && { field: 'death_date', message: '命日は必須です' },
            !data.burial_date && { field: 'burial_date', message: '埋葬日は必須です' },
          ].filter(Boolean),
        },
      });
    }

    const burial = await prisma.burial.create({
      data: {
        contractId: parseInt(contract_id),
        name: data.name,
        nameKana: data.name_kana,
        birthDate: data.birth_date ? new Date(data.birth_date) : null,
        gender: data.gender,
        posthumousName1: data.posthumous_name1,
        posthumousName2: data.posthumous_name2,
        deathDate: new Date(data.death_date),
        ageAtDeath: data.age_at_death,
        burialDate: new Date(data.burial_date),
        notificationDate: data.notification_date ? new Date(data.notification_date) : null,
        religiousSectId: data.religious_sect_id,
        memo: data.memo,
      },
    });

    return res.status(201).json({
      success: true,
      data: {
        id: burial.id,
        message: '埋葬情報が正常に作成されました',
      },
    });
  } catch (error) {
    console.error('Error creating burial:', error);
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

export const updateBurial = async (req: Request, res: Response) => {
  try {
    const { burial_id } = req.params;
    const data = req.body;

    // 必須項目チェック
    if (!data.name || !data.name_kana || !data.gender || !data.death_date || !data.burial_date) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '必須項目が不足しています',
          details: [
            !data.name && { field: 'name', message: '氏名は必須です' },
            !data.name_kana && { field: 'name_kana', message: 'ふりがなは必須です' },
            !data.gender && { field: 'gender', message: '性別は必須です' },
            !data.death_date && { field: 'death_date', message: '命日は必須です' },
            !data.burial_date && { field: 'burial_date', message: '埋葬日は必須です' },
          ].filter(Boolean),
        },
      });
    }

    const burial = await prisma.burial.update({
      where: {
        id: parseInt(burial_id),
      },
      data: {
        name: data.name,
        nameKana: data.name_kana,
        birthDate: data.birth_date ? new Date(data.birth_date) : null,
        gender: data.gender,
        posthumousName1: data.posthumous_name1,
        posthumousName2: data.posthumous_name2,
        deathDate: new Date(data.death_date),
        ageAtDeath: data.age_at_death,
        burialDate: new Date(data.burial_date),
        notificationDate: data.notification_date ? new Date(data.notification_date) : null,
        religiousSectId: data.religious_sect_id,
        memo: data.memo,
      },
    });

    return res.json({
      success: true,
      data: {
        id: burial.id,
        message: '埋葬情報が正常に更新されました',
      },
    });
  } catch (error) {
    console.error('Error updating burial:', error);
    if (error instanceof Error && error.message.includes('Record to update not found')) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '指定された埋葬情報が見つかりません',
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

export const deleteBurial = async (req: Request, res: Response) => {
  try {
    const { burial_id } = req.params;

    await prisma.burial.delete({
      where: {
        id: parseInt(burial_id),
      },
    });

    return res.json({
      success: true,
      data: {
        message: '埋葬情報が正常に削除されました',
      },
    });
  } catch (error) {
    console.error('Error deleting burial:', error);
    if (error instanceof Error && error.message.includes('Record to delete does not exist')) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '指定された埋葬情報が見つかりません',
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