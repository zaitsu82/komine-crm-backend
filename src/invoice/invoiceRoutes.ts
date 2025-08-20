import { Router } from 'express';
import { getAllInvoices, getInvoiceInfo, createInvoice, updateInvoice } from './invoiceController';

const router = Router();

// 請求書一覧取得
router.get('/', getAllInvoices);
// 請求書詳細取得
router.get('/:id', getInvoiceInfo);
// 請求書情報登録
router.post('/', createInvoice);
// 請求書情報更新（支払ステータスなど）
router.put('/:id', updateInvoice);
// 請求書PDFダウンロード
// router.get('/:id/pdf',getInvoicePdf);
// ゆうちょ用CSV出力
// router.get('/export/yucho',getYuchoCsv);

export default router;