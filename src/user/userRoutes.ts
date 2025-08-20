import { Router } from 'express';
import { getUserInfo, getAllUsers, createUser, updateUser, deleteUser } from './userController';

const router = Router();

// ユーザー一覧取得（管理者のみ）
router.get('/', getAllUsers);
// ユーザー登録（管理者のみ）
router.post('/', createUser);
// ユーザー詳細取得
router.get('/:id', getUserInfo);
// ユーザー情報更新
router.put('/:id', updateUser);
// ユーザー削除（管理者のみ）
router.delete('/:id', deleteUser);

export default router;
