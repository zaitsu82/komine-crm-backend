import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 問い合わせ一覧取得
export const getAllInquiries = async (req: Request, res: Response) => {
    const inquiries = await prisma.contract.findMany({
        where: {
            deleteFlg: '0'
        }
    });
    res.status(200).json(inquiries);
}

// 問い合わせ詳細取得
export const getInquiryInfo = async (req: Request, res: Response) => {
    const id = Number(req.query.id);
    if (isNaN(id)) {
        res.status(400).json({ message: `問い合わせIDは数値で指定してください（問い合わせID:${id}）` });
    };
    const inquiry = await prisma.inquiry.findUnique({
        where: {
            id: id,
            deleteFlg: '0'
        }
    });
    if (!inquiry) {
        res.status(404).json({ message: `問い合わせ情報が見つかりません（問い合わせID:${id}）` });
    };
    res.status(200).json(inquiry);
}

// 問い合わせ情報登録
export const createInquiry = async (req: Request, res: Response) => {
    await prisma.inquiry.create({
        data: {
            customerId: req.body.customerId,
            channel: req.body.channel,
            content: req.body.content,
            responseStatus: req.body.responseStatus,
            responseStaffId: req.body.responseStaffId,
            memo: req.body.memo,
            createdAt: new Date(),
            updatedAt: new Date()
        }
    });
    res.status(201).json({ message: `問い合わせ情報が正常に登録されました` });
}

// 問い合わせ情報更新（対応状況・メモ更新）
export const updateInquiry = async (req: Request, res: Response) => {
    const id = Number(req.query.id);
    if (isNaN(id)) {
        res.status(400).json({ message: `問い合わせIDは数値で指定してください（問い合わせID:${id}）` });
    };
    await prisma.inquiry.update({
        where: {
            id: id,
            deleteFlg: '0'
        },
        data: {
            customerId: req.body.customerId,
            channel: req.body.channel,
            content: req.body.content,
            responseStatus: req.body.responseStatus,
            responseStaffId: req.body.responseStaffId,
            memo: req.body.memo,
            updatedAt: new Date()
        }
    });
    res.status(201).json({ message: `問い合わせ情報が正常に更新されました` });
}

// 問い合わせ情報削除
export const deleteInquiry = async (req: Request, res: Response) => {
    const id = Number(req.query.id);
    if (isNaN(id)) {
        res.status(400).json({ message: `問い合わせIDは数値で指定してください（問い合わせID:${id}）` });
    };
    await prisma.inquiry.update({
        where: {
            id: id,
            deleteFlg: '0'
        },
        data: {
            updatedAt: new Date(),
            deleteFlg: '1'
        }
    });
}