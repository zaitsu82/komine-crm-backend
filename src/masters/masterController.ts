import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../db/prisma';
import { ConflictError, NotFoundError } from '../middleware/errorHandler';
import { getRequestLogger } from '../utils/logger';
import {
  createMasterSchema,
  createSectionNameMasterSchema,
  updateMasterSchema,
  isValidMasterType,
  MasterType,
} from '../validations/masterValidation';

/**
 * マスターデータの共通レスポンス型
 */
interface MasterData {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  sortOrder?: number | null;
  isActive: boolean;
}

interface TaxTypeMasterData extends MasterData {
  taxRate?: string | null;
}

interface SectionNameMasterData extends MasterData {
  period: string;
}

/**
 * マスタ CRUD で使う Prisma デリゲートの最小構造型。
 * 各マスタの Prisma デリゲートは型が異なるため、共通して使う create/update/delete
 * のみを構造的に表現し、`getMasterDelegate` で 1 箇所だけアサーションする。
 */
interface MasterRow {
  id: number;
  code: string;
  name: string;
  description: string | null;
  sort_order: number | null;
  is_active: boolean;
  tax_rate?: { toString: () => string } | null;
  period?: string | null;
}

interface MasterDelegate {
  create: (args: { data: Record<string, unknown> }) => Promise<MasterRow>;
  update: (args: { where: { id: number }; data: Record<string, unknown> }) => Promise<MasterRow>;
  delete: (args: { where: { id: number } }) => Promise<MasterRow>;
  findUnique: (args: { where: { id: number } }) => Promise<MasterRow | null>;
}

/**
 * マスタGET用の where 句を組み立てる（#238）。
 * 既定は有効（is_active: true）のみ。`?include_inactive=true` を付けると
 * 無効化済みも含めて返す。無効マスタの code を参照している過去データの
 * 名称解決（frontend resolveMasterName）が「旧コード: X」に化けるのを防ぐため、
 * 名称解決用のフェッチはこのパラメータを使う（フォームの選択肢は既定のまま）。
 */
const buildMasterWhere = (req: Request): { is_active?: boolean } =>
  req.query?.['include_inactive'] === 'true' ? {} : { is_active: true };

/**
 * エラーオブジェクト（Prisma など）から `code` を安全に取り出す。
 * `catch (error: unknown)` を維持したまま P2002 / P2025 判定を行うためのヘルパ。
 */
const getErrorCode = (error: unknown): string | undefined => {
  if (error !== null && typeof error === 'object' && 'code' in error) {
    const { code } = error as { code?: unknown };
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
};

/**
 * 墓地タイプマスタ取得
 * GET /api/v1/masters/cemetery-type
 */
export const getCemeteryTypeMaster = async (req: Request, res: Response) => {
  try {
    const data = await prisma.cemeteryTypeMaster.findMany({
      where: buildMasterWhere(req),
      orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
    });

    const formatted: MasterData[] = data.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      description: item.description,
      sortOrder: item.sort_order,
      isActive: item.is_active,
    }));

    res.status(200).json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    getRequestLogger().error({ err: error }, 'Error fetching cemetery type master');
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '墓地タイプマスタの取得に失敗しました',
      },
    });
  }
};

/**
 * 支払方法マスタ取得
 * GET /api/v1/masters/payment-method
 */
export const getPaymentMethodMaster = async (req: Request, res: Response) => {
  try {
    const data = await prisma.paymentMethodMaster.findMany({
      where: buildMasterWhere(req),
      orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
    });

    const formatted: MasterData[] = data.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      description: item.description,
      sortOrder: item.sort_order,
      isActive: item.is_active,
    }));

    res.status(200).json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    getRequestLogger().error({ err: error }, 'Error fetching payment method master');
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '支払方法マスタの取得に失敗しました',
      },
    });
  }
};

/**
 * 税タイプマスタ取得
 * GET /api/v1/masters/tax-type
 */
