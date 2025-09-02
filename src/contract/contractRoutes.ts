import { Router } from 'express';
import { getContracts, getContractDetail, createContract, updateContract, deleteContract } from './contractController';
import { authenticate } from '../middleware/auth';

const router = Router();

// すべての契約APIに認証を適用
router.use(authenticate);

// 契約一覧取得
router.get('/', getContracts);
// 契約詳細取得
router.get('/:contract_id', getContractDetail);
// 契約情報登録
router.post('/', createContract);
// 契約情報更新
router.put('/:contract_id', updateContract);
// 契約情報削除（解約）
router.delete('/:contract_id', deleteContract);

export default router;
