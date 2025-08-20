import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../utils/password';

const prisma = new PrismaClient();

// ユーザー一覧取得（管理者のみ）
export const getAllUsers = async (req: Request, res: Response) => {
    const users = await prisma.user.findMany({
        where: {
            deleteFlg: '0'
        }
    });
    res.status(200).json(users);
}

// ユーザー登録（管理者のみ）
export const createUser = async (req: Request, res: Response) => {
    try {
        const userInfo = {
            name: req.body.name,
            email: req.body.email,
            password: await hashPassword(req.body.password),
            role: req.body.role,
            createdAt: new Date(),
            updatedAt: new Date()
        }
        await prisma.user.create({
            data: userInfo
        });
        res.status(200).json({ message: 'ユーザー登録が正常に完了しました' });
    } catch (error: any) {
        console.error('ユーザー登録エラー:', error);
        res.status(400).json({ message: 'ユーザー登録に失敗しました', error: error.message });
    }
}

// ユーザー詳細取得
export const getUserInfo = async (req: Request, res: Response) => {
    const id = Number(req.query.id);
    if (isNaN(id)) {
        res.status(400).json({ message: `ユーザーIDは数値で指定してください（ユーザーID:${id}）` });
    };
    const user = await prisma.user.findUnique({
        where: {
            id: id,
            deleteFlg: '0'
        }
    });
    if (!user) {
        res.status(404).json({ message: `ユーザー情報が見つかりません（ユーザーID:${id}）` });
        return;
    };
    // パスワードを除くユーザー情報を返却
    const { password, ...userWithoutPassword } = user;
    res.status(200).json(userWithoutPassword);
};

// ユーザー情報更新（権限更新あり・管理者のみ）
export const updateUser = async (req: Request, res: Response) => {
    const id = Number(req.query.id);
    if (isNaN(id)) {
        res.status(400).json({ message: `ユーザーIDは数値で指定してください（ユーザーID:${id}）` });
    };
    await prisma.user.update({
        where: {
            id: id,
            deleteFlg: '0'
        },
        data: {
            name: req.body.name,
            email: req.body.email,
            password: req.body.password,
            role: req.body.role,
            updatedAt: new Date()
        }
    });
    res.status(200).json({ message: 'ユーザー情報が正常に更新されました' });
}

// ユーザー情報削除（管理者のみ）
export const deleteUser = async (req: Request, res: Response) => {
    const id = Number(req.query.id);
    if (isNaN(id)) {
        res.status(400).json({ message: `ユーザーIDは数値で指定してください（ユーザーID:${id}）` });
    };
    await prisma.user.update({
        where: {
            id: id,
            deleteFlg: '0'
        },
        data: {
            updatedAt: new Date(),
            deleteFlg: '1'
        }
    });
    res.status(200).json({ message: 'ユーザー情報が正常に削除されました' });
}