export const getTaxTypeMaster = async (req: Request, res: Response) => {
  try {
    const data = await prisma.taxTypeMaster.findMany({
      where: buildMasterWhere(req),
      orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
    });

    const formatted: TaxTypeMasterData[] = data.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      description: item.description,
      sortOrder: item.sort_order,
      isActive: item.is_active,
      taxRate: item.tax_rate?.toString() || null,
    }));

    res.status(200).json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    getRequestLogger().error({ err: error }, 'Error fetching tax type master');
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '税タイプマスタの取得に失敗しました',
      },
    });
  }
};

/**
 * 計算タイプマスタ取得
 * GET /api/v1/masters/calc-type
 */
export const getCalcTypeMaster = async (req: Request, res: Response) => {
  try {
    const data = await prisma.calcTypeMaster.findMany({
      where: buildMasterWhere(req),
      orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
    });

    const formatted: MasterData[] = data.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      description: item.description,
      sortOrder: item.sort_order,
      isActive: item.is_active,
    }));

    res.status(200).json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    getRequestLogger().error({ err: error }, 'Error fetching calc type master');
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '計算タイプマスタの取得に失敗しました',
      },
    });
  }
};

/**
 * 請求タイプマスタ取得
 * GET /api/v1/masters/billing-type
 */
export const getBillingTypeMaster = async (req: Request, res: Response) => {
  try {
    const data = await prisma.billingTypeMaster.findMany({
      where: buildMasterWhere(req),
      orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
    });

    const formatted: MasterData[] = data.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      description: item.description,
      sortOrder: item.sort_order,
      isActive: item.is_active,
    }));

    res.status(200).json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    getRequestLogger().error({ err: error }, 'Error fetching billing type master');
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '請求タイプマスタの取得に失敗しました',
      },
    });
  }
};

/**
 * 受取人タイプマスタ取得
 * GET /api/v1/masters/recipient-type
 */
export const getRecipientTypeMaster = async (req: Request, res: Response) => {
  try {
    const data = await prisma.recipientTypeMaster.findMany({
      where: buildMasterWhere(req),
      orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
    });

    const formatted: MasterData[] = data.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      description: item.description,
      sortOrder: item.sort_order,
      isActive: item.is_active,
    }));

    res.status(200).json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    getRequestLogger().error({ err: error }, 'Error fetching recipient type master');
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '受取人タイプマスタの取得に失敗しました',
      },
    });
  }
};

/**
 * 工事タイプマスタ取得
 * GET /api/v1/masters/construction-type
 */
export const getConstructionTypeMaster = async (req: Request, res: Response) => {
  try {
    const data = await prisma.constructionTypeMaster.findMany({
      where: buildMasterWhere(req),
      orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
    });

    const formatted: MasterData[] = data.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      description: item.description,
      sortOrder: item.sort_order,
      isActive: item.is_active,
    }));

    res.status(200).json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    getRequestLogger().error({ err: error }, 'Error fetching construction type master');
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '工事タイプマスタの取得に失敗しました',
      },
    });
  }
};

/**
 * 区画名マスタ取得
 * GET /api/v1/masters/section-name
 */
export const getSectionNameMaster = async (req: Request, res: Response) => {
  try {
    const data = await prisma.sectionNameMaster.findMany({
      where: buildMasterWhere(req),
      orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
    });

    const formatted: SectionNameMasterData[] = data.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      period: item.period,
      description: item.description,
      sortOrder: item.sort_order,
      isActive: item.is_active,
    }));

    res.status(200).json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    getRequestLogger().error({ err: error }, 'Error fetching section name master');
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '区画名マスタの取得に失敗しました',
      },
    });
  }
};

/**
 * 続柄マスタ取得
 * GET /api/v1/masters/relationship
 */
