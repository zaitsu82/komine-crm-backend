/**
 * 履歴サービス
 *
 * 区画情報の変更履歴を自動記録するためのサービス
 */

import { PrismaClient, ActionType, Prisma } from '@prisma/client';
import { Request } from 'express';
import { detectChangedFields, getIpAddress, ChangedFields } from '../../utils/historyUtils';

// 認証されたリクエストの型定義
interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
    name: string;
    role: string;
    is_active: boolean;
    supabase_uid: string;
  };
}

/**
 * 履歴レコード作成のための入力パラメータ
 */
export interface CreateHistoryInput {
  entityType: 'PhysicalPlot' | 'ContractPlot' | 'Customer' | 'SaleContractRole' | 'Document';
  entityId: string;
  physicalPlotId?: string | null;
  contractPlotId?: string | null;
  actionType: ActionType;
  beforeRecord?: Record<string, unknown> | null;
  afterRecord?: Record<string, unknown> | null;
  changeReason?: string | null;
  req: Request;
}

/**
 * 変更者情報を取得する
 */
function getChangedBy(req: AuthenticatedRequest): string {
  if (req.user) {
    return req.user.name || req.user.email || `Staff#${req.user.id}`;
  }
  return 'system';
}

/**
 * 履歴レコードを作成する
 */
export async function createHistory(
  tx: Prisma.TransactionClient | PrismaClient,
  input: CreateHistoryInput
): Promise<void> {
  const {
    entityType,
    entityId,
    physicalPlotId,
    contractPlotId,
    actionType,
    beforeRecord,
    afterRecord,
    changeReason,
    req,
  } = input;

  // 変更フィールドの検出
  let changedFields: ChangedFields | null = null;
  if (actionType === 'UPDATE' && beforeRecord && afterRecord) {
    changedFields = detectChangedFields(beforeRecord, afterRecord);

    // 変更がない場合は履歴を作成しない
    if (Object.keys(changedFields).length === 0) {
      return;
    }
  }

  const authReq = req as AuthenticatedRequest;

  await tx.history.create({
    data: {
      entity_type: entityType,
      entity_id: entityId,
      physical_plot_id: physicalPlotId || null,
      contract_plot_id: contractPlotId || null,
      action_type: actionType,
      before_record: beforeRecord ? (beforeRecord as Prisma.InputJsonValue) : Prisma.DbNull,
      after_record: afterRecord ? (afterRecord as Prisma.InputJsonValue) : Prisma.DbNull,
      changed_fields: changedFields
        ? (changedFields as unknown as Prisma.InputJsonValue)
        : Prisma.DbNull,
      changed_by: getChangedBy(authReq),
      change_reason: changeReason || null,
      ip_address: getIpAddress(req),
    },
  });
}

/**
 * ContractPlotのCREATE履歴を作成する
 */
export async function recordContractPlotCreated(
  tx: Prisma.TransactionClient | PrismaClient,
  contractPlot: {
    id: string;
    physical_plot_id: string;
    contract_area_sqm: Prisma.Decimal;
    contract_date: Date;
    price: number;
    [key: string]: unknown;
  },
  req: Request
): Promise<void> {
  await createHistory(tx, {
    entityType: 'ContractPlot',
    entityId: contractPlot.id,
    physicalPlotId: contractPlot.physical_plot_id,
    contractPlotId: contractPlot.id,
    actionType: 'CREATE',
    afterRecord: {
      id: contractPlot.id,
      physical_plot_id: contractPlot.physical_plot_id,
      contract_area_sqm: contractPlot.contract_area_sqm.toString(),
      contract_date: contractPlot.contract_date.toISOString(),
      price: contractPlot.price,
    },
    req,
  });
}

/**
 * ContractPlotのUPDATE履歴を作成する
 */
export async function recordContractPlotUpdated(
  tx: Prisma.TransactionClient | PrismaClient,
  beforeData: Record<string, unknown>,
  afterData: Record<string, unknown>,
  physicalPlotId: string,
  contractPlotId: string,
  req: Request,
  changeReason?: string
): Promise<void> {
  await createHistory(tx, {
    entityType: 'ContractPlot',
    entityId: contractPlotId,
    physicalPlotId,
    contractPlotId,
    actionType: 'UPDATE',
    beforeRecord: beforeData,
    afterRecord: afterData,
    changeReason,
    req,
  });
}

/**
 * CustomerのCREATE履歴を作成する
 */
export async function recordCustomerCreated(
  tx: Prisma.TransactionClient | PrismaClient,
  customer: {
    id: string;
    name: string;
    [key: string]: unknown;
  },
  contractPlotId: string | null,
  physicalPlotId: string | null,
  req: Request
): Promise<void> {
  await createHistory(tx, {
    entityType: 'Customer',
    entityId: customer.id,
    physicalPlotId,
    contractPlotId,
    actionType: 'CREATE',
    afterRecord: {
      id: customer.id,
      name: customer.name,
    },
    req,
  });
}

/**
 * CustomerのUPDATE履歴を作成する
 */
export async function recordCustomerUpdated(
  tx: Prisma.TransactionClient | PrismaClient,
  beforeData: Record<string, unknown>,
  afterData: Record<string, unknown>,
  customerId: string,
  contractPlotId: string | null,
  physicalPlotId: string | null,
  req: Request,
  changeReason?: string
): Promise<void> {
  await createHistory(tx, {
    entityType: 'Customer',
    entityId: customerId,
    physicalPlotId,
    contractPlotId,
    actionType: 'UPDATE',
    beforeRecord: beforeData,
    afterRecord: afterData,
    changeReason,
    req,
  });
}

/**
 * DocumentのCREATE履歴を作成する
 */
export async function recordDocumentCreated(
  tx: Prisma.TransactionClient | PrismaClient,
  document: {
    id: string;
    contract_plot_id: string | null;
    type: string;
    name: string;
    [key: string]: unknown;
  },
  req: Request
): Promise<void> {
  await createHistory(tx, {
    entityType: 'Document',
    entityId: document.id,
    contractPlotId: document.contract_plot_id,
    actionType: 'CREATE',
    afterRecord: {
      id: document.id,
      contract_plot_id: document.contract_plot_id,
      type: document.type,
      name: document.name,
    },
    req,
  });
}

/**
 * DocumentのUPDATE履歴を作成する
 */
export async function recordDocumentUpdated(
  tx: Prisma.TransactionClient | PrismaClient,
  beforeData: Record<string, unknown>,
  afterData: Record<string, unknown>,
  documentId: string,
  contractPlotId: string | null,
  req: Request
): Promise<void> {
  await createHistory(tx, {
    entityType: 'Document',
    entityId: documentId,
    contractPlotId,
    actionType: 'UPDATE',
    beforeRecord: beforeData,
    afterRecord: afterData,
    req,
  });
}

/**
 * DocumentのDELETE履歴を作成する
 */
export async function recordDocumentDeleted(
  tx: Prisma.TransactionClient | PrismaClient,
  document: {
    id: string;
    contract_plot_id: string | null;
    type: string;
    name: string;
    [key: string]: unknown;
  },
  req: Request
): Promise<void> {
  await createHistory(tx, {
    entityType: 'Document',
    entityId: document.id,
    contractPlotId: document.contract_plot_id,
    actionType: 'DELETE',
    beforeRecord: {
      id: document.id,
      contract_plot_id: document.contract_plot_id,
      type: document.type,
      name: document.name,
    },
    req,
  });
}
