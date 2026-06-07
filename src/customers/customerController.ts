/**
 * 顧客（解約者参照）コントローラー（#311）
 *
 * 業務確認（2026-06-07 Q18/Q20）: 終了顧客150件は「取り込む」「解約者で情報まとめる」。
 * 旧システムは解約で中の人情報が全て消えるため、解約者を一覧・検索できるようにし、
 * notes に記録済みの旧区画手がかり（旧区画cd: X / 区画No: legacy-X）から
 * 該当区画へ辿れるようにする。
 *
 * 解約者（is_terminated=true）は契約・請求・入金にリンクされない独立 Customer
 * （scripts/legacy-migration の idMaps から除外 #129/Q19）のため、台帳問い合わせ
 * （/plots）には現れない。本エンドポイントが唯一の参照経路。
 */

import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../db/prisma';

/**
 * 解約者一覧取得
 * GET /api/v1/customers/terminated
 *
 * 解約者に紐づく家族連絡先（contract_plot_id=null、customer_id 直リンク #311）も
 * 併せて返す（「解約者で情報まとめる」）。
 */
export const getTerminatedCustomers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // validate ミドルウェアで変換済み（paginationSchema: string → number）
    const {
      page = 1,
      limit = 20,
      search,
    } = req.query as unknown as {
      page?: number;
      limit?: number;
      search?: string;
    };
    const skip = (page - 1) * limit;

    const where: Prisma.CustomerWhereInput = {
      deleted_at: null,
      is_terminated: true,
    };

    if (search) {
      const conditions: Prisma.CustomerWhereInput[] = [
        { name: { contains: search, mode: 'insensitive' } },
        { name_kana: { contains: search, mode: 'insensitive' } },
        { phone_number: { contains: search } },
        // notes には旧区画手がかり（旧区画cd / 区画No: legacy-X）が記録済み
        { notes: { contains: search, mode: 'insensitive' } },
      ];
      // 数値なら旧檀家コード一致も検索対象にする
      const numeric = Number(search);
      if (Number.isInteger(numeric) && numeric > 0) {
        conditions.push({ legacy_danka_cd: numeric });
      }
      where.OR = conditions;
    }

    const [total, customers] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        include: {
          familyContacts: {
            where: { deleted_at: null },
            orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
          },
        },
        orderBy: [{ name_kana: 'asc' }, { name: 'asc' }, { id: 'asc' }],
        skip,
        take: limit,
      }),
    ]);

    const items = customers.map((c) => ({
      id: c.id,
      name: c.name,
      nameKana: c.name_kana,
      postalCode: c.postal_code,
      address: c.address,
      phoneNumber: c.phone_number,
      email: c.email,
      // 旧区画手がかり（旧区画cd: X / 区画No: legacy-X）を含む
      notes: c.notes,
      legacyDankaCd: c.legacy_danka_cd,
      createdAt: c.created_at,
      familyContacts: c.familyContacts.map((fc) => ({
        id: fc.id,
        name: fc.name,
        nameKana: fc.name_kana,
        relationship: fc.relationship,
        postalCode: fc.postal_code,
        address: fc.address,
        phoneNumber: fc.phone_number,
        email: fc.email,
        notes: fc.notes,
      })),
    }));

    res.json({
      success: true,
      data: {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