export const getRelationshipMaster = async (req: Request, res: Response) => {
  try {
    const data = await prisma.relationshipMaster.findMany({
      where: buildMasterWhere(req),
      orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
    });

    const formatted: MasterData[] = data.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      description: item.description,
      sortOrder: item.sort_order,
      isActive: item.is_active,
    }));

    res.status(200).json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    getRequestLogger().error({ err: error }, 'Error fetching relationship master');
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '続柄マスタの取得に失敗しました',
      },
    });
  }
};

/**
 * 工事業者マスタ取得
 * GET /api/v1/masters/contractor
 */
export const getContractorMaster = async (req: Request, res: Response) => {
  try {
    const data = await prisma.contractorMaster.findMany({
      where: buildMasterWhere(req),
      orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
    });

    const formatted: MasterData[] = data.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      description: item.description,
      sortOrder: item.sort_order,
      isActive: item.is_active,
    }));

    res.status(200).json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    getRequestLogger().error({ err: error }, 'Error fetching contractor master');
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '工事業者マスタの取得に失敗しました',
      },
    });
  }
};

/**
 * 方角マスタ取得
 * GET /api/v1/masters/direction
 */
export const getDirectionMaster = async (req: Request, res: Response) => {
  try {
    const data = await prisma.directionMaster.findMany({
      where: buildMasterWhere(req),
      orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
    });

    const formatted: MasterData[] = data.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      description: item.description,
      sortOrder: item.sort_order,
      isActive: item.is_active,
    }));

    res.status(200).json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    getRequestLogger().error({ err: error }, 'Error fetching direction master');
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '方角マスタの取得に失敗しました',
      },
    });
  }
};

/**
 * 位置マスタ取得
 * GET /api/v1/masters/position
 */
export const getPositionMaster = async (req: Request, res: Response) => {
  try {
    const data = await prisma.positionMaster.findMany({
      where: buildMasterWhere(req),
      orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
    });

    const formatted: MasterData[] = data.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      description: item.description,
      sortOrder: item.sort_order,
      isActive: item.is_active,
    }));

    res.status(200).json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    getRequestLogger().error({ err: error }, 'Error fetching position master');
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '位置マスタの取得に失敗しました',
      },
    });
  }
};

/**
 * 合祀年数マスタ取得（#343）
 */
export const getValidityPeriodMaster = async (req: Request, res: Response) => {
  try {
    const data = await prisma.validityPeriodMaster.findMany({
      where: buildMasterWhere(req),
      orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
    });

    const formatted: MasterData[] = data.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      description: item.description,
      sortOrder: item.sort_order,
      isActive: item.is_active,
    }));

    res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    getRequestLogger().error({ err: error }, 'Error fetching validity period master');
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: '合祀年数マスタの取得に失敗しました' },
    });
  }
};

/**
 * 変更理由マスタ取得（#344）
 */
export const getChangeReasonMaster = async (req: Request, res: Response) => {
  try {
    const data = await prisma.changeReasonMaster.findMany({
      where: buildMasterWhere(req),
      orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
    });

    const formatted: MasterData[] = data.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      description: item.description,
      sortOrder: item.sort_order,
      isActive: item.is_active,
    }));

    res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    getRequestLogger().error({ err: error }, 'Error fetching change reason master');
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: '変更理由マスタの取得に失敗しました' },
    });
  }
};

/**
 * マスタ CRUD で使う DB クライアント。トランザクション内では tx を渡す（#278）。
 */
type MasterDbClient = typeof prisma | Prisma.TransactionClient;

/**
 * マスタタイプからPrismaモデルデリゲートを取得
 */
