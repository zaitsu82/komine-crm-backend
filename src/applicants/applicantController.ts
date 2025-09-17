import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 申込者情報詳細取得
export const getApplicantById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const applicant = await prisma.applicant.findFirst({
      where: {
        id: parseInt(id),
        deleted_at: null,
      },
      include: {
        Gravestone: true,
      },
    });

    if (!applicant) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '申込者が見つかりません',
          details: [],
        },
      });
    }

    res.json({
      success: true,
      data: applicant,
    });
  } catch (error) {
    console.error('申込者詳細取得エラー:', error);
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

// 申込者情報登録
export const createApplicant = async (req: Request, res: Response) => {
  try {
    const {
      gravestone_id,
      application_date,
      staff_name,
      name,
      kana,
      postal_code,
      address,
      phone,
      remarks,
      effective_start_date,
      effective_end_date,
    } = req.body;

    // 必須フィールドの検証
    if (!gravestone_id || !application_date || !name || !kana || !postal_code || !address || !phone) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '必須項目が不足しています',
          details: [
            { message: '墓石ID、申込日、氏名、ふりがな、郵便番号、住所、電話番号は必須です' },
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

    // 既存の申込者がいるかチェック
    const existingApplicant = await prisma.applicant.findFirst({
      where: {
        gravestone_id,
        deleted_at: null,
      },
    });

    if (existingApplicant) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'この墓石には既に申込者が登録されています',
          details: [],
        },
      });
    }

    // 申込者登録
    const applicant = await prisma.applicant.create({
      data: {
        gravestone_id,
        application_date: new Date(application_date),
        staff_name,
        name,
        kana,
        postal_code,
        address,
        phone,
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
      data: applicant,
    });
  } catch (error: any) {
    console.error('申込者登録エラー:', error);

    // Prismaの制約エラーハンドリング
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'この墓石には既に申込者が登録されています',
          details: [],
        },
      });
    }

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

// 申込者情報更新
export const updateApplicant = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      application_date,
      staff_name,
      name,
      kana,
      postal_code,
      address,
      phone,
      remarks,
      effective_start_date,
      effective_end_date,
    } = req.body;

    // 申込者の存在確認
    const existingApplicant = await prisma.applicant.findFirst({
      where: {
        id: parseInt(id),
        deleted_at: null,
      },
    });

    if (!existingApplicant) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '申込者が見つかりません',
          details: [],
        },
      });
    }

    // 申込者情報更新
    const updatedApplicant = await prisma.applicant.update({
      where: { id: parseInt(id) },
      data: {
        application_date: application_date ? new Date(application_date) : undefined,
        staff_name,
        name,
        kana,
        postal_code,
        address,
        phone,
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
      data: updatedApplicant,
    });
  } catch (error) {
    console.error('申込者更新エラー:', error);
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

// 申込者情報削除（論理削除）
export const deleteApplicant = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // 申込者の存在確認
    const existingApplicant = await prisma.applicant.findFirst({
      where: {
        id: parseInt(id),
        deleted_at: null,
      },
    });

    if (!existingApplicant) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '申込者が見つかりません',
          details: [],
        },
      });
    }

    // 関連データの確認（契約者の存在チェック）
    const relatedContractor = await prisma.contractor.findFirst({
      where: {
        gravestone_id: existingApplicant.gravestone_id,
        deleted_at: null,
      },
    });

    if (relatedContractor) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'この申込者に関連する契約者が存在するため削除できません',
          details: [],
        },
      });
    }

    // 論理削除の実行
    await prisma.applicant.update({
      where: { id: parseInt(id) },
      data: {
        deleted_at: new Date(),
      },
    });

    res.json({
      success: true,
      data: { message: '申込者を削除しました' },
    });
  } catch (error) {
    console.error('申込者削除エラー:', error);
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