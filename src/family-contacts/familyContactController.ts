import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 家族連絡先情報登録
export const createFamilyContact = async (req: Request, res: Response) => {
  try {
    const {
      gravestone_id,
      contractor_id,
      name,
      birth_date,
      relation,
      phone,
      fax,
      email,
      address,
      domicile_address,
      recipient_type,
      workplace_name,
      workplace_kana,
      workplace_address,
      workplace_phone,
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

    // 家族連絡先登録
    const familyContact = await prisma.familyContact.create({
      data: {
        gravestone_id,
        contractor_id,
        name,
        birth_date: birth_date ? new Date(birth_date) : null,
        relation,
        phone,
        fax,
        email,
        address,
        domicile_address,
        recipient_type,
        workplace_name,
        workplace_kana,
        workplace_address,
        workplace_phone,
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
      data: familyContact,
    });
  } catch (error) {
    console.error('家族連絡先登録エラー:', error);
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

// 家族連絡先情報更新
export const updateFamilyContact = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      birth_date,
      relation,
      phone,
      fax,
      email,
      address,
      domicile_address,
      recipient_type,
      workplace_name,
      workplace_kana,
      workplace_address,
      workplace_phone,
      remarks,
      effective_start_date,
      effective_end_date,
    } = req.body;

    // 家族連絡先の存在確認
    const existingFamilyContact = await prisma.familyContact.findFirst({
      where: {
        id: parseInt(id),
        deleted_at: null,
      },
    });

    if (!existingFamilyContact) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '家族連絡先が見つかりません',
          details: [],
        },
      });
    }

    // 家族連絡先情報更新
    const updatedFamilyContact = await prisma.familyContact.update({
      where: { id: parseInt(id) },
      data: {
        name,
        birth_date: birth_date ? new Date(birth_date) : undefined,
        relation,
        phone,
        fax,
        email,
        address,
        domicile_address,
        recipient_type,
        workplace_name,
        workplace_kana,
        workplace_address,
        workplace_phone,
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
      data: updatedFamilyContact,
    });
  } catch (error) {
    console.error('家族連絡先更新エラー:', error);
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

// 家族連絡先情報削除（論理削除）
export const deleteFamilyContact = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // 家族連絡先の存在確認
    const existingFamilyContact = await prisma.familyContact.findFirst({
      where: {
        id: parseInt(id),
        deleted_at: null,
      },
    });

    if (!existingFamilyContact) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '家族連絡先が見つかりません',
          details: [],
        },
      });
    }

    // 論理削除の実行
    await prisma.familyContact.update({
      where: { id: parseInt(id) },
      data: {
        deleted_at: new Date(),
      },
    });

    res.json({
      success: true,
      data: { message: '家族連絡先を削除しました' },
    });
  } catch (error) {
    console.error('家族連絡先削除エラー:', error);
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

// 後方互換性のため残しておく（既存の実装で使用されている可能性）
export const getFamilyContacts = async (req: Request, res: Response) => {
  try {
    res.status(501).json({
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'この機能は実装されていません。契約者詳細APIをご利用ください。',
        details: [],
      },
    });
  } catch (error) {
    console.error('家族連絡先取得エラー:', error);
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