const getMasterDelegate = (masterType: MasterType, db: MasterDbClient = prisma): MasterDelegate => {
  const delegateMap: Record<MasterType, unknown> = {
    'cemetery-type': db.cemeteryTypeMaster,
    'payment-method': db.paymentMethodMaster,
    'tax-type': db.taxTypeMaster,
    'calc-type': db.calcTypeMaster,
    'billing-type': db.billingTypeMaster,
    'recipient-type': db.recipientTypeMaster,
    'construction-type': db.constructionTypeMaster,
    'section-name': db.sectionNameMaster,
    relationship: db.relationshipMaster,
    contractor: db.contractorMaster,
    direction: db.directionMaster,
    position: db.positionMaster,
    'validity-period': db.validityPeriodMaster,
    'change-reason': db.changeReasonMaster,
  };
  return delegateMap[masterType] as MasterDelegate;
};

const masterTypeLabels: Record<MasterType, string> = {
  'cemetery-type': '墓地タイプ',
  'payment-method': '支払方法',
  'tax-type': '税タイプ',
  'calc-type': '計算タイプ',
  'billing-type': '請求タイプ',
  'recipient-type': '受取人タイプ',
  'construction-type': '工事タイプ',
  'section-name': '区画名',
  relationship: '続柄',
  contractor: '工事業者',
  direction: '方角',
  position: '位置',
  'validity-period': '合祀年数',
  'change-reason': '変更理由',
};

/**
 * 各マスタの code カラム長（prisma/schema.prisma の @db.VarChar に整合 #232）。
 * code 自動生成時の切り詰めに使う。
 */
const MASTER_CODE_MAX_LENGTH: Record<MasterType, number> = {
  'cemetery-type': 10,
  'payment-method': 10,
  'tax-type': 10,
  'calc-type': 10,
  'billing-type': 10,
  'recipient-type': 10,
  'construction-type': 10,
  'section-name': 20,
  relationship: 10,
  contractor: 20,
  direction: 10,
  position: 10,
  'validity-period': 10,
  'change-reason': 10,
};

/**
 * マスタ code（direction/position は id）の使用箇所件数を集計する（#231）。
 * マスタ参照は FK ではなく String カラムのため、削除やコード変更で
 * 参照側が孤児コード化して「旧コード: X」表示に化けるのを事前に防ぐ。
 * 参照箇所が特定できないマスタタイプは 0 を返す（従来動作を維持）。
 */
const countMasterCodeUsage = async (
  masterType: MasterType,
  code: string,
  db: MasterDbClient = prisma
): Promise<number> => {
  switch (masterType) {
    case 'tax-type': {
      const [usage, management] = await Promise.all([
        db.usageFee.count({ where: { tax_type: code, deleted_at: null } }),
        db.managementFee.count({ where: { tax_type: code, deleted_at: null } }),
      ]);
      return usage + management;
    }
    case 'calc-type': {
      const [usage, management] = await Promise.all([
        db.usageFee.count({ where: { calculation_type: code, deleted_at: null } }),
        db.managementFee.count({ where: { calculation_type: code, deleted_at: null } }),
      ]);
      return usage + management;
    }
    case 'billing-type': {
      const [usage, management] = await Promise.all([
        db.usageFee.count({ where: { billing_type: code, deleted_at: null } }),
        db.managementFee.count({ where: { billing_type: code, deleted_at: null } }),
      ]);
      return usage + management;
    }
    case 'payment-method': {
      const [usage, management] = await Promise.all([
        db.usageFee.count({ where: { payment_method: code, deleted_at: null } }),
        db.managementFee.count({ where: { payment_method: code, deleted_at: null } }),
      ]);
      return usage + management;
    }
    case 'construction-type':
      return db.constructionInfo.count({
        where: { construction_type: code, deleted_at: null },
      });
    case 'contractor':
      return db.constructionInfo.count({ where: { contractor: code, deleted_at: null } });
    // direction/position は GravestoneInfo が int を保持し、名称解決は Number(code) と
    // 突合する（seed / フロント resolveMasterName と整合）。PK id は API 追加・再seed・
    // 移行 backfill で code とドリフトしうるため、id でなく code 基準で数える（#268）。
    // ※フレッシュ seed 直後は偶然 id === Number(code) のため従来実装でも一致していた。
    case 'direction': {
      const codeNum = Number(code);
      if (!Number.isInteger(codeNum)) return 0;
      return db.gravestoneInfo.count({ where: { direction_id: codeNum, deleted_at: null } });
    }
    case 'position': {
      const codeNum = Number(code);
      if (!Number.isInteger(codeNum)) return 0;
      return db.gravestoneInfo.count({ where: { position_id: codeNum, deleted_at: null } });
    }
    default:
      return 0;
  }
};

