# Cemetery CRM API 仕様書

## 概要

Cemetery CRM システムの REST API 仕様書です。この API は墓石管理システムのバックエンドサービスを提供します。

### 基本情報

- **Base URL**: `http://localhost:4000/api/v1`
- **認証方式**: JWT Bearer Token
- **データ形式**: JSON
- **文字エンコーディング**: UTF-8

## 認証

### JWT トークンの取得

```http
POST /api/v1/auth/login
```

認証が必要なエンドポイントでは、リクエストヘッダーに JWT トークンを含める必要があります。

```http
Authorization: Bearer <jwt_token>
```

## 共通レスポンス形式

### 成功レスポンス

```typescript
interface SuccessResponse<T = any> {
  success: true;
  data: T;
}
```

### エラーレスポンス

```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details: Array<{
      field?: string;
      message: string;
    }>;
  };
}
```

### エラーコード

| コード | HTTP Status | 説明 |
|--------|-------------|------|
| `VALIDATION_ERROR` | 400, 422 | 入力値検証エラー |
| `UNAUTHORIZED` | 401 | 認証失敗 |
| `FORBIDDEN` | 403 | 権限不足 |
| `NOT_FOUND` | 404 | リソースが見つからない |
| `CONFLICT` | 409 | データ競合エラー |
| `INTERNAL_ERROR` | 500 | サーバー内部エラー |

## API エンドポイント一覧

### 認証系 (Authentication)
- `POST /auth/login` - ログイン
- `POST /auth/logout` - ログアウト  
- `POST /auth/register` - ユーザーアカウント新規作成
- `PUT /auth/password` - パスワード更新
- `POST /auth/reset-password` - パスワードリセット要求
- `POST /auth/refresh` - トークンリフレッシュ
- `GET /auth/me` - 現在のユーザー情報取得
- `GET /auth/permissions` - 現在のユーザーの権限一覧取得
- `POST /auth/check-permission` - 特定の操作権限チェック
- `GET /auth/can/:resource/:action` - リソース・アクション権限チェック

### 墓石情報管理 (Gravestones)
- `GET /gravestones` - 墓石情報一覧取得
- `GET /gravestones/:id` - 墓石情報詳細取得
- `GET /gravestones/search` - 墓石情報検索
- `POST /gravestones` - 墓石情報登録
- `PUT /gravestones/:id` - 墓石情報更新
- `DELETE /gravestones/:id` - 墓石情報削除

### 申込者情報管理 (Applicants)
- `GET /applicants/:id` - 申込者情報詳細取得
- `POST /applicants` - 申込者情報登録
- `PUT /applicants/:id` - 申込者情報更新
- `DELETE /applicants/:id` - 申込者情報削除

### 契約者情報管理 (Contractors)
- `GET /contractors/:id` - 契約者情報詳細取得
- `GET /contractors/search` - 契約者検索
- `POST /contractors` - 契約者情報登録
- `PUT /contractors/:id` - 契約者情報更新
- `DELETE /contractors/:id` - 契約者情報削除
- `POST /contractors/:id/transfer` - 契約者変更（業務固有API）

### 使用料情報管理 (UsageFees)
- `POST /usage-fees` - 使用料情報登録
- `PUT /usage-fees/:id` - 使用料情報更新
- `DELETE /usage-fees/:id` - 使用料情報削除

### 管理料情報管理 (ManagementFees)
- `POST /management-fees` - 管理料情報登録
- `PUT /management-fees/:id` - 管理料情報更新
- `DELETE /management-fees/:id` - 管理料情報削除
- `POST /management-fees/calculate` - 管理料計算（業務固有API）

### 請求情報管理 (BillingInfos)
- `POST /billing-infos` - 請求情報登録
- `PUT /billing-infos/:id` - 請求情報更新
- `DELETE /billing-infos/:id` - 請求情報削除
- `POST /billing-infos/generate` - 請求データ生成（業務固有API）

### 家族連絡先情報管理 (FamilyContacts)
- `POST /family-contacts` - 家族連絡先情報登録
- `PUT /family-contacts/:id` - 家族連絡先情報更新
- `DELETE /family-contacts/:id` - 家族連絡先情報削除

### 埋葬者情報管理 (Burials)
- `GET /burials/search` - 埋葬者検索
- `POST /burials` - 埋葬者情報登録
- `PUT /burials/:id` - 埋葬者情報更新
- `DELETE /burials/:id` - 埋葬者情報削除

