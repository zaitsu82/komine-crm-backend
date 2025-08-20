import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 顧客一覧取得
export const getAllCustomers = async (req: Request, res: Response) => {
    const customers = await prisma.customer.findMany({
        where: {
            deleteFlg: '0'
        }
    });
    res.status(200).json(customers);
}

// 顧客詳細取得
export const getCustomerInfo = async (req: Request, res: Response) => {
    const id = Number(req.query.id);
    if (isNaN(id)) {
        res.status(400).json({ message: `顧客IDは数値で指定してください（顧客ID:${id}）` });
    };
    const customer = await prisma.customer.findUnique({
        where: {
            id: id,
            deleteFlg: '0'
        }
    });
    if (!customer) {
        res.status(404).json({ message: `顧客情報が見つかりません（顧客ID:${id}）` });
    };
    res.status(200).json(customer);
}

// 顧客情報登録
export const createCustomer = async (req: Request, res: Response) => {
    await prisma.customer.create({
        data: {
            name: req.body.name,
            kana: req.body.kana,
            phone: req.body.phone,
            email: req.body.email,
            address: req.body.address,
            type: req.body.type,
            status: req.body.status,
            createdAt: new Date(),
            updatedAt: new Date()
        }
    });
    res.status(201).json({ message: `顧客情報が正常に登録されました` });
};

// 顧客情報更新
export const updateCustomer = async (req: Request, res: Response) => {
    const id = Number(req.query.id);
    if (isNaN(id)) {
        res.status(400).json({ message: `顧客IDは数値で指定してください（顧客ID:${id}）` });
    };
    await prisma.customer.update({
        where: {
            id: id,
            deleteFlg: '0'
        },
        data: {
            name: req.body.name,
            kana: req.body.kana,
            phone: req.body.phone,
            email: req.body.email,
            address: req.body.address,
            type: req.body.type,
            status: req.body.status,
            updatedAt: new Date()
        }
    });
    res.status(201).json({ message: `顧客情報が正常に更新されました` });
}

// 顧客情報削除
export const deleteCustomer = async (req: Request, res: Response) => {
    const id = Number(req.query.id);
    if (isNaN(id)) {
        res.status(400).json({ message: `顧客IDは数値で指定してください（顧客ID:${id}）` });
    };
    await prisma.customer.update({
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