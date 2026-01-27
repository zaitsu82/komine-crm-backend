import { Request, Response, NextFunction } from 'express';

// 権限レベル定義
export const ROLES = {
  VIEWER: 'viewer',
  OPERATOR: 'operator',
  MANAGER: 'manager',
  ADMIN: 'admin',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

// 権限階層（上位権限は下位権限を含む）
const ROLE_HIERARCHY: Record<Role, Role[]> = {
  [ROLES.VIEWER]: ['viewer'],
  [ROLES.OPERATOR]: ['viewer', 'operator'],
  [ROLES.MANAGER]: ['viewer', 'operator', 'manager'],
  [ROLES.ADMIN]: ['viewer', 'operator', 'manager', 'admin'],
};

// API権限マトリクス
export const API_PERMISSIONS: Record<string, Role[]> = {
  // 認証系
  'GET /auth/me': ['viewer', 'operator', 'manager', 'admin'],
  'GET /auth/permissions': ['viewer', 'operator', 'manager', 'admin'],
  'POST /auth/check-permission': ['viewer', 'operator', 'manager', 'admin'],
  'GET /auth/can/*': ['viewer', 'operator', 'manager', 'admin'],
  'PUT /auth/password': ['viewer', 'operator', 'manager', 'admin'],
  'POST /auth/logout': ['viewer', 'operator', 'manager', 'admin'],

  // 墓石管理
  'GET /gravestones': ['viewer', 'operator', 'manager', 'admin'],
  'GET /gravestones/*': ['viewer', 'operator', 'manager', 'admin'],
  'POST /gravestones': ['operator', 'manager', 'admin'],
  'PUT /gravestones/*': ['operator', 'manager', 'admin'],
  'DELETE /gravestones/*': ['manager', 'admin'],

  // 申込者管理
  'GET /applicants/*': ['viewer', 'operator', 'manager', 'admin'],
  'POST /applicants': ['operator', 'manager', 'admin'],
  'PUT /applicants/*': ['operator', 'manager', 'admin'],
  'DELETE /applicants/*': ['manager', 'admin'],

  // 契約者管理
  'GET /contractors/*': ['viewer', 'operator', 'manager', 'admin'],
  'POST /contractors': ['operator', 'manager', 'admin'],
  'PUT /contractors/*': ['operator', 'manager', 'admin'],
  'DELETE /contractors/*': ['manager', 'admin'],
  'POST /contractors/*/transfer': ['manager', 'admin'],

  // 使用料・管理料
  'POST /usage-fees': ['operator', 'manager', 'admin'],
  'PUT /usage-fees/*': ['operator', 'manager', 'admin'],
  'DELETE /usage-fees/*': ['manager', 'admin'],
  'POST /management-fees': ['operator', 'manager', 'admin'],
  'PUT /management-fees/*': ['operator', 'manager', 'admin'],
  'DELETE /management-fees/*': ['manager', 'admin'],
  'POST /management-fees/calculate': ['operator', 'manager', 'admin'],

  // 請求情報
  'POST /billing-infos': ['operator', 'manager', 'admin'],
  'PUT /billing-infos/*': ['operator', 'manager', 'admin'],
  'DELETE /billing-infos/*': ['manager', 'admin'],
  'POST /billing-infos/generate': ['manager', 'admin'],

  // 家族連絡先
  'POST /family-contacts': ['operator', 'manager', 'admin'],
  'PUT /family-contacts/*': ['operator', 'manager', 'admin'],
  'DELETE /family-contacts/*': ['operator', 'manager', 'admin'],

  // 埋葬者情報
  'GET /burials/search': ['viewer', 'operator', 'manager', 'admin'],
  'POST /burials': ['operator', 'manager', 'admin'],
  'PUT /burials/*': ['operator', 'manager', 'admin'],
  'DELETE /burials/*': ['manager', 'admin'],

  // 工事情報
  'POST /constructions': ['operator', 'manager', 'admin'],
  'PUT /constructions/*': ['operator', 'manager', 'admin'],
  'DELETE /constructions/*': ['manager', 'admin'],

  // 履歴情報
  'GET /histories': ['viewer', 'operator', 'manager', 'admin'],
  'GET /histories/*': ['viewer', 'operator', 'manager', 'admin'],
  'POST /histories/*/restore': ['admin'],

  // マスタデータ管理
  'GET /masters/*': ['viewer', 'operator', 'manager', 'admin'],
  'POST /masters/*': ['admin'],
  'PUT /masters/*': ['admin'],
  'DELETE /masters/*': ['admin'],

  // ユーザー・ロール管理
  'GET /users': ['manager', 'admin'],
  'GET /users/*': ['manager', 'admin'],
  'PUT /users/*/role': ['admin'],
  'GET /roles': ['manager', 'admin'],
  'POST /roles': ['admin'],
  'PUT /roles/*': ['admin'],
  'DELETE /roles/*': ['admin'],
  'GET /permissions/matrix': ['admin'],
  'PUT /permissions/matrix': ['admin'],

  // バッチ処理・その他
  'POST /import': ['admin'],
  'GET /export': ['manager', 'admin'],
  'POST /reports': ['manager', 'admin'],
};

/**
 * 特定の権限レベルが必要な操作をチェック
 */
export const requirePermission = (requiredRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction): any => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '認証が必要です',
          details: [],
        },
      });
    }

    const userRole = req.user.role as Role;
    const userPermissions = ROLE_HIERARCHY[userRole] || [];

    // ユーザーの権限が要求された権限のいずれかと一致するかチェック
    const hasPermission = requiredRoles.some((role) => userPermissions.includes(role));

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '権限が不足しています',
          details: [
            {
              message: `必要な権限: ${requiredRoles.join(', ')}、現在の権限: ${userRole}`,
            },
          ],
        },
      });
    }

    next();
  };
};