/**
 * マスタデータ作成
 * POST /api/v1/masters/:masterType
 */
export const createMaster = async (req: Request, res: Response): Promise<void> => {
  const masterType = req.params['masterType'] as string;

  if (!isValidMasterType(masterType)) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: `無効なマスタタイプです: ${masterType}`,
        details: [],
      },
    });
    return;
  }

  // section-name は period が NOT NULL のため作成時のみ専用スキーマで必須チェックし、
  // 欠落時に 500 ではなく details 付きの 400 VALIDATION_ERROR を返す。
  const schema = masterType === 'section-name' ? createSectionNameMasterSchema : createMasterSchema;
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'バリデーションエラー',
        details: parsed.error.issues.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      },
    });
    return;
  }

  try {
    const delegate = getMasterDelegate(masterType);
    const { taxRate, sortOrder, isActive, period, ...rest } = parsed.data;

    // Auto-generate code from name if not provided
    // カラム長（VarChar(10)系が大半）を超えると P2000 で原因不明の500になるため、
    // masterType ごとの実カラム長で切り詰める（#232）
    if (!rest.code) {
      rest.code = rest.name.substring(0, MASTER_CODE_MAX_LENGTH[masterType]);
    }

    const createData: Record<string, unknown> = {
      ...rest,
      sort_order: sortOrder ?? null,
      is_active: isActive ?? true,
    };

    if (masterType === 'tax-type' && taxRate !== undefined) {
      createData['tax_rate'] = taxRate;
    }
    if (masterType === 'section-name' && period !== undefined) {
      createData['period'] = period;
    }

    const created = await delegate.create({ data: createData });
    const label = masterTypeLabels[masterType];

    const formatted: Record<string, unknown> = {
      id: created.id,
      code: created.code,
      name: created.name,
      description: created.description,
      sortOrder: created.sort_order,
      isActive: created.is_active,
    };
    if (masterType === 'tax-type' && 'tax_rate' in created) {
      formatted['taxRate'] = created.tax_rate?.toString() || null;
    }
    if (masterType === 'section-name' && 'period' in created) {
      formatted['period'] = created.period;
    }

    res.status(201).json({
      success: true,
      data: formatted,
      message: `${label}マスタを作成しました`,
    });
  } catch (error: unknown) {
    const label = masterTypeLabels[masterType];

    if (getErrorCode(error) === 'P2002') {
      res.status(409).json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: `${label}マスタのコードが重複しています`,
          details: [],
        },
      });
      return;
    }

    // 文字列長超過（明示指定の code が長すぎる等）は 500 でなく 400 で返す（#232）
    if (getErrorCode(error) === 'P2000') {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `${label}マスタのコードが長すぎます（最大${MASTER_CODE_MAX_LENGTH[masterType]}文字）`,
          details: [{ field: 'code', message: 'コードが長すぎます' }],
        },
      });
      return;
    }

    getRequestLogger().error({ err: error, masterType }, 'Error creating master');
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: `${label}マスタの作成に失敗しました`,
      },
    });
  }
};

/**
 * マスタデータ更新
 * PUT /api/v1/masters/:masterType/:id
 */
