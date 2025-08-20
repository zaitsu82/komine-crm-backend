import { Router } from 'express';
import { getAllCustomers, getCustomerInfo, createCustomer, updateCustomer, deleteCustomer } from './customerController';

const router = Router();

// 顧客一覧取得
router.get('/', getAllCustomers);
// 顧客詳細取得
router.get('/:id', getCustomerInfo);
// 顧客情報登録
router.post('/', createCustomer);
// 顧客情報更新
router.put('/:id', updateCustomer);
// 顧客情報削除
router.delete('/:id', deleteCustomer);

export default router;