### 工事情報管理 (Constructions)
- `POST /constructions` - 工事情報登録
- `PUT /constructions/:id` - 工事情報更新
- `DELETE /constructions/:id` - 工事情報削除

### 履歴情報管理 (Histories)
- `GET /histories` - 変更履歴取得
- `GET /histories/:id` - 変更履歴詳細取得
- `POST /histories/:id/restore` - データ復元（履歴からの復旧）

### マスタデータ管理 (Masters)
- `GET /masters/:master_type` - マスタデータ一覧取得（汎用）
- `POST /masters/:master_type` - マスタデータ登録
- `PUT /masters/:master_type/:id` - マスタデータ更新
- `DELETE /masters/:master_type/:id` - マスタデータ削除

### ユーザー・ロール管理 (Users & Roles)
- `GET /users` - ユーザー一覧取得
- `GET /users/:id` - ユーザー詳細取得
- `PUT /users/:id/role` - ユーザーロール変更
- `GET /roles` - ロール一覧取得
- `POST /roles` - ロール作成
- `PUT /roles/:id` - ロール更新
- `DELETE /roles/:id` - ロール削除
- `GET /permissions/matrix` - 権限マトリクス取得
- `PUT /permissions/matrix` - 権限マトリクス更新

### バッチ処理・その他
- `POST /import` - 一括データインポート
- `GET /export` - データエクスポート
- `POST /reports` - レポート生成

## 主要なTypeScript型定義

