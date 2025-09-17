import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const checkContractNumber = async (req: Request, res: Response) => {
  try {
    const { number, exclude_id } = req.query;

    if (!number) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '承諾書番号が指定されていません',
          details: [],
        },
      });
    }


    const existingContract = await prisma.contractor.findFirst({
      where: {
        consent_form_number: number as string,
        ...(exclude_id && { id: { not: parseInt(exclude_id as string) } }),
      },
    });

    return res.json({
      success: true,
      data: {
        is_duplicate: !!existingContract,
      },
    });
  } catch (error) {
    console.error('Error checking contract number:', error);
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

interface ValidationError {
  field: string;
  message: string;
}

const validateContract = (data: any): ValidationError[] => {
  const errors: ValidationError[] = [];

  // 申込者情報の必須項目チェック
  if (!data.applicant?.name) {
    errors.push({ field: 'applicant.name', message: '申込者の氏名は必須です' });
  }
  if (!data.applicant?.name_kana) {
    errors.push({ field: 'applicant.name_kana', message: '申込者のふりがなは必須です' });
  }
  if (!data.applicant?.postal_code) {
    errors.push({ field: 'applicant.postal_code', message: '申込者の郵便番号は必須です' });
  }
  if (!data.applicant?.address1) {
    errors.push({ field: 'applicant.address1', message: '申込者の住所1は必須です' });
  }
  if (!data.applicant?.address2) {
    errors.push({ field: 'applicant.address2', message: '申込者の住所2は必須です' });
  }
  if (!data.applicant?.phone1) {
    errors.push({ field: 'applicant.phone1', message: '申込者の電話番号1は必須です' });
  }

  // 契約情報の必須項目チェック
  if (!data.contract?.contract_number) {
    errors.push({ field: 'contract.contract_number', message: '承諾書番号は必須です' });
  }
  if (!data.contract?.application_date) {
    errors.push({ field: 'contract.application_date', message: '申込日は必須です' });
  }
  if (!data.contract?.permission_date) {
    errors.push({ field: 'contract.permission_date', message: '許可日は必須です' });
  }
  if (!data.contract?.start_date) {
    errors.push({ field: 'contract.start_date', message: '開始年月日は必須です' });
  }

  // 契約者情報の必須項目チェック
  if (!data.contractor?.name) {
    errors.push({ field: 'contractor.name', message: '契約者の氏名は必須です' });
  }
  if (!data.contractor?.name_kana) {
    errors.push({ field: 'contractor.name_kana', message: '契約者のふりがなは必須です' });
  }
  if (!data.contractor?.birth_date) {
    errors.push({ field: 'contractor.birth_date', message: '契約者の生年月日は必須です' });
  }
  if (!data.contractor?.gender) {
    errors.push({ field: 'contractor.gender', message: '契約者の性別は必須です' });
  }
  if (!data.contractor?.postal_code) {
    errors.push({ field: 'contractor.postal_code', message: '契約者の郵便番号は必須です' });
  }
  if (!data.contractor?.address1) {
    errors.push({ field: 'contractor.address1', message: '契約者の住所1は必須です' });
  }
  if (!data.contractor?.address2) {
    errors.push({ field: 'contractor.address2', message: '契約者の住所2は必須です' });
  }
  if (!data.contractor?.phone1) {
    errors.push({ field: 'contractor.phone1', message: '契約者の電話番号1は必須です' });
  }
  if (!data.contractor?.permanent_address1) {
    errors.push({ field: 'contractor.permanent_address1', message: '契約者の本籍住所1は必須です' });
  }
  if (!data.contractor?.permanent_address2) {
    errors.push({ field: 'contractor.permanent_address2', message: '契約者の本籍住所2は必須です' });
  }

  // 使用料の必須項目チェック
  if (!data.usage_fee?.calculation_type) {
    errors.push({ field: 'usage_fee.calculation_type', message: '使用料の計算区分は必須です' });
  }
  if (!data.usage_fee?.tax_type) {
    errors.push({ field: 'usage_fee.tax_type', message: '使用料の税区分は必須です' });
  }
  if (!data.usage_fee?.billing_type) {
    errors.push({ field: 'usage_fee.billing_type', message: '使用料の請求区分は必須です' });
  }
  if (data.usage_fee?.billing_years === undefined || data.usage_fee?.billing_years === null) {
    errors.push({ field: 'usage_fee.billing_years', message: '使用料の請求年数は必須です' });
  }
  if (data.usage_fee?.area === undefined || data.usage_fee?.area === null) {
    errors.push({ field: 'usage_fee.area', message: '使用料の面積は必須です' });
  }
  if (data.usage_fee?.total_amount === undefined || data.usage_fee?.total_amount === null) {
    errors.push({ field: 'usage_fee.total_amount', message: '使用料は必須です' });
  }
  if (!data.usage_fee?.payment_method_id) {
    errors.push({ field: 'usage_fee.payment_method_id', message: '使用料の支払方法は必須です' });
  }

  // 管理料の必須項目チェック
  if (!data.management_fee?.calculation_type) {
    errors.push({ field: 'management_fee.calculation_type', message: '管理料の計算区分は必須です' });
  }
  if (!data.management_fee?.tax_type) {
    errors.push({ field: 'management_fee.tax_type', message: '管理料の税区分は必須です' });
  }
  if (!data.management_fee?.billing_type) {
    errors.push({ field: 'management_fee.billing_type', message: '管理料の請求区分は必須です' });
  }
  if (data.management_fee?.billing_years === undefined || data.management_fee?.billing_years === null) {
    errors.push({ field: 'management_fee.billing_years', message: '管理料の請求年数は必須です' });
  }
  if (data.management_fee?.area === undefined || data.management_fee?.area === null) {
    errors.push({ field: 'management_fee.area', message: '管理料の面積は必須です' });
  }
  if (data.management_fee?.billing_month_interval === undefined || data.management_fee?.billing_month_interval === null) {
    errors.push({ field: 'management_fee.billing_month_interval', message: '管理料の請求月間隔は必須です' });
  }
  if (data.management_fee?.management_fee === undefined || data.management_fee?.management_fee === null) {
    errors.push({ field: 'management_fee.management_fee', message: '管理料は必須です' });
  }
  if (!data.management_fee?.last_billing_month) {
    errors.push({ field: 'management_fee.last_billing_month', message: '管理料の最終請求月は必須です' });
  }
  if (!data.management_fee?.payment_method_id) {
    errors.push({ field: 'management_fee.payment_method_id', message: '管理料の支払方法は必須です' });
  }

  // 墓石の必須項目チェック
  if (data.gravestone?.gravestone_price === undefined || data.gravestone?.gravestone_price === null) {
    errors.push({ field: 'gravestone.gravestone_price', message: '墓石代は必須です' });
  }
  if (!data.gravestone?.dealer) {
    errors.push({ field: 'gravestone.dealer', message: '墓石取扱は必須です' });
  }
  if (!data.gravestone?.grave_type_id) {
    errors.push({ field: 'gravestone.grave_type_id', message: '墓地タイプは必須です' });
  }

  // 基本情報②の必須項目チェック
  if (!data.contractor_detail?.dm_setting) {
    errors.push({ field: 'contractor_detail.dm_setting', message: 'DM設定は必須です' });
  }
  if (!data.contractor_detail?.mailing_address_type) {
    errors.push({ field: 'contractor_detail.mailing_address_type', message: '宛先区分は必須です' });
  }

  return errors;
};

export const validateContractData = async (req: Request, res: Response) => {
  try {
    const validationErrors = validateContract(req.body);

    // 承諾書番号の重複チェック
    if (req.body.contract?.contract_number) {
      const existingContract = await prisma.contractor.findFirst({
        where: {
          consent_form_number: req.body.contract.contract_number,
        },
      });

      if (existingContract) {
        validationErrors.push({
          field: 'contract.contract_number',
          message: '承諾書番号が重複しています',
        });
      }
    }

    if (validationErrors.length > 0) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '入力値にエラーがあります',
          details: validationErrors,
        },
      });
    }

    return res.json({
      success: true,
      data: {
        message: 'バリデーションが正常に完了しました',
      },
    });
  } catch (error) {
    console.error('Error validating contract data:', error);
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