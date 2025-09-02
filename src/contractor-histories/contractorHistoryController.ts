import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getContractorHistories = async (req: Request, res: Response) => {
  try {
    const { contract_id } = req.params;

    const contractorHistories = await prisma.contractorHistory.findMany({
      where: {
        contractId: parseInt(contract_id),
      },
      select: {
        id: true,
        contractorId: true,
        name: true,
        nameKana: true,
        birthDate: true,
        postalCode: true,
        address1: true,
        address2: true,
        phone1: true,
        phone2: true,
        fax: true,
        email: true,
        workplaceName: true,
        workplaceKana: true,
        workplacePostalCode: true,
        workplaceAddress1: true,
        workplaceAddress2: true,
        workplacePhone1: true,
        workplacePhone2: true,
        changeDate: true,
        changeReason: true,
      },
      orderBy: {
        changeDate: 'desc',
      },
    });

    const formattedHistories = contractorHistories.map(history => ({
      id: history.id,
      contractor_id: history.contractorId,
      name: history.name,
      name_kana: history.nameKana,
      birth_date: history.birthDate,
      postal_code: history.postalCode,
      address1: history.address1,
      address2: history.address2,
      phone1: history.phone1,
      phone2: history.phone2,
      fax: history.fax,
      email: history.email,
      workplace_name: history.workplaceName,
      workplace_kana: history.workplaceKana,
      workplace_postal_code: history.workplacePostalCode,
      workplace_address1: history.workplaceAddress1,
      workplace_address2: history.workplaceAddress2,
      workplace_phone1: history.workplacePhone1,
      workplace_phone2: history.workplacePhone2,
      change_date: history.changeDate,
      change_reason: history.changeReason,
    }));

    return res.json({
      success: true,
      data: formattedHistories,
    });
  } catch (error) {
    console.error('Error fetching contractor histories:', error);
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

export const createContractorHistory = async (req: Request, res: Response) => {
  try {
    const { contract_id } = req.params;
    const data = req.body;

    // 必須項目チェック
    if (!data.contractor_id || !data.name || !data.name_kana || !data.birth_date || !data.postal_code ||
      !data.address1 || !data.address2 || !data.phone1 || !data.change_date) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '必須項目が不足しています',
          details: [
            !data.contractor_id && { field: 'contractor_id', message: '契約者IDは必須です' },
            !data.name && { field: 'name', message: '氏名は必須です' },
            !data.name_kana && { field: 'name_kana', message: 'ふりがなは必須です' },
            !data.birth_date && { field: 'birth_date', message: '生年月日は必須です' },
            !data.postal_code && { field: 'postal_code', message: '郵便番号は必須です' },
            !data.address1 && { field: 'address1', message: '住所1は必須です' },
            !data.address2 && { field: 'address2', message: '住所2は必須です' },
            !data.phone1 && { field: 'phone1', message: '電話番号1は必須です' },
            !data.change_date && { field: 'change_date', message: '変更日は必須です' },
          ].filter(Boolean),
        },
      });
    }

    const contractorHistory = await prisma.contractorHistory.create({
      data: {
        contractId: parseInt(contract_id),
        contractorId: data.contractor_id,
        name: data.name,
        nameKana: data.name_kana,
        birthDate: new Date(data.birth_date),
        postalCode: data.postal_code,
        address1: data.address1,
        address2: data.address2,
        phone1: data.phone1,
        phone2: data.phone2,
        fax: data.fax,
        email: data.email,
        workplaceName: data.workplace_name,
        workplaceKana: data.workplace_kana,
        workplacePostalCode: data.workplace_postal_code,
        workplaceAddress1: data.workplace_address1,
        workplaceAddress2: data.workplace_address2,
        workplacePhone1: data.workplace_phone1,
        workplacePhone2: data.workplace_phone2,
        changeDate: new Date(data.change_date),
        changeReason: data.change_reason,
      },
    });

    return res.status(201).json({
      success: true,
      data: {
        id: contractorHistory.id,
        message: '契約者履歴が正常に作成されました',
      },
    });
  } catch (error) {
    console.error('Error creating contractor history:', error);
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