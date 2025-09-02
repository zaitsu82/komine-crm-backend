import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getStaff = async (req: Request, res: Response) => {
  try {
    const staff = await prisma.staff.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return res.json({
      success: true,
      data: staff.map(s => ({
        id: s.id,
        name: s.name,
        email: s.email,
        is_active: s.isActive,
      })),
    });
  } catch (error) {
    console.error('Error fetching staff:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'サーバー内部エラーが発生しました',
        details: [],
      },
    });
  }
};

export const getPaymentMethods = async (req: Request, res: Response) => {
  try {
    const paymentMethods = await prisma.paymentMethod.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        id: 'asc',
      },
    });

    return res.json({
      success: true,
      data: paymentMethods,
    });
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'サーバー内部エラーが発生しました',
        details: [],
      },
    });
  }
};

export const getGraveTypes = async (req: Request, res: Response) => {
  try {
    const graveTypes = await prisma.graveType.findMany({
      select: {
        id: true,
        code: true,
        name: true,
      },
      orderBy: {
        code: 'asc',
      },
    });

    return res.json({
      success: true,
      data: graveTypes,
    });
  } catch (error) {
    console.error('Error fetching grave types:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'サーバー内部エラーが発生しました',
        details: [],
      },
    });
  }
};

export const getReligiousSects = async (req: Request, res: Response) => {
  try {
    const religiousSects = await prisma.religiousSect.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return res.json({
      success: true,
      data: religiousSects,
    });
  } catch (error) {
    console.error('Error fetching religious sects:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'サーバー内部エラーが発生しました',
        details: [],
      },
    });
  }
};