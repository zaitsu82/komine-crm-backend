import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { comparePassword } from '../utils/password';
import { generateToken } from '../utils/jwt';

const prisma = new PrismaClient();

// ログイン
export async function loginHandler(req: Request, res: Response) {
    try {
        const { email, password } = req.body;
        const user = await prisma.user.findUnique({
            where: {
                email: email,
                deleteFlg: '0'
            }
        });
        if (!user) throw new Error(`該当するユーザーが存在しません（メールアドレス:${email}）`);
        const isMatch = await comparePassword(password, user.password);
        if (!isMatch) throw new Error(`パスワードが一致しません（ユーザーID:${user.id}）`);
        const token = generateToken({ id: user.id, role: user.role });
        res.status(200).json({
            message: 'ログインが正常に完了しました',
            token: token,
            user: {
                id: user.id,
                name: user.name,
                role: user.role,
            }
        });
    } catch (err: unknown) {
        if (err instanceof Error) {
            res.status(401).json({ message: err.message });
        } else {
            res.status(401).json({ message: '不明なエラーが発生しました' });
        }
    }
}

// ログアウト
export async function logoutHandler(req: Request, res: Response) {
    res.status(200).json({ message: 'ログアウトしました' });
}