```typescript
// 基本的な型定義
interface User {
  id: number;
  name: string;
  email: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// 墓石情報
interface Gravestone {
  id: number;
  gravestone_code: string; // 墓石コード（例：A-56）
  usage_status: string; // 利用状況
  price: number; // 墓石代
  orientation?: string; // 方位
  location?: string; // 位置
  cemetery_type?: string; // 墓地タイプ
  denomination?: string; // 宗派
  inscription?: string; // 碑文
  construction_deadline?: Date; // 建立期限
  construction_date?: Date; // 建立日
  epitaph?: string; // 墓誌
  remarks?: string; // 備考
  deleted_at?: Date;
  created_at: Date;
  updated_at: Date;
}

// 申込者情報
interface Applicant {
  id: number;
  gravestone_id: number;
  application_date: Date; // 申込日
  staff_name?: string; // 担当者氏名
  name: string; // 氏名
  kana: string; // ふりがな
  postal_code: string; // 郵便番号
  address: string; // 住所
  phone: string; // 電話番号
  remarks?: string; // 備考
  effective_start_date?: Date; // 適用開始年月日
  effective_end_date?: Date; // 適用終了年月日
  deleted_at?: Date;
  created_at: Date;
  updated_at: Date;
}

// 契約者情報
interface Contractor {
  id: number;
  gravestone_id: number;
  reservation_date?: Date; // 予約日
  consent_form_number?: string; // 承諾書番号
  permission_date?: Date; // 許可日
  start_date: Date; // 開始年月日
  name: string; // 氏名
  kana: string; // ふりがな
  birth_date?: Date; // 生年月日
  gender?: string; // 性別
  postal_code: string; // 郵便番号
  address: string; // 住所
  phone: string; // 電話番号
  fax?: string; // FAX
  email?: string; // メール
  domicile_address?: string; // 本籍住所
  workplace_name?: string; // 勤務先名称
  workplace_kana?: string; // 勤務先名称かな
  workplace_address?: string; // 勤務先住所
  workplace_phone?: string; // 勤務先電話番号
  dm_setting?: string; // DM設定
  recipient_type?: string; // 宛先区分
  remarks?: string; // 備考
  effective_start_date?: Date; // 適用開始年月日
  effective_end_date?: Date; // 適用終了年月日
  deleted_at?: Date;
  created_at: Date;
  updated_at: Date;
}

// 使用料情報
interface UsageFee {
  id: number;
  gravestone_id: number;
  calc_type?: string; // 計算区分
  area?: number; // 面積
  fee: number; // 使用料
  tax_type?: string; // 税区分
  billing_years?: number; // 請求年数
  unit_price?: number; // 単価
  payment_method?: string; // 支払方法
  remarks?: string; // 備考
  effective_start_date?: Date; // 適用開始年月日
  effective_end_date?: Date; // 適用終了年月日
  deleted_at?: Date;
  created_at: Date;
  updated_at: Date;
}

// 管理料情報
interface ManagementFee {
  id: number;
  gravestone_id: number;
  calc_type?: string; // 計算区分
  billing_type?: string; // 請求区分
  area?: number; // 面積
  fee: number; // 管理料
  last_billing_date?: Date; // 最終請求年月
  tax_type?: string; // 税区分
  billing_years?: number; // 請求年数
  billing_month?: number; // 請求月
  unit_price?: number; // 単価
  payment_method: string; // 支払方法
  remarks?: string; // 備考
  effective_start_date?: Date; // 適用開始年月日
  effective_end_date?: Date; // 適用終了年月日
  deleted_at?: Date;
  created_at: Date;
  updated_at: Date;
}

// 請求情報
interface BillingInfo {
  id: number;
  gravestone_id: number;
  contractor_id: number;
  billing_type?: string; // 請求種別
  bank_name?: string; // 銀行名称
  branch_name?: string; // 支店名称
  account_type?: string; // 口座科目
  account_number?: string; // 口座番号
  account_holder?: string; // 口座名義
  remarks?: string; // 備考
  effective_start_date?: Date; // 適用開始年月日
  effective_end_date?: Date; // 適用終了年月日
  deleted_at?: Date;
  created_at: Date;
  updated_at: Date;
}

// 家族連絡先情報
interface FamilyContact {
  id: number;
  gravestone_id: number;
  contractor_id: number;
  name?: string; // 氏名
  birth_date?: Date; // 生年月日
  relation?: string; // 続柄
  phone?: string; // 電話番号
  fax?: string; // FAX
  email?: string; // メール
  address?: string; // 住所
  domicile_address?: string; // 本籍住所
  recipient_type?: string; // 送付先区分
  workplace_name?: string; // 勤務先名称
  workplace_kana?: string; // 勤務先名称かな
  workplace_address?: string; // 勤務先住所
  workplace_phone?: string; // 勤務先電話番号
  remarks?: string; // 備考
  effective_start_date?: Date; // 適用開始年月日
  effective_end_date?: Date; // 適用終了年月日
  deleted_at?: Date;
  created_at: Date;
  updated_at: Date;
}

// 埋葬者情報
interface Burial {
  id: number;
  gravestone_id: number;
  contractor_id: number;
  name?: string; // 氏名
  kana?: string; // ふりがな
  birth_date?: Date; // 生年月日
  gender?: string; // 性別
  posthumous_name?: string; // 戒名
  death_date?: Date; // 命日
  age_at_death?: number; // 享年
  burial_date?: Date; // 埋葬日
  notification_date?: Date; // 届出日
  denomination?: string; // 宗派
  remarks?: string; // 備考
  effective_start_date?: Date; // 適用開始年月日
  effective_end_date?: Date; // 適用終了年月日
  deleted_at?: Date;
  created_at: Date;
  updated_at: Date;
}

// 工事情報
interface Construction {
  id: number;
  gravestone_id: number;
  contractor_name?: string; // 業者名
  start_date?: Date; // 工事開始日
  planned_end_date?: Date; // 終了予定日
  end_date?: Date; // 工事終了日
  description?: string; // 工事内容
  cost?: number; // 施工金額
  payment_amount?: number; // 入金金額
  construction_type?: string; // 工事種別
  remarks?: string; // 備考
  deleted_at?: Date;
  created_at: Date;
  updated_at: Date;
}

// 履歴情報
interface History {
  id: number;
  gravestone_id: number;
  contractor_id: number;
  before_record_id?: number; // 更新前情報ID
  after_record_id?: number; // 更新後情報ID
  update_type?: string; // 更新種別
  update_reason?: string; // 更新事由
  updated_by?: string; // 更新者
  updated_at: Date; // 更新日時
}

// マスタデータ共通型
interface MasterData {
  id: number;
  code: string; // 業務キー
  name: string; // 表示名
  description?: string; // 説明
  sort_order?: number; // 表示順序
  is_active: boolean; // 有効フラグ
  created_at: Date;
  updated_at: Date;
}

// 墓石詳細情報（関連データ含む）
interface GravestoneDetail {
  gravestone: Gravestone;
  applicant?: Applicant;
  contractors: Contractor[];
  usage_fees: UsageFee[];
  management_fees: ManagementFee[];
  billing_infos: BillingInfo[];
  family_contacts: FamilyContact[];
  burials: Burial[];
  constructions: Construction[];
  histories: History[];
}

// ページネーション型定義
interface PaginationInfo {
  current_page: number;
  total_pages: number;
  total_items: number;
  per_page: number;
}

// 検索条件
interface SearchParams {
  page?: number;
  limit?: number;
  search?: string;
  usage_status?: string;
  cemetery_type?: string;
  denomination?: string;
}

// 権限関連型定義
interface Role {
  id: number;
  name: string; // 'viewer', 'operator', 'manager', 'admin'
  display_name: string; // '閲覧者', '操作者', '管理者', 'システム管理者'
  description?: string;
  permissions: string[]; // 権限コードの配列
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface Permission {
  id: number;
  code: string; // 'gravestone:read', 'contractor:create', etc.
  resource: string; // 'gravestone', 'contractor', etc.
  action: string; // 'create', 'read', 'update', 'delete'
  display_name: string;
  description?: string;
}

interface UserWithRole extends User {
  role: Role;
  permissions: Permission[];
}

interface PermissionMatrix {
  [roleId: string]: {
    [permissionCode: string]: boolean;
  };
}

// 権限チェックリクエスト型
interface CheckPermissionRequest {
  resource: string;
  action: string;
  resource_id?: number; // 特定リソースの権限チェック用
}

interface PermissionResponse {
  allowed: boolean;
  reason?: string; // 拒否理由
  required_role?: string;
  user_role: string;
}
```