export const updateMaster = async (req: Request, res: Response): Promise<void> => {
  const masterType = req.params['masterType'] as string;
  const id = req.params['id'] as string;

  if (!isValidMasterType(masterType)) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: `無効なマスタタイプです: ${masterType}`,
        details: [],
      },
    });
    return;
  }

  const masterId = parseInt(id, 10);
  if (isNaN(masterId)) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: '無効なIDです',
        details: [],
      },
    });
    return;
  }

  const parsed = updateMasterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'バリデーションエラー',
        details: parsed.error.issues.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      },
    });
    return;
  }

  try {
    const { taxRate, sortOrder, isActive, period, ...rest } = parsed.data;

    const updateData: Record<string, unknown> = { ...rest };
    if (sortOrder !== undefined) updateData['sort_order'] = sortOrder;
    if (isActive !== undefined) updateData['is_active'] = isActive;
    if (masterType === 'tax-type' && taxRate !== undefined) {
      updateData['tax_rate'] = taxRate;
    }
    if (masterType === 'section-name' && period !== undefined) {
      updateData['period'] = period;
    }

    // 使用中チェックと更新を単一 Serializable tx で原子化する（#278）。
    // check と act が別 tx だと、count=0 確認〜update の間に同 code を参照する
    // 契約が並行コミットされて孤児コード化する（#231 事象の同時実行版）。
    const updated = await prisma.$transaction(
      async (tx) => {
        const delegate = getMasterDelegate(masterType, tx);

        // 使用中マスタの code 改名は既存参照（String カラム）を孤児化するため拒否する（#231）
        if (rest.code !== undefined) {
          const existing = await delegate.findUnique({ where: { id: masterId } });
          if (existing && existing.code !== rest.code) {
            const usageCount = await countMasterCodeUsage(masterType, existing.code, tx);
            if (usageCount > 0) {
              const label = masterTypeLabels[masterType];
              throw new ConflictError(
                `${label}マスタのコード「${existing.code}」は${usageCount}件のデータで使用中のため変更できません`
              );
            }
          }
        }

        return delegate.update({
          where: { id: masterId },
          data: updateData,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    const label = masterTypeLabels[masterType];
    const formatted: Record<string, unknown> = {
      id: updated.id,
      code: updated.code,
      name: updated.name,
      description: updated.description,
      sortOrder: updated.sort_order,
      isActive: updated.is_active,
    };
    if (masterType === 'tax-type' && 'tax_rate' in updated) {
      formatted['taxRate'] = updated.tax_rate?.toString() || null;
    }
    if (masterType === 'section-name' && 'period' in updated) {
      formatted['period'] = updated.period;
    }

    res.status(200).json({
      success: true,
      data: formatted,
      message: `${label}マスタを更新しました`,
    });
  } catch (error: unknown) {
    const label = masterTypeLabels[masterType];

    // tx 内の使用中チェックで拒否されたケース（#231 / #278）
    if (error instanceof ConflictError) {
      res.status(409).json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: error.message,
          details: [],
        },
      });
      return;
    }

    // Serializable トランザクションの直列化競合。リトライで成功するため 409（#278）
    if (getErrorCode(error) === 'P2034') {
      res.status(409).json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: '同時更新が競合しました。もう一度お試しください',
          details: [],
        },
      });
      return;
    }

    if (getErrorCode(error) === 'P2025') {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `${label}マスタが見つかりません (ID: ${id})`,
          details: [],
        },
      });
      return;
    }

    if (getErrorCode(error) === 'P2002') {
      res.status(409).json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: `${label}マスタのコードが重複しています`,
          details: [],
        },
      });
      return;
    }

    // 文字列長超過は 500 でなく 400 で返す（#232）
    if (getErrorCode(error) === 'P2000') {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `${label}マスタのコードが長すぎます（最大${MASTER_CODE_MAX_LENGTH[masterType]}文字）`,
          details: [{ field: 'code', message: 'コードが長すぎます' }],
        },
      });
      return;
    }

    getRequestLogger().error({ err: error, masterType }, 'Error updating master');
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: `${label}マスタの更新に失敗しました`,
      },
    });
  }
};

/**
 * マスタデータ削除
 * DELETE /api/v1/masters/:masterType/:id
 */