/**
 * API パスに基づいて自動で権限チェック
 */
export const checkApiPermission = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '認証が必要です',
          details: [],
        },
      });
    }

    const method = req.method;
    const path = req.route?.path || req.path;
    const apiKey = `${method} ${path}`;

    // パスパラメータをワイルドカードに変換
    const normalizedApiKey = apiKey.replace(/\/:\w+/g, '/*');

    const requiredRoles = API_PERMISSIONS[normalizedApiKey];

    if (!requiredRoles) {
      // 権限定義がない場合はadminのみ許可
      return requirePermission([ROLES.ADMIN])(req, res, next);
    }

    return requirePermission(requiredRoles)(req, res, next);
  };
};

/**
 * 権限チェック用ヘルパー関数
 */
export const hasPermission = (userRole: Role, requiredRoles: Role[]): boolean => {
  const userPermissions = ROLE_HIERARCHY[userRole] || [];
  return requiredRoles.some((role) => userPermissions.includes(role));
};

/**
 * ユーザーが特定のリソース・アクションに対する権限を持つかチェック
 */
export const checkResourceAction = (userRole: Role, resource: string, action: string): boolean => {
  // リソース・アクション組み合わせの権限マトリクス
  const resourceActionPermissions: Record<string, Role[]> = {
    'gravestone:read': ['viewer', 'operator', 'manager', 'admin'],
    'gravestone:create': ['operator', 'manager', 'admin'],
    'gravestone:update': ['operator', 'manager', 'admin'],
    'gravestone:delete': ['manager', 'admin'],

    'contractor:read': ['viewer', 'operator', 'manager', 'admin'],
    'contractor:create': ['operator', 'manager', 'admin'],
    'contractor:update': ['operator', 'manager', 'admin'],
    'contractor:delete': ['manager', 'admin'],
    'contractor:transfer': ['manager', 'admin'],

    'master:read': ['viewer', 'operator', 'manager', 'admin'],
    'master:create': ['admin'],
    'master:update': ['admin'],
    'master:delete': ['admin'],

    'user:read': ['manager', 'admin'],
    'user:manage': ['admin'],

    'staff:read': ['manager', 'admin'],
    'staff:create': ['admin'],
    'staff:update': ['admin'],
    'staff:delete': ['admin'],

    'collective-burial:read': ['manager', 'admin'],
    'collective-burial:create': ['admin'],
    'collective-burial:update': ['admin'],
    'collective-burial:delete': ['admin'],
    'collective-burial:billing': ['manager', 'admin'],

    'system:admin': ['admin'],
  };

  const key = `${resource}:${action}`;
  const requiredRoles = resourceActionPermissions[key];

  if (!requiredRoles) {
    // 定義がない場合はadminのみ許可
    return userRole === ROLES.ADMIN;
  }

  return hasPermission(userRole, requiredRoles);
};
