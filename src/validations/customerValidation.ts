/**
 * 顧客（解約者参照）関連のバリデーションスキーマ（#311）
 */
import { z } from 'zod';
import { paginationSchema } from '../middleware/validation';

/**
 * 解約者一覧クエリのバリデーションスキーマ
 * GET /customers/terminated
 */
export const terminatedCustomerQuerySchema = paginationSchema.extend({
  // 氏名・カナ・電話番号・旧檀家コードの部分一致検索
  search: z.string().max(100).optional(),
});
