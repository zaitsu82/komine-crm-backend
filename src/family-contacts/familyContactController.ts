import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getFamilyContacts = async (req: Request, res: Response) => {
  try {
    const { contract_id } = req.params;

    const familyContacts = await prisma.familyContact.findMany({
      where: {
        contractId: parseInt(contract_id),
      },
      select: {
        id: true,
        name: true,
        nameKana: true,
        birthDate: true,
        relationship: true,
        postalCode: true,
        address1: true,
        address2: true,
        address3: true,
        phone1: true,
        phone2: true,
        fax: true,
        email: true,
        permanentAddress: true,
        mailingAddressType: true,
        workplaceName: true,
        workplaceKana: true,
        workplacePostalCode: true,
        workplaceAddress1: true,
        workplaceAddress2: true,
        workplaceAddress3: true,
        workplacePhone1: true,
        workplacePhone2: true,
        notes: true,
      },
      orderBy: {
        id: 'asc',
      },
    });

    const formattedContacts = familyContacts.map(contact => ({
      id: contact.id,
      name: contact.name,
      name_kana: contact.nameKana,
      birth_date: contact.birthDate,
      relationship: contact.relationship,
      postal_code: contact.postalCode,
      address1: contact.address1,
      address2: contact.address2,
      address3: contact.address3,
      phone1: contact.phone1,
      phone2: contact.phone2,
      fax: contact.fax,
      email: contact.email,
      permanent_address: contact.permanentAddress,
      mailing_address_type: contact.mailingAddressType,
      workplace_name: contact.workplaceName,
      workplace_kana: contact.workplaceKana,
      workplace_postal_code: contact.workplacePostalCode,
      workplace_address1: contact.workplaceAddress1,
      workplace_address2: contact.workplaceAddress2,
      workplace_address3: contact.workplaceAddress3,
      workplace_phone1: contact.workplacePhone1,
      workplace_phone2: contact.workplacePhone2,
      notes: contact.notes,
    }));

    return res.json({
      success: true,
      data: formattedContacts,
    });
  } catch (error) {
    console.error('Error fetching family contacts:', error);
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

export const createFamilyContact = async (req: Request, res: Response) => {
  try {
    const { contract_id } = req.params;
    const data = req.body;

    // 必須項目チェック
    if (!data.name || !data.name_kana || !data.phone1 || !data.mailing_address_type) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '必須項目が不足しています',
          details: [
            !data.name && { field: 'name', message: '氏名は必須です' },
            !data.name_kana && { field: 'name_kana', message: 'ふりがなは必須です' },
            !data.phone1 && { field: 'phone1', message: '電話番号1は必須です' },
            !data.mailing_address_type && { field: 'mailing_address_type', message: '送付先区分は必須です' },
          ].filter(Boolean),
        },
      });
    }

    const familyContact = await prisma.familyContact.create({
      data: {
        contractId: parseInt(contract_id),
        name: data.name,
        nameKana: data.name_kana,
        birthDate: data.birth_date ? new Date(data.birth_date) : null,
        relationship: data.relationship,
        postalCode: data.postal_code,
        address1: data.address1,
        address2: data.address2,
        address3: data.address3,
        phone1: data.phone1,
        phone2: data.phone2,
        fax: data.fax,
        email: data.email,
        permanentAddress: data.permanent_address,
        mailingAddressType: data.mailing_address_type,
        workplaceName: data.workplace_name,
        workplaceKana: data.workplace_kana,
        workplacePostalCode: data.workplace_postal_code,
        workplaceAddress1: data.workplace_address1,
        workplaceAddress2: data.workplace_address2,
        workplaceAddress3: data.workplace_address3,
        workplacePhone1: data.workplace_phone1,
        workplacePhone2: data.workplace_phone2,
        notes: data.notes,
      },
    });

    return res.status(201).json({
      success: true,
      data: {
        id: familyContact.id,
        message: '連絡先が正常に作成されました',
      },
    });
  } catch (error) {
    console.error('Error creating family contact:', error);
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

export const updateFamilyContact = async (req: Request, res: Response) => {
  try {
    const { contact_id } = req.params;
    const data = req.body;

    // 必須項目チェック
    if (!data.name || !data.name_kana || !data.phone1 || !data.mailing_address_type) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '必須項目が不足しています',
          details: [
            !data.name && { field: 'name', message: '氏名は必須です' },
            !data.name_kana && { field: 'name_kana', message: 'ふりがなは必須です' },
            !data.phone1 && { field: 'phone1', message: '電話番号1は必須です' },
            !data.mailing_address_type && { field: 'mailing_address_type', message: '送付先区分は必須です' },
          ].filter(Boolean),
        },
      });
    }

    const familyContact = await prisma.familyContact.update({
      where: {
        id: parseInt(contact_id),
      },
      data: {
        name: data.name,
        nameKana: data.name_kana,
        birthDate: data.birth_date ? new Date(data.birth_date) : null,
        relationship: data.relationship,
        postalCode: data.postal_code,
        address1: data.address1,
        address2: data.address2,
        address3: data.address3,
        phone1: data.phone1,
        phone2: data.phone2,
        fax: data.fax,
        email: data.email,
        permanentAddress: data.permanent_address,
        mailingAddressType: data.mailing_address_type,
        workplaceName: data.workplace_name,
        workplaceKana: data.workplace_kana,
        workplacePostalCode: data.workplace_postal_code,
        workplaceAddress1: data.workplace_address1,
        workplaceAddress2: data.workplace_address2,
        workplaceAddress3: data.workplace_address3,
        workplacePhone1: data.workplace_phone1,
        workplacePhone2: data.workplace_phone2,
        notes: data.notes,
      },
    });

    return res.json({
      success: true,
      data: {
        id: familyContact.id,
        message: '連絡先が正常に更新されました',
      },
    });
  } catch (error) {
    console.error('Error updating family contact:', error);
    if (error instanceof Error && error.message.includes('Record to update not found')) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '指定された連絡先が見つかりません',
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

export const deleteFamilyContact = async (req: Request, res: Response) => {
  try {
    const { contact_id } = req.params;

    await prisma.familyContact.delete({
      where: {
        id: parseInt(contact_id),
      },
    });

    return res.json({
      success: true,
      data: {
        message: '連絡先が正常に削除されました',
      },
    });
  } catch (error) {
    console.error('Error deleting family contact:', error);
    if (error instanceof Error && error.message.includes('Record to delete does not exist')) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '指定された連絡先が見つかりません',
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