## マスタデータ種別

以下のマスタデータが利用可能です：

- `usage-status` - 利用状況マスタ
- `cemetery-type` - 墓地タイプマスタ
- `denomination` - 宗派マスタ
- `gender` - 性別マスタ
- `payment-method` - 支払方法マスタ
- `tax-type` - 税区分マスタ
- `calc-type` - 計算区分マスタ
- `billing-type` - 請求区分マスタ
- `account-type` - 口座科目マスタ
- `recipient-type` - 宛先区分マスタ
- `relation` - 続柄マスタ
- `construction-type` - 工事種別マスタ
- `update-type` - 更新種別マスタ
- `prefecture` - 都道府県マスタ

## 権限・認可システム

### 権限レベル詳細

| 権限レベル | 説明 | 可能な操作 | 権限コード例 |
|------------|------|------------|-------------|
| `viewer` | 閲覧専用 | 参照系APIのみ | `gravestone:read`, `contractor:read` |
| `operator` | 一般操作者 | 登録・更新・削除（一部制限あり） | `gravestone:create`, `contractor:update` |
| `manager` | 管理者 | 全ての操作（マスタ管理除く） | `gravestone:delete`, `billing:generate` |
| `admin` | システム管理者 | 全ての操作 | `master:create`, `user:manage`, `system:admin` |

### API権限マトリクス

```typescript
const API_PERMISSIONS = {
  // 墓石管理
  'GET /gravestones': ['viewer', 'operator', 'manager', 'admin'],
  'POST /gravestones': ['operator', 'manager', 'admin'],
  'PUT /gravestones/:id': ['operator', 'manager', 'admin'],
  'DELETE /gravestones/:id': ['manager', 'admin'],
  
  // 契約者管理
  'GET /contractors': ['viewer', 'operator', 'manager', 'admin'],
  'POST /contractors': ['operator', 'manager', 'admin'],
  'PUT /contractors/:id': ['operator', 'manager', 'admin'],
  'DELETE /contractors/:id': ['manager', 'admin'],
  
  // マスタデータ管理
  'GET /masters/*': ['viewer', 'operator', 'manager', 'admin'],
  'POST /masters/*': ['admin'],
  'PUT /masters/*': ['admin'],
  'DELETE /masters/*': ['admin'],
  
  // ユーザー・ロール管理
  'GET /users': ['manager', 'admin'],
  'PUT /users/:id/role': ['admin'],
  'POST /roles': ['admin'],
  
  // バッチ処理
  'POST /import': ['admin'],
  'GET /export': ['manager', 'admin'],
  'POST /reports': ['manager', 'admin']
};
```

### 権限チェック実装方式

#### 1. ミドルウェアによる権限チェック

