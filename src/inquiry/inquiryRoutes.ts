import { Router } from 'express';
import { getAllInquiries, getInquiryInfo, createInquiry, updateInquiry, deleteInquiry } from './inquiryController';

const router = Router();

// 問い合わせ一覧取得
router.get('/', getAllInquiries)
// 問い合わせ詳細取得
router.get('/:id', getInquiryInfo)
// 問い合わせ登録
router.post('/', createInquiry)
// 問い合わせ情報更新（対応状況・メモ更新）
router.put('/:id', updateInquiry)
// 問い合わせ情報削除
router.delete('/:id', deleteInquiry)

export default router;