import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 契約者情報詳細取得
export const getContractorById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const contractor = await prisma.contractor.findFirst({
      where: {
        id: parseInt(id),
        deleted_at: null,
      },
      include: {
        Gravestone: true,
        BillingInfos: {
          where: { deleted_at: null },
        },
        FamilyContacts: {
          where: { deleted_at: null },
        },
        Burials: {
          where: { deleted_at: null },
        },
      },
    });

    if (!contractor) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '契約者が見つかりません',
          details: [],
        },
      });
    }

    res.json({
      success: true,
      data: contractor,
    });
  } catch (error) {
    console.error('契約者詳細取得エラー:', error);
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

// 契約者検索
export const searchContractors = async (req: Request, res: Response) => {
  try {
    const {
      name,
      kana,
      phone,
      gravestone_code,
      usage_status,
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

    if (phone) {
      whereConditions.phone = {
        contains: phone as string,
      };
    }

    // 墓石関連の検索条件
    const gravestoneWhere: any = {};
    if (gravestone_code) {
      gravestoneWhere.gravestone_code = {
        contains: gravestone_code as string,
      };
    }
    if (usage_status) {
      gravestoneWhere.usage_status = usage_status as string;
    }

    if (Object.keys(gravestoneWhere).length > 0) {
      gravestoneWhere.deleted_at = null;
      whereConditions.Gravestone = gravestoneWhere;
    }

    // 検索実行
    const [contractors, totalCount] = await Promise.all([
      prisma.contractor.findMany({
        where: whereConditions,
        include: {
          Gravestone: true,
        },
        skip: offset,
        take: parseInt(limit as string),
        orderBy: {
          id: 'desc',
        },
      }),
      prisma.contractor.count({
        where: whereConditions,
      }),
    ]);

    res.json({
      success: true,
      data: {
        contractors,
        pagination: {
          current_page: parseInt(page as string),
          per_page: parseInt(limit as string),
          total_count: totalCount,
          total_pages: Math.ceil(totalCount / parseInt(limit as string)),
        },
      },
    });
  } catch (error) {
    console.error('契約者検索エラー:', error);
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

// 契約者情報登録
export const createContractor = async (req: Request, res: Response) => {
  try {
    const {
      gravestone_id,
      reservation_date,
      consent_form_number,
      permission_date,
      start_date,
      name,
      kana,
      birth_date,
      gender,
      postal_code,
      address,
      phone,
      fax,
      email,
      domicile_address,
      workplace_name,
      workplace_kana,
      workplace_address,
      workplace_phone,
      dm_setting,
      recipient_type,
      remarks,
      effective_start_date,
      effective_end_date,
    } = req.body;

    // 必須フィールドの検証
    if (!gravestone_id || !start_date || !name || !kana || !postal_code || !address || !phone) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '必須項目が不足しています',
          details: [
            { message: '墓石ID、開始年月日、氏名、ふりがな、郵便番号、住所、電話番号は必須です' },
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

    // 契約者登録
    const contractor = await prisma.contractor.create({
      data: {
        gravestone_id,
        reservation_date: reservation_date ? new Date(reservation_date) : null,
        consent_form_number,
        permission_date: permission_date ? new Date(permission_date) : null,
        start_date: new Date(start_date),
        name,
        kana,
        birth_date: birth_date ? new Date(birth_date) : null,
        gender,
        postal_code,
        address,
        phone,
        fax,
        email,
        domicile_address,
        workplace_name,
        workplace_kana,
        workplace_address,
        workplace_phone,
        dm_setting,
        recipient_type,
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
      data: contractor,
    });
  } catch (error) {
    console.error('契約者登録エラー:', error);
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

// 契約者情報更新
export const updateContractor = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      reservation_date,
      consent_form_number,
      permission_date,
      start_date,
      name,
      kana,
      birth_date,
      gender,
      postal_code,
      address,
      phone,
      fax,
      email,
      domicile_address,
      workplace_name,
      workplace_kana,
      workplace_address,
      workplace_phone,
      dm_setting,
      recipient_type,
      remarks,
      effective_start_date,
      effective_end_date,
    } = req.body;

    // 契約者の存在確認
    const existingContractor = await prisma.contractor.findFirst({
      where: {
        id: parseInt(id),
        deleted_at: null,
      },
    });

    if (!existingContractor) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '契約者が見つかりません',
          details: [],
        },
      });
    }

    // 契約者情報更新
    const updatedContractor = await prisma.contractor.update({
      where: { id: parseInt(id) },
      data: {
        reservation_date: reservation_date ? new Date(reservation_date) : undefined,
        consent_form_number,
        permission_date: permission_date ? new Date(permission_date) : undefined,
        start_date: start_date ? new Date(start_date) : undefined,
        name,
        kana,
        birth_date: birth_date ? new Date(birth_date) : undefined,
        gender,
        postal_code,
        address,
        phone,
        fax,
        email,
        domicile_address,
        workplace_name,
        workplace_kana,
        workplace_address,
        workplace_phone,
        dm_setting,
        recipient_type,
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
      data: updatedContractor,
    });
  } catch (error) {
    console.error('契約者更新エラー:', error);
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

// 契約者情報削除（論理削除）
export const deleteContractor = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // 契約者の存在確認
    const existingContractor = await prisma.contractor.findFirst({
      where: {
        id: parseInt(id),
        deleted_at: null,
      },
    });

    if (!existingContractor) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '契約者が見つかりません',
          details: [],
        },
      });
    }

    // 関連データの確認
    const [relatedBillingInfos, relatedFamilyContacts, relatedBurials] = await Promise.all([
      prisma.billingInfo.findFirst({
        where: {
          contractor_id: parseInt(id),
          deleted_at: null,
        },
      }),
      prisma.familyContact.findFirst({
        where: {
          contractor_id: parseInt(id),
          deleted_at: null,
        },
      }),
      prisma.burial.findFirst({
        where: {
          contractor_id: parseInt(id),
          deleted_at: null,
        },
      }),
    ]);

    if (relatedBillingInfos || relatedFamilyContacts || relatedBurials) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'この契約者に関連するデータが存在するため削除できません',
          details: [],
        },
      });
    }

    // 論理削除の実行
    await prisma.contractor.update({
      where: { id: parseInt(id) },
      data: {
        deleted_at: new Date(),
      },
    });

    res.json({
      success: true,
      data: { message: '契約者を削除しました' },
    });
  } catch (error) {
    console.error('契約者削除エラー:', error);
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

// 契約者変更（業務固有API）
export const transferContractor = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      new_contractor_data,
      transfer_date,
      transfer_reason
    } = req.body;

    // 既存契約者の存在確認
    const existingContractor = await prisma.contractor.findFirst({
      where: {
        id: parseInt(id),
        deleted_at: null,
      },
    });

    if (!existingContractor) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '契約者が見つかりません',
          details: [],
        },
      });
    }

    // 新しい契約者データの検証
    if (!new_contractor_data || !new_contractor_data.name || !new_contractor_data.kana ||
      !new_contractor_data.postal_code || !new_contractor_data.address || !new_contractor_data.phone) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '新契約者の必須項目が不足しています',
          details: [],
        },
      });
    }

    const transferDateValue = transfer_date ? new Date(transfer_date) : new Date();

    // トランザクションで契約者変更を実行
    const result = await prisma.$transaction(async (tx) => {
      // 既存契約者の終了
      await tx.contractor.update({
        where: { id: parseInt(id) },
        data: {
          effective_end_date: transferDateValue,
        },
      });

      // 新契約者の作成
      const newContractor = await tx.contractor.create({
        data: {
          gravestone_id: existingContractor.gravestone_id,
          start_date: transferDateValue,
          name: new_contractor_data.name,
          kana: new_contractor_data.kana,
          birth_date: new_contractor_data.birth_date ? new Date(new_contractor_data.birth_date) : null,
          gender: new_contractor_data.gender,
          postal_code: new_contractor_data.postal_code,
          address: new_contractor_data.address,
          phone: new_contractor_data.phone,
          fax: new_contractor_data.fax,
          email: new_contractor_data.email,
          domicile_address: new_contractor_data.domicile_address,
          workplace_name: new_contractor_data.workplace_name,
          workplace_kana: new_contractor_data.workplace_kana,
          workplace_address: new_contractor_data.workplace_address,
          workplace_phone: new_contractor_data.workplace_phone,
          dm_setting: new_contractor_data.dm_setting,
          recipient_type: new_contractor_data.recipient_type,
          remarks: transfer_reason ? `契約者変更: ${transfer_reason}` : '契約者変更',
          effective_start_date: transferDateValue,
        },
        include: {
          Gravestone: true,
        },
      });

      // 履歴記録
      await tx.history.create({
        data: {
          gravestone_id: existingContractor.gravestone_id,
          contractor_id: existingContractor.id,
          update_type: '契約者変更',
          update_reason: transfer_reason || '契約者変更',
          updated_by: 'staff_1', // TODO: 実際のユーザー名を使用
        },
      });

      return newContractor;
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('契約者変更エラー:', error);
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