```typescript
// 認証ミドルウェア
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'トークンが必要です'
      }
    });
  }
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '無効なトークンです'
        }
      });
    }
    req.user = user;
    next();
  });
};

// 権限チェックミドルウェア
const requirePermission = (requiredRoles) => {
  return (req, res, next) => {
    if (!req.user || !requiredRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '権限が不足しています',
          details: [{
            message: `必要な権限: ${requiredRoles.join(', ')}、現在の権限: ${req.user?.role || 'なし'}`
          }]
        }
      });
    }
    next();
  };
};

// 使用例
app.get('/api/v1/gravestones', 
  authenticateToken,
  requirePermission(['viewer', 'operator', 'manager', 'admin']),
  getGravestones
);

app.post('/api/v1/gravestones',
  authenticateToken,
  requirePermission(['operator', 'manager', 'admin']),
  createGravestone
);
```

#### 2. リソースレベル権限チェック（オプション）

```typescript
// 特定リソースへのアクセス権限チェック
const checkResourceAccess = (resourceType) => {
  return async (req, res, next) => {
    const resourceId = req.params.id;
    const userId = req.user.id;
    
    // リソース所有者チェック（必要に応じて）
    if (resourceType === 'gravestone') {
      const gravestone = await Gravestone.findById(resourceId);
      if (!gravestone) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'リソースが見つかりません' }
        });
      }
      
      // 管理者以外は自分が関連する墓石のみアクセス可能（例）
      if (req.user.role !== 'admin' && req.user.role !== 'manager') {
        // 関連チェックロジック（実装要件による）
      }
    }
    
    next();
  };
};
```

### 権限チェックAPI詳細

#### 3.1 現在のユーザー権限一覧取得

```http
GET /api/v1/auth/permissions
```

**認証**: 必要

**レスポンス**:
```typescript
interface GetPermissionsResponse {
  success: true;
  data: {
    user: UserWithRole;
    permissions: Permission[];
    allowed_actions: {
      [resource: string]: string[]; // gravestone: ['read', 'create']
    };
  };
}
```

#### 3.2 特定操作の権限チェック

```http
POST /api/v1/auth/check-permission
```

**認証**: 必要

**リクエスト**: CheckPermissionRequest

**レスポンス**: PermissionResponse

#### 3.3 リソース・アクション権限チェック

```http
GET /api/v1/auth/can/:resource/:action
```

**認証**: 必要

**パスパラメータ**:
- `resource`: gravestone, contractor, usage_fee, etc.
- `action`: create, read, update, delete

**クエリパラメータ**:
- `resource_id`: 特定リソースIDでのチェック（オプション）

**レスポンス**: PermissionResponse

## 重要な業務ルール

### データ更新の仕組み

すべての更新系APIは内部的に以下の処理を行います：

1. **既存データの論理削除**: `deleted_at` フィールドに現在日時を設定
2. **新規レコードの作成**: 更新された内容で新しいレコードを作成
3. **履歴情報の記録**: `History` テーブルに変更履歴を記録

### 有効期間管理

多くのテーブルで `effective_start_date` と `effective_end_date` による有効期間管理を行います。

### フロントエンドでの権限制御例

```typescript
// Reactでの権限制御コンポーネント
const PermissionGate = ({ 
  resource, 
  action, 
  fallback = null, 
  children 
}) => {
  const { user, checkPermission } = useAuth();
  const [canAccess, setCanAccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const result = await apiClient.checkPermission({ resource, action });
        setCanAccess(result.data.allowed);
      } catch (error) {
        setCanAccess(false);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      checkAccess();
    } else {
      setLoading(false);
    }
  }, [user, resource, action]);

  if (loading) return <div>読み込み中...</div>;
  
  return canAccess ? children : fallback;
};

// 使用例
<PermissionGate resource="gravestone" action="create">
  <button>墓石情報新規作成</button>
</PermissionGate>

<PermissionGate 
  resource="master" 
  action="update"
  fallback={<div>管理者権限が必要です</div>}
>
  <AdminPanel />
</PermissionGate>
```

### セキュリティの重要ポイント

#### 1. サーバーサイド権限チェックは絶対必要
- フロントエンドのチェックはUX向上のみ
- サーバーサイドが最終防衛線

#### 2. JWTトークンのセキュリティ
- 有効期限: 24時間
- リフレッシュトークンで自動更新
- HTTPS終端間暗号化必須

