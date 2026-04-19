/**
 * ゆうちょ連携コントローラー
 *
 * - GET /api/v1/yucho/billing : 請求対象データの一覧取得
 * - GET /api/v1/yucho/export  : ゆうちょ自動払込み用 全銀協CSVを生成・返却
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ValidationError } from '../middleware/errorHandler';
import { yuchoBillingQuerySchema, yuchoExportQuerySchema } from '../validations/yuchoValidation';
import { fetchYuchoBillingData } from './yuchoService';
import { buildZenginCsv } from './yuchoCsv';

const formatZodError = (err: ZodError): ValidationError => {
  const details = err.issues.map((i) => ({
    field: i.path.join('.'),
    message: i.message,
  }));
  return new ValidationError('バリデーションエラー', details);
};

/**
 * GET /api/v1/yucho/billing
 */
export const getYuchoBilling = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsed = yuchoBillingQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw formatZodError(parsed.error);
    }

    const data = await fetchYuchoBillingData(parsed.data);

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/yucho/export
 */
export const exportYuchoCsv = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsed = yuchoExportQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw formatZodError(parsed.error);
    }
    const params = parsed.data;

    const data = await fetchYuchoBillingData({
      year: params.year,
      month: params.month,
      category: params.category,
      status: params.status,
    });

    const csv = buildZenginCsv({
      header: {
        clientCode: params.clientCode,
        clientName: params.clientName,
        transferDate: params.transferDate,
        bankCode: params.bankCode,
        branchCode: params.branchCode,
      },
      items: data.items,
    });

    const fileName = `yucho_${params.year}${params.month != null ? String(params.month).padStart(2, '0') : 'all'}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
};
