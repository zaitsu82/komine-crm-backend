import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 墓石情報一覧取得
export const getGravestones = async (req: Request, res: Response) => {
  try {
    const {
      page = '1',
      limit = '20',
      usage_status,
      cemetery_type,
      denomination,
      gravestone_code,
      search,
      sort_by = 'created_at',
      sort_order = 'desc'
    } = req.query;

    const pageNumber = Math.max(1, parseInt(page as string));
    const limitNumber = Math.min(100, Math.max(1, parseInt(limit as string))); // 最大100件に制限
    const offset = (pageNumber - 1) * limitNumber;

    // 検索条件の構築
    const where: any = {
      deleted_at: null, // 論理削除されていないもの
    };

    if (usage_status) {
      where.usage_status = usage_status;
    }

    if (cemetery_type) {
      where.cemetery_type = cemetery_type;
    }

    if (denomination) {
      where.denomination = denomination;
    }

    if (gravestone_code) {
      where.gravestone_code = {
        contains: gravestone_code as string,
        mode: 'insensitive',
      };
    }

    // 全体検索（墓石コード、位置、碑文での検索）
    if (search) {
      where.OR = [
        {
          gravestone_code: {
            contains: search as string,
            mode: 'insensitive',
          },
        },
        {
          location: {
            contains: search as string,
            mode: 'insensitive',
          },
        },
        {
          inscription: {
            contains: search as string,
            mode: 'insensitive',
          },
        },
      ];
    }

    // ソート設定
    const orderBy: any = {};
    const validSortFields = [
      'gravestone_code',
      'usage_status',
      'price',
      'cemetery_type',
      'created_at',
      'updated_at'
    ];

    if (validSortFields.includes(sort_by as string)) {
      orderBy[sort_by as string] = sort_order === 'asc' ? 'asc' : 'desc';
    } else {
      orderBy.created_at = 'desc';
    }

    // データ取得とカウント
    const [gravestones, totalCount] = await Promise.all([
      prisma.gravestone.findMany({
        where,
        orderBy,
        skip: offset,
        take: limitNumber,
        select: {
          id: true,
          gravestone_code: true,
          usage_status: true,
          price: true,
          orientation: true,
          location: true,
          cemetery_type: true,
          denomination: true,
          inscription: true,
          construction_deadline: true,
          construction_date: true,
          created_at: true,
          updated_at: true,
          // 関連データの一部を含める（効率的な表示のため）
          Applicant: {
            select: {
              name: true,
              application_date: true,
            },
          },
          Contractors: {
            where: { deleted_at: null },
            select: {
              name: true,
              start_date: true,
            },
            take: 1,
            orderBy: { start_date: 'desc' },
          },
        },
      }),
      prisma.gravestone.count({ where }),
    ]);

    const totalPages = Math.ceil(totalCount / limitNumber);

    return res.json({
      success: true,
      data: {
        gravestones,
        pagination: {
          current_page: pageNumber,
          total_pages: totalPages,
          total_items: totalCount,
          items_per_page: limitNumber,
          has_next: pageNumber < totalPages,
          has_prev: pageNumber > 1,
        },
      },
    });
  } catch (error) {
    console.error('Get gravestones error:', error);
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

// 墓石情報詳細取得
export const getGravestoneById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const gravestoneId = parseInt(id);

    if (isNaN(gravestoneId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '無効なIDです',
          details: [
            { field: 'id', message: 'IDは数値である必要があります' },
          ],
        },
      });
    }

    const gravestone = await prisma.gravestone.findFirst({
      where: {
        id: gravestoneId,
        deleted_at: null,
      },
      include: {
        Applicant: {
          where: { deleted_at: null },
        },
        Contractors: {
          where: { deleted_at: null },
          orderBy: { start_date: 'desc' },
        },
        UsageFees: {
          where: { deleted_at: null },
          orderBy: { effective_start_date: 'desc' },
        },
        ManagementFees: {
          where: { deleted_at: null },
          orderBy: { effective_start_date: 'desc' },
        },
        BillingInfos: {
          where: { deleted_at: null },
          include: {
            Contractor: {
              select: {
                name: true,
              },
            },
          },
        },
        FamilyContacts: {
          where: { deleted_at: null },
          include: {
            Contractor: {
              select: {
                name: true,
              },
            },
          },
        },
        Burials: {
          where: { deleted_at: null },
          include: {
            Contractor: {
              select: {
                name: true,
              },
            },
          },
          orderBy: { burial_date: 'desc' },
        },
        Constructions: {
          where: { deleted_at: null },
          orderBy: { start_date: 'desc' },
        },
      },
    });

    if (!gravestone) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '墓石情報が見つかりません',
          details: [],
        },
      });
    }

    return res.json({
      success: true,
      data: {
        gravestone,
      },
    });
  } catch (error) {
    console.error('Get gravestone by ID error:', error);
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

// 墓石情報検索
export const searchGravestones = async (req: Request, res: Response) => {
  try {
    const {
      q, // 検索クエリ
      usage_status,
      cemetery_type,
      denomination,
      price_min,
      price_max,
      construction_date_from,
      construction_date_to,
      location,
      page = '1',
      limit = '20',
    } = req.query;

    const pageNumber = Math.max(1, parseInt(page as string));
    const limitNumber = Math.min(100, Math.max(1, parseInt(limit as string)));
    const offset = (pageNumber - 1) * limitNumber;

    // 検索条件の構築
    const where: any = {
      deleted_at: null,
    };

    // メインの検索クエリ
    if (q) {
      where.OR = [
        {
          gravestone_code: {
            contains: q as string,
            mode: 'insensitive',
          },
        },
        {
          location: {
            contains: q as string,
            mode: 'insensitive',
          },
        },
        {
          inscription: {
            contains: q as string,
            mode: 'insensitive',
          },
        },
        {
          epitaph: {
            contains: q as string,
            mode: 'insensitive',
          },
        },
        // 契約者名での検索も含める
        {
          Contractors: {
            some: {
              AND: [
                { deleted_at: null },
                {
                  OR: [
                    {
                      name: {
                        contains: q as string,
                        mode: 'insensitive',
                      },
                    },
                    {
                      kana: {
                        contains: q as string,
                        mode: 'insensitive',
                      },
                    },
                  ],
                },
              ],
            },
          },
        },
      ];
    }

    // フィルター条件
    if (usage_status) where.usage_status = usage_status;
    if (cemetery_type) where.cemetery_type = cemetery_type;
    if (denomination) where.denomination = denomination;
    if (location) {
      where.location = {
        contains: location as string,
        mode: 'insensitive',
      };
    }

    // 価格範囲
    if (price_min || price_max) {
      where.price = {};
      if (price_min) where.price.gte = parseFloat(price_min as string);
      if (price_max) where.price.lte = parseFloat(price_max as string);
    }

    // 建立日範囲
    if (construction_date_from || construction_date_to) {
      where.construction_date = {};
      if (construction_date_from) where.construction_date.gte = new Date(construction_date_from as string);
      if (construction_date_to) where.construction_date.lte = new Date(construction_date_to as string);
    }

    const [gravestones, totalCount] = await Promise.all([
      prisma.gravestone.findMany({
        where,
        include: {
          Applicant: {
            select: {
              name: true,
              application_date: true,
            },
            where: { deleted_at: null },
          },
          Contractors: {
            select: {
              name: true,
              kana: true,
              start_date: true,
            },
            where: { deleted_at: null },
            take: 1,
            orderBy: { start_date: 'desc' },
          },
        },
        orderBy: { updated_at: 'desc' },
        skip: offset,
        take: limitNumber,
      }),
      prisma.gravestone.count({ where }),
    ]);

    const totalPages = Math.ceil(totalCount / limitNumber);

    return res.json({
      success: true,
      data: {
        gravestones,
        pagination: {
          current_page: pageNumber,
          total_pages: totalPages,
          total_items: totalCount,
          items_per_page: limitNumber,
          has_next: pageNumber < totalPages,
          has_prev: pageNumber > 1,
        },
        search_params: {
          q,
          usage_status,
          cemetery_type,
          denomination,
          price_min,
          price_max,
          construction_date_from,
          construction_date_to,
          location,
        },
      },
    });
  } catch (error) {
    console.error('Search gravestones error:', error);
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

// 墓石情報登録
export const createGravestone = async (req: Request, res: Response) => {
  try {
    const {
      gravestone_code,
      usage_status,
      price,
      orientation,
      location,
      cemetery_type,
      denomination,
      inscription,
      construction_deadline,
      construction_date,
      epitaph,
      remarks,
    } = req.body;

    // 必須項目の検証
    const errors = [];
    if (!gravestone_code) errors.push({ field: 'gravestone_code', message: '墓石コードは必須です' });
    if (!usage_status) errors.push({ field: 'usage_status', message: '利用状況は必須です' });
    if (price === undefined || price === null) errors.push({ field: 'price', message: '墓石代は必須です' });

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '入力値にエラーがあります',
          details: errors,
        },
      });
    }

    // 墓石コードの重複チェック
    const existingGravestone = await prisma.gravestone.findFirst({
      where: {
        gravestone_code,
        deleted_at: null,
      },
    });

    if (existingGravestone) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: '墓石コードが既に存在します',
          details: [
            { field: 'gravestone_code', message: '墓石コードが既に存在します' },
          ],
        },
      });
    }

    // データ型の検証
    const numericPrice = parseFloat(price);
    if (isNaN(numericPrice) || numericPrice < 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '墓石代は0以上の数値である必要があります',
          details: [
            { field: 'price', message: '墓石代は0以上の数値である必要があります' },
          ],
        },
      });
    }

    // 墓石情報を作成
    const gravestone = await prisma.gravestone.create({
      data: {
        gravestone_code,
        usage_status,
        price: numericPrice,
        orientation,
        location,
        cemetery_type,
        denomination,
        inscription,
        construction_deadline: construction_deadline ? new Date(construction_deadline) : null,
        construction_date: construction_date ? new Date(construction_date) : null,
        epitaph,
        remarks,
      },
    });

    return res.status(201).json({
      success: true,
      data: {
        gravestone,
        message: '墓石情報が正常に登録されました',
      },
    });
  } catch (error) {
    console.error('Create gravestone error:', error);
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

// 墓石情報更新
export const updateGravestone = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const gravestoneId = parseInt(id);

    if (isNaN(gravestoneId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '無効なIDです',
          details: [
            { field: 'id', message: 'IDは数値である必要があります' },
          ],
        },
      });
    }

    const {
      gravestone_code,
      usage_status,
      price,
      orientation,
      location,
      cemetery_type,
      denomination,
      inscription,
      construction_deadline,
      construction_date,
      epitaph,
      remarks,
    } = req.body;

    // 更新対象の墓石が存在するかチェック
    const existingGravestone = await prisma.gravestone.findFirst({
      where: {
        id: gravestoneId,
        deleted_at: null,
      },
    });

    if (!existingGravestone) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '墓石情報が見つかりません',
          details: [],
        },
      });
    }

    // 墓石コードが変更される場合、重複チェック
    if (gravestone_code && gravestone_code !== existingGravestone.gravestone_code) {
      const duplicateGravestone = await prisma.gravestone.findFirst({
        where: {
          gravestone_code,
          deleted_at: null,
          id: { not: gravestoneId },
        },
      });

      if (duplicateGravestone) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'CONFLICT',
            message: '墓石コードが既に存在します',
            details: [
              { field: 'gravestone_code', message: '墓石コードが既に存在します' },
            ],
          },
        });
      }
    }

    // 更新データの準備
    const updateData: any = {};

    if (gravestone_code !== undefined) updateData.gravestone_code = gravestone_code;
    if (usage_status !== undefined) updateData.usage_status = usage_status;
    if (price !== undefined) {
      const numericPrice = parseFloat(price);
      if (isNaN(numericPrice) || numericPrice < 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '墓石代は0以上の数値である必要があります',
            details: [
              { field: 'price', message: '墓石代は0以上の数値である必要があります' },
            ],
          },
        });
      }
      updateData.price = numericPrice;
    }
    if (orientation !== undefined) updateData.orientation = orientation;
    if (location !== undefined) updateData.location = location;
    if (cemetery_type !== undefined) updateData.cemetery_type = cemetery_type;
    if (denomination !== undefined) updateData.denomination = denomination;
    if (inscription !== undefined) updateData.inscription = inscription;
    if (construction_deadline !== undefined) {
      updateData.construction_deadline = construction_deadline ? new Date(construction_deadline) : null;
    }
    if (construction_date !== undefined) {
      updateData.construction_date = construction_date ? new Date(construction_date) : null;
    }
    if (epitaph !== undefined) updateData.epitaph = epitaph;
    if (remarks !== undefined) updateData.remarks = remarks;

    // 墓石情報を更新
    const updatedGravestone = await prisma.gravestone.update({
      where: { id: gravestoneId },
      data: updateData,
    });

    return res.json({
      success: true,
      data: {
        gravestone: updatedGravestone,
        message: '墓石情報が正常に更新されました',
      },
    });
  } catch (error) {
    console.error('Update gravestone error:', error);
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

// 墓石情報削除
export const deleteGravestone = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const gravestoneId = parseInt(id);

    if (isNaN(gravestoneId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '無効なIDです',
          details: [
            { field: 'id', message: 'IDは数値である必要があります' },
          ],
        },
      });
    }

    // 削除対象の墓石が存在するかチェック
    const existingGravestone = await prisma.gravestone.findFirst({
      where: {
        id: gravestoneId,
        deleted_at: null,
      },
    });

    if (!existingGravestone) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '墓石情報が見つかりません',
          details: [],
        },
      });
    }

    // 関連データの存在チェック（削除保護）
    const [contractorCount, usageFeeCount, managementFeeCount] = await Promise.all([
      prisma.contractor.count({
        where: {
          gravestone_id: gravestoneId,
          deleted_at: null,
        },
      }),
      prisma.usageFee.count({
        where: {
          gravestone_id: gravestoneId,
          deleted_at: null,
        },
      }),
      prisma.managementFee.count({
        where: {
          gravestone_id: gravestoneId,
          deleted_at: null,
        },
      }),
    ]);

    if (contractorCount > 0 || usageFeeCount > 0 || managementFeeCount > 0) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: '関連するデータが存在するため削除できません',
          details: [
            {
              message: `契約者: ${contractorCount}件、使用料: ${usageFeeCount}件、管理料: ${managementFeeCount}件の関連データが存在します`,
            },
          ],
        },
      });
    }

    // 論理削除を実行
    await prisma.gravestone.update({
      where: { id: gravestoneId },
      data: { deleted_at: new Date() },
    });

    return res.json({
      success: true,
      data: {
        message: '墓石情報が正常に削除されました',
      },
    });
  } catch (error) {
    console.error('Delete gravestone error:', error);
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