export const deleteMaster = async (req: Request, res: Response): Promise<void> => {
  const masterType = req.params['masterType'] as string;
  const id = req.params['id'] as string;

  if (!isValidMasterType(masterType)) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: `無効なマスタタイプです: ${masterType}`,
        details: [],
      },
    });
    return;
  }

  const masterId = parseInt(id, 10);
  if (isNaN(masterId)) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: '無効なIDです',
        details: [],
      },
    });
    return;
  }

  try {
    const label = masterTypeLabels[masterType];

    // 使用中チェック（#231）: マスタ参照は FK でなく String カラムのため、
    // 物理削除すると参照側が孤児コード化し「旧コード: X」表示に化ける。
    // 使用中の場合は削除を拒否し、論理無効化（isActive=false）を案内する。
    // チェックと削除は単一 Serializable tx で原子化する（#278）: 別 tx だと
    // count=0 確認〜delete の間に同 code を参照する契約が並行コミットされて
    // 孤児コード化する。
    await prisma.$transaction(
      async (tx) => {
        const delegate = getMasterDelegate(masterType, tx);

        const existing = await delegate.findUnique({ where: { id: masterId } });
        if (!existing) {
          throw new NotFoundError(`${label}マスタが見つかりません (ID: ${id})`);
        }

        const usageCount = await countMasterCodeUsage(masterType, existing.code, tx);
        if (usageCount > 0) {
          throw new ConflictError(
            `${label}マスタ「${existing.name}」は${usageCount}件のデータで使用中のため削除できません。先に無効化してください`
          );
        }

        await delegate.delete({ where: { id: masterId } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    res.status(200).json({
      success: true,
      message: `${label}マスタを削除しました`,
    });
  } catch (error: unknown) {
    const label = masterTypeLabels[masterType];

    // tx 内の存在チェックで弾かれたケース（#278）
    if (error instanceof NotFoundError) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: error.message,
          details: [],
        },
      });
      return;
    }

    // tx 内の使用中チェックで拒否されたケース（#231 / #278）
    if (error instanceof ConflictError) {
      res.status(409).json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: error.message,
          details: [],
        },
      });
      return;
    }

    // Serializable トランザクションの直列化競合。リトライで成功するため 409（#278）
    if (getErrorCode(error) === 'P2034') {
      res.status(409).json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: '同時更新が競合しました。もう一度お試しください',
          details: [],
        },
      });
      return;
    }

    if (getErrorCode(error) === 'P2025') {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `${label}マスタが見つかりません (ID: ${id})`,
          details: [],
        },
      });
      return;
    }

    getRequestLogger().error({ err: error, masterType }, 'Error deleting master');
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: `${label}マスタの削除に失敗しました`,
      },
    });
  }
};

/**
 * 全マスタデータ一括取得
 * GET /api/v1/masters/all
 */
