import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 埋葬者検索
export const searchBurials = async (req: Request, res: Response) => {
  try {
    const {
      name,
      kana,
      posthumous_name,
      death_date_from,
      death_date_to,
      burial_date_from,
      burial_date_to,
      gravestone_code,
      page = 1,
      limit = 20,
    } = req.query;

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    // 検索条件の構築
    const whereConditions: any = {
      deleted_at: null,
    };

    if (name) {
      whereConditions.name = {
        contains: name as string,
      };
    }

    if (kana) {
      whereConditions.kana = {
        contains: kana as string,
      };
    }

    if (posthumous_name) {
      whereConditions.posthumous_name = {
        contains: posthumous_name as string,
      };
    }

    if (death_date_from || death_date_to) {
      whereConditions.death_date = {};
      if (death_date_from) {
        whereConditions.death_date.gte = new Date(death_date_from as string);
      }
      if (death_date_to) {
        whereConditions.death_date.lte = new Date(death_date_to as string);
      }
    }

    if (burial_date_from || burial_date_to) {
      whereConditions.burial_date = {};
      if (burial_date_from) {
        whereConditions.burial_date.gte = new Date(burial_date_from as string);
      }
      if (burial_date_to) {
        whereConditions.burial_date.lte = new Date(burial_date_to as string);
      }
    }

    // 墓石コードでの検索
    if (gravestone_code) {
      whereConditions.Gravestone = {
        gravestone_code: {
          contains: gravestone_code as string,
        },
        deleted_at: null,
      };
    }

    // 検索実行
    const [burials, totalCount] = await Promise.all([
      prisma.burial.findMany({
        where: whereConditions,
        include: {
          Gravestone: true,
          Contractor: true,
        },
        skip: offset,
        take: parseInt(limit as string),
        orderBy: {
          id: 'desc',
        },
      }),
      prisma.burial.count({
        where: whereConditions,
      }),
    ]);

    res.json({
      success: true,
      data: {
        burials,
        pagination: {
          current_page: parseInt(page as string),
          per_page: parseInt(limit as string),
          total_count: totalCount,
          total_pages: Math.ceil(totalCount / parseInt(limit as string)),
        },
      },
    });
  } catch (error) {
    console.error('埋葬者検索エラー:', error);
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

// 埋葬者情報登録
export const createBurial = async (req: Request, res: Response) => {
  try {
    const {
      gravestone_id,
      contractor_id,
      name,
      kana,
      birth_date,
      gender,
      posthumous_name,
      death_date,
      age_at_death,
      burial_date,
      notification_date,
      denomination,
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

    // 墓石と契約者の存在確認
    const [gravestone, contractor] = await Promise.all([
      prisma.gravestone.findFirst({
        where: { id: gravestone_id, deleted_at: null },
      }),
      prisma.contractor.findFirst({
        where: { id: contractor_id, deleted_at: null },
      }),
    ]);

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

    // 埋葬者登録
    const burial = await prisma.burial.create({
      data: {
        gravestone_id,
        contractor_id,
        name,
        kana,
        birth_date: birth_date ? new Date(birth_date) : null,
        gender,
        posthumous_name,
        death_date: death_date ? new Date(death_date) : null,
        age_at_death,
        burial_date: burial_date ? new Date(burial_date) : null,
        notification_date: notification_date ? new Date(notification_date) : null,
        denomination,
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
      data: burial,
    });
  } catch (error) {
    console.error('埋葬者登録エラー:', error);
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

// 埋葬者情報更新
export const updateBurial = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      kana,
      birth_date,
      gender,
      posthumous_name,
      death_date,
      age_at_death,
      burial_date,
      notification_date,
      denomination,
      remarks,
      effective_start_date,
      effective_end_date,
    } = req.body;

    // 埋葬者の存在確認
    const existingBurial = await prisma.burial.findFirst({
      where: {
        id: parseInt(id),
        deleted_at: null,
      },
    });

    if (!existingBurial) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '埋葬者が見つかりません',
          details: [],
        },
      });
    }

    // 埋葬者情報更新
    const updatedBurial = await prisma.burial.update({
      where: { id: parseInt(id) },
      data: {
        name,
        kana,
        birth_date: birth_date ? new Date(birth_date) : undefined,
        gender,
        posthumous_name,
        death_date: death_date ? new Date(death_date) : undefined,
        age_at_death,
        burial_date: burial_date ? new Date(burial_date) : undefined,
        notification_date: notification_date ? new Date(notification_date) : undefined,
        denomination,
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
      data: updatedBurial,
    });
  } catch (error) {
    console.error('埋葬者更新エラー:', error);
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

// 埋葬者情報削除（論理削除）
export const deleteBurial = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // 埋葬者の存在確認
    const existingBurial = await prisma.burial.findFirst({
      where: {
        id: parseInt(id),
        deleted_at: null,
      },
    });

    if (!existingBurial) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '埋葬者が見つかりません',
          details: [],
        },
      });
    }

    // 論理削除の実行
    await prisma.burial.update({
      where: { id: parseInt(id) },
      data: {
        deleted_at: new Date(),
      },
    });

    res.json({
      success: true,
      data: { message: '埋葬者を削除しました' },
    });
  } catch (error) {
    console.error('埋葬者削除エラー:', error);
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

// 後方互換性のため残しておく
export const getBurials = async (req: Request, res: Response) => {
  try {
    res.status(501).json({
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'この機能は実装されていません。埋葬者検索APIをご利用ください。',
        details: [],
      },
    });
  } catch (error) {
    console.error('埋葬者取得エラー:', error);
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