import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 請求書一覧取得
export const getAllInvoices = async (req: Request, res: Response) => {
    const invoices = await prisma.invoice.findMany({
        where: {
            deleteFlg: '0'
        }
    });
    res.status(200).json(invoices);
}

// 請求書詳細取得
export const getInvoiceInfo = async (req: Request, res: Response) => {
    const id = Number(req.query.id);
    if (isNaN(id)) {
        res.status(400).json({ message: `請求IDは数値で指定してください（請求ID:${id}）` });
    };
    const invoices = await prisma.invoice.findUnique({
        where: {
            id: id,
            deleteFlg: '0'
        }
    });
    if (!invoices) {
        res.status(404).json({ message: `請求情報が見つかりません（請求ID:${id}）` });
    };
    res.status(200).json(invoices);
}

// 請求書情報登録
export const createInvoice = async (req: Request, res: Response) => {
    await prisma.invoice.create({
        data: {
            contractId: req.body.contractId,
            invoiceDate: req.body.invoiceDate,
            amount: req.body.amount,
            status: req.body.status,
            pdfUrl: req.body.pdfUrl,
            createdAt: new Date(),
            updatedAt: new Date()
        }
    });
    res.status(201).json({ message: `請求情報が正常に登録されました` });
}

// 請求書情報更新（支払ステータスなど）
export const updateInvoice = async (req: Request, res: Response) => {
    const id = Number(req.query.id);
    if (isNaN(id)) {
        res.status(400).json({ message: `請求IDは数値で指定してください（請求ID:${id}）` });
    };
    await prisma.invoice.update({
        where: {
            id: id,
            deleteFlg: '0'
        },
        data: {
            contractId: req.body.contractId,
            invoiceDate: req.body.invoiceDate,
            amount: req.body.amount,
            status: req.body.status,
            pdfUrl: req.body.pdfUrl,
            updatedAt: new Date()
        }
    });
    res.status(201).json({ message: `請求情報が正常に更新されました` });
}