export const getAllMasters = async (req: Request, res: Response) => {
  try {
    const [
      cemeteryType,
      paymentMethod,
      taxType,
      calcType,
      billingType,
      recipientType,
      constructionType,
      sectionName,
      relationship,
      contractor,
      direction,
      position,
      validityPeriod,
      changeReason,
    ] = await Promise.all([
      prisma.cemeteryTypeMaster.findMany({
        where: buildMasterWhere(req),
        orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
      }),
      prisma.paymentMethodMaster.findMany({
        where: buildMasterWhere(req),
        orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
      }),
      prisma.taxTypeMaster.findMany({
        where: buildMasterWhere(req),
        orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
      }),
      prisma.calcTypeMaster.findMany({
        where: buildMasterWhere(req),
        orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
      }),
      prisma.billingTypeMaster.findMany({
        where: buildMasterWhere(req),
        orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
      }),
      prisma.recipientTypeMaster.findMany({
        where: buildMasterWhere(req),
        orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
      }),
      prisma.constructionTypeMaster.findMany({
        where: buildMasterWhere(req),
        orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
      }),
      prisma.sectionNameMaster.findMany({
        where: buildMasterWhere(req),
        orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
      }),
      prisma.relationshipMaster.findMany({
        where: buildMasterWhere(req),
        orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
      }),
      prisma.contractorMaster.findMany({
        where: buildMasterWhere(req),
        orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
      }),
      prisma.directionMaster.findMany({
        where: buildMasterWhere(req),
        orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
      }),
      prisma.positionMaster.findMany({
        where: buildMasterWhere(req),
        orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
      }),
      prisma.validityPeriodMaster.findMany({
        where: buildMasterWhere(req),
        orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
      }),
      prisma.changeReasonMaster.findMany({
        where: buildMasterWhere(req),
        orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
      }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        cemeteryType: cemeteryType.map((item) => ({
          id: item.id,
          code: item.code,
          name: item.name,
          description: item.description,
          sortOrder: item.sort_order,
          isActive: item.is_active,
        })),
        paymentMethod: paymentMethod.map((item) => ({
          id: item.id,
          code: item.code,
          name: item.name,
          description: item.description,
          sortOrder: item.sort_order,
          isActive: item.is_active,
        })),
        taxType: taxType.map((item) => ({
          id: item.id,
          code: item.code,
          name: item.name,
          description: item.description,
          sortOrder: item.sort_order,
          isActive: item.is_active,
          taxRate: item.tax_rate?.toString() || null,
        })),
        calcType: calcType.map((item) => ({
          id: item.id,
          code: item.code,
          name: item.name,
          description: item.description,
          sortOrder: item.sort_order,
          isActive: item.is_active,
        })),
        billingType: billingType.map((item) => ({
          id: item.id,
          code: item.code,
          name: item.name,
          description: item.description,
          sortOrder: item.sort_order,
          isActive: item.is_active,
        })),
        recipientType: recipientType.map((item) => ({
          id: item.id,
          code: item.code,
          name: item.name,
          description: item.description,
          sortOrder: item.sort_order,
          isActive: item.is_active,
        })),
        constructionType: constructionType.map((item) => ({
          id: item.id,
          code: item.code,
          name: item.name,
          description: item.description,
          sortOrder: item.sort_order,
          isActive: item.is_active,
        })),
        sectionName: sectionName.map((item) => ({
          id: item.id,
          code: item.code,
          name: item.name,
          period: item.period,
          description: item.description,
          sortOrder: item.sort_order,
          isActive: item.is_active,
        })),
        relationship: relationship.map((item) => ({
          id: item.id,
          code: item.code,
          name: item.name,
          description: item.description,
          sortOrder: item.sort_order,
          isActive: item.is_active,
        })),
        contractor: contractor.map((item) => ({
          id: item.id,
          code: item.code,
          name: item.name,
          description: item.description,
          sortOrder: item.sort_order,
          isActive: item.is_active,
        })),
        direction: direction.map((item) => ({
          id: item.id,
          code: item.code,
          name: item.name,
          description: item.description,
          sortOrder: item.sort_order,
          isActive: item.is_active,
        })),
        position: position.map((item) => ({
          id: item.id,
          code: item.code,
          name: item.name,
          description: item.description,
          sortOrder: item.sort_order,
          isActive: item.is_active,
        })),
        validityPeriod: validityPeriod.map((item) => ({
          id: item.id,
          code: item.code,
          name: item.name,
          description: item.description,
          sortOrder: item.sort_order,
          isActive: item.is_active,
        })),
        changeReason: changeReason.map((item) => ({
          id: item.id,
          code: item.code,
          name: item.name,
          description: item.description,
          sortOrder: item.sort_order,
          isActive: item.is_active,
        })),
      },
    });
  } catch (error) {
    getRequestLogger().error({ err: error }, 'Error fetching all masters');
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '全マスタデータの取得に失敗しました',
      },
    });
  }
};
