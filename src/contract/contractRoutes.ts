import { Router } from 'express';
import { getAllContracts, getContractInfo, createContract, updateContract, deleteContract } from './contractController';

const router = Router();

// 契約一覧取得
router.get('/', getAllContracts)
// 契約詳細取得
router.get('/:id', getContractInfo)
// 契約情報登録
router.post('/', createContract)
// 契約情報更新
router.put('/:id', updateContract)
// 契約情報削除（解約）
router.delete('/:id', deleteContract)

export default router;