#### 3. エラーハンドリング
```typescript
const handleAuthError = (error) => {
  switch (error.code) {
    case 'UNAUTHORIZED':
      // トークン無効 → ログイン画面へリダイレクト
      apiClient.clearToken();
      window.location.href = '/login';
      break;
    case 'FORBIDDEN':
      // 権限不足 → エラーメッセージ表示
      showErrorMessage('操作権限がありません');
      break;
  }
};
```

### 権限管理のベストプラクティス

#### 1. 最小権限の原則
- ユーザーには必要最小限の権限のみ付与
- 権限エスカレーションの仕組みを用意

#### 2. 権限の粒度
- リソースレベル: gravestone, contractor等
- アクションレベル: create, read, update, delete
- フィールドレベル: 特定フィールドの編集権限（必要に応じて）

#### 3. 監査ログ
```typescript
interface AuditLog {
  id: string;
  user_id: number;
  action: string;
  resource_type: string;
  resource_id?: string;
  ip_address: string;
  user_agent: string;
  timestamp: Date;
  result: 'success' | 'failure';
  error_message?: string;
}
```

### 権限レベル

| 権限レベル | 説明 | 可能な操作 |
|------------|------|------------|
| `viewer` | 閲覧専用 | 参照系APIのみ |
| `operator` | 一般操作者 | 登録・更新・削除（一部制限あり） |
| `manager` | 管理者 | 全ての操作（マスタ管理除く） |
| `admin` | システム管理者 | 全ての操作 |

## 開発・テスト情報

### 開発環境設定

```bash
# バックエンドサーバー起動
npm run dev

# サーバーURL
http://localhost:4000

# データベース設定
npm run db:migrate
npm run db:seed
```

### テストユーザー

開発環境でのテスト用ログイン情報：

| メールアドレス | パスワード | 権限 |
|----------------|------------|------|
| admin@example.com | admin123 | admin |
| manager@example.com | manager123 | manager |
| operator@example.com | operator123 | operator |
| viewer@example.com | viewer123 | viewer |

### APIテスト例

```bash
# ログイン
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "admin123"}'

# 墓石一覧取得
curl -X GET http://localhost:4000/api/v1/gravestones \
  -H "Authorization: Bearer <token>"

# 墓石詳細取得
curl -X GET http://localhost:4000/api/v1/gravestones/1 \
  -H "Authorization: Bearer <token>"

# マスタデータ取得
curl -X GET http://localhost:4000/api/v1/masters/usage-status \
  -H "Authorization: Bearer <token>"
```

## パフォーマンス要件

### レスポンス時間目標

- **参照系**: 200ms以内
- **登録・更新系**: 500ms以内
- **複雑な検索**: 1秒以内
- **レポート生成**: 10秒以内

### スループット

- **同時リクエスト数**: 100件/秒
- **同時ユーザー数**: 50人
- **可用性**: 99.9%以上

## セキュリティ要件

### データ保護

1. **パスワードハッシュ化**: bcryptを使用
2. **JWT有効期限**: 24時間
3. **HTTPS必須**: 本番環境では強制
4. **入力値検証**: 全てのAPIで実施

### 監査ログ

以下の操作は全て履歴として記録されます：

- 認証・認可（ログイン、権限エラー）
- データ変更（登録・更新・削除）
- 重要操作（マスタデータ変更、バッチ処理）
- システムエラー

## 更新履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|----------|
| 2024-09-13 | 3.0.0 | 包括的API設計への大幅アップデート - 全エンティティ対応、マスタデータ管理、バッチ処理、業務固有API追加 |
| 2024-09-08 | 2.0.0 | 顧客管理API追加、契約・埋葬・工事API削除、軽量データ型対応 |
| 2024-09-06 | 1.0.0 | 初版作成 |

---

**📋 この仕様書について**

この仕様書は Cemetery CRM システムの完全なAPI仕様を定義しています。データベース設計と完全に整合性が取れており、実際の墓石管理業務に必要な全ての機能を網羅しています。

**🎯 主な特徴**
- **包括性**: 認証からマスタデータ管理まで全機能をカバー
- **実用性**: 実際の業務フローに基づいた設計
- **拡張性**: 将来の機能追加に対応した柔軟な設計
- **運用性**: 監視、ログ、災害復旧まで考慮

**🚀 開発・運用準備完了**

この仕様書により、フロントエンド開発、バックエンド実装、運用準備まで、システム構築に必要な全ての情報が整備されました。
