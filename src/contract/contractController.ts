import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 契約情報一覧取得
export const getAllContracts = async (req: Request, res: Response) => {
    const contracts = await prisma.contract.findMany({
        where: {
            deleteFlg: '0'
        }
    });
    res.status(200).json(contracts);
}

// 契約詳細情報取得
export const getContractInfo = async (req: Request, res: Response) => {
    const id = Number(req.query.id);
    if (isNaN(id)) {
        res.status(400).json({ message: `契約IDは数値で指定してください（契約ID:${id}）` });
    };
    const contract = await prisma.contract.findUnique({
        where: {
            id: id,
            deleteFlg: '0'
        }
    });
    if (!contract) {
        res.status(404).json({ message: `契約情報が見つかりません（契約ID:${id}）` });
    };
    res.status(200).json(contract);
}

// 契約登録
export const createContract = async (req: Request, res: Response) => {
    await prisma.contract.create({
        data: {
            customerId: req.body.customerId,
            serviceType: req.body.serviceType,
            contractDate: req.body.contractDate,
            paymentStatus: req.body.paymentStatus,
            notes: req.body.notes,
            createdAt: new Date(),
            updatedAt: new Date()
        }
    });
    res.status(201).json({ message: `契約情報が正常に登録されました` });
}

// 契約情報更新
export const updateContract = async (req: Request, res: Response) => {
    const id = Number(req.query.id);
    if (isNaN(id)) {
        res.status(400).json({ message: `契約IDは数値で指定してください（契約ID:${id}）` });
    };
    await prisma.contract.update({
        where: {
            id: id,
            deleteFlg: '0'
        },
        data: {
            customerId: req.body.customerId,
            serviceType: req.body.serviceType,
            contractDate: req.body.contractDate,
            paymentStatus: req.body.paymentStatus,
            notes: req.body.notes,
            updatedAt: new Date()
        }
    });
    res.status(201).json({ message: `契約情報が正常に更新されました` });
}

// 契約情報削除（解約）
export const deleteContract = async (req: Request, res: Response) => {
    const id = Number(req.query.id);
    if (isNaN(id)) {
        res.status(400).json({ message: `契約IDは数値で指定してください（契約ID:${id}）` });
    };
    await prisma.contract.update({
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