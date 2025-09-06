# Cemetery CRM API 仕様書

## 概要

Cemetery CRM システムの REST API 仕様書です。この API は墓地管理システムのバックエンドサービスを提供します。

### 基本情報

- **Base URL**: `http://localhost:3001/api/v1`
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
| `NOT_FOUND` | 404 | リソースが見つからない |
| `INTERNAL_ERROR` | 500 | サーバー内部エラー |

## TypeScript 型定義

```typescript
// 基本的な型定義
interface User {
  id: number;
  name: string;
  email: string;
  is_active?: boolean;
}

interface Contract {
  id: number;
  contract_number: string;
  application_date: string;
  contractor_name: string;
  status: string;
  staff: {
    id: number;
    name: string;
  };
}

interface Burial {
  id: number;
  contract_id: number;
  grave_number: string;
  grave_location: string;
  deceased_name: string;
  deceased_name_kana: string;
  death_date: string;
  burial_date: string;
  religious_sect: string;
  notes?: string;
}

interface Construction {
  id: number;
  contractor_name: string;
  start_date: string;
  scheduled_end_date?: string;
  end_date?: string;
  construction_details: string;
  construction_amount: number;
  payment_amount: number;
  construction_type: string;
  notes?: string;
}

interface FamilyContact {
  id: number;
  name: string;
  name_kana: string;
  relationship: string;
  postal_code: string;
  address1: string;
  address2: string;
  phone1: string;
  phone2?: string;
  email?: string;
  notes?: string;
}

interface ContractorHistory {
  id: number;
  contractor_id: number;
  name: string;
  name_kana: string;
  birth_date: string;
  postal_code: string;
  address1: string;
  address2: string;
  phone1: string;
  phone2?: string;
  fax?: string;
  email?: string;
  workplace_name?: string;
  workplace_kana?: string;
  workplace_postal_code?: string;
  workplace_address1?: string;
  workplace_address2?: string;
  workplace_phone1?: string;
  workplace_phone2?: string;
  change_date: string;
  change_reason: string;
}

// マスターデータ型定義
interface Staff {
  id: number;
  name: string;
  email: string;
  is_active: boolean;
}

interface PaymentMethod {
  id: number;
  name: string;
}

interface GraveType {
  id: number;
  code: string;
  name: string;
}

interface ReligiousSect {
  id: number;
  name: string;
}

// ページネーション型定義
interface PaginationInfo {
  current_page: number;
  total_pages: number;
  total_items: number;
  per_page: number;
}

interface PaginatedResponse<T> {
  success: true;
  data: {
    contracts?: T[];
    pagination: PaginationInfo;
  };
}
```

## API エンドポイント

### 1. 認証 (Authentication)

#### 1.1 ログイン

```http
POST /api/v1/auth/login
```

**リクエスト**

```typescript
interface LoginRequest {
  email: string;
  password: string;
}
```

**レスポンス**

```typescript
interface LoginResponse {
  success: true;
  data: {
    token: string;
    user: User;
    message: string;
  };
}
```

**実装例**

```typescript
const login = async (email: string, password: string) => {
  const response = await fetch('/api/v1/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  return await response.json();
};
```

#### 1.2 現在のユーザー情報取得

```http
GET /api/v1/auth/me
```

**認証**: 必要

**レスポンス**

```typescript
interface GetCurrentUserResponse {
  success: true;
  data: {
    user: User;
  };
}
```

### 2. 契約 (Contracts)

#### 2.1 契約一覧取得

```http
GET /api/v1/contracts
```

**認証**: 必要

**クエリパラメータ**

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| `page` | number | No | ページ番号（デフォルト: 1） |
| `limit` | number | No | 取得件数（デフォルト: 20） |
| `search` | string | No | 検索キーワード |
| `status` | string | No | 契約ステータス |
| `staff_id` | string | No | 担当者ID |

**レスポンス**

```typescript
interface GetContractsResponse {
  success: true;
  data: {
    contracts: Contract[];
    pagination: PaginationInfo;
  };
}
```

**実装例**

```typescript
const getContracts = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  staff_id?: string;
}) => {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.search) searchParams.set('search', params.search);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.staff_id) searchParams.set('staff_id', params.staff_id);

  const response = await fetch(`/api/v1/contracts?${searchParams}`, {
    headers: {
      'Authorization': `Bearer ${getToken()}`,
    },
  });
  return await response.json();
};
```

#### 2.2 契約詳細取得

```http
GET /api/v1/contracts/:contract_id
```

**認証**: 必要

#### 2.3 契約作成

```http
POST /api/v1/contracts
```

**認証**: 必要

#### 2.4 契約更新

```http
PUT /api/v1/contracts/:contract_id
```

**認証**: 必要

#### 2.5 契約削除（解約）

```http
DELETE /api/v1/contracts/:contract_id
```

**認証**: 必要

### 3. 埋葬情報 (Burials)

#### 3.1 埋葬情報一覧取得

```http
GET /api/v1/contracts/:contract_id/burials
```

**認証**: 必要

#### 3.2 埋葬情報作成

```http
POST /api/v1/contracts/:contract_id/burials
```

**認証**: 必要

#### 3.3 埋葬情報更新

```http
PUT /api/v1/burials/:burial_id
```

**認証**: 必要

#### 3.4 埋葬情報削除

```http
DELETE /api/v1/burials/:burial_id
```

**認証**: 必要

### 4. 工事情報 (Constructions)

#### 4.1 工事情報一覧取得

```http
GET /api/v1/contracts/:contract_id/constructions
```

**認証**: 必要

**レスポンス**

```typescript
interface GetConstructionsResponse {
  success: true;
  data: Construction[];
}
```

#### 4.2 工事情報作成

```http
POST /api/v1/contracts/:contract_id/constructions
```

**認証**: 必要

**リクエスト**

```typescript
interface CreateConstructionRequest {
  contractor_name: string; // 必須
  construction_type: string; // 必須
  start_date?: string;
  scheduled_end_date?: string;
  end_date?: string;
  construction_details?: string;
  construction_amount?: number;
  payment_amount?: number;
  notes?: string;
}
```

#### 4.3 工事情報更新

```http
PUT /api/v1/constructions/:construction_id
```

**認証**: 必要

#### 4.4 工事情報削除

```http
DELETE /api/v1/constructions/:construction_id
```

**認証**: 必要

### 5. 契約者履歴 (Contractor Histories)

#### 5.1 契約者履歴一覧取得

```http
GET /api/v1/contracts/:contract_id/contractor-histories
```

**認証**: 必要

#### 5.2 契約者履歴作成

```http
POST /api/v1/contracts/:contract_id/contractor-histories
```

**認証**: 必要

**リクエスト**

```typescript
interface CreateContractorHistoryRequest {
  contractor_id: number; // 必須
  name: string; // 必須
  name_kana: string; // 必須
  birth_date: string; // 必須
  postal_code: string; // 必須
  address1: string; // 必須
  address2: string; // 必須
  phone1: string; // 必須
  phone2?: string;
  fax?: string;
  email?: string;
  workplace_name?: string;
  workplace_kana?: string;
  workplace_postal_code?: string;
  workplace_address1?: string;
  workplace_address2?: string;
  workplace_phone1?: string;
  workplace_phone2?: string;
  change_date: string; // 必須
  change_reason?: string;
}
```

### 6. 家族連絡先 (Family Contacts)

#### 6.1 家族連絡先一覧取得

```http
GET /api/v1/contracts/:contract_id/family-contacts
```

**認証**: 必要

#### 6.2 家族連絡先作成

```http
POST /api/v1/contracts/:contract_id/family-contacts
```

**認証**: 必要

#### 6.3 家族連絡先更新

```http
PUT /api/v1/family-contacts/:contact_id
```

**認証**: 必要

#### 6.4 家族連絡先削除

```http
DELETE /api/v1/family-contacts/:contact_id
```

**認証**: 必要

### 7. マスターデータ (Masters)

#### 7.1 スタッフ一覧取得

```http
GET /api/v1/masters/staff
```

**認証**: 必要

**レスポンス**

```typescript
interface GetStaffResponse {
  success: true;
  data: Staff[];
}
```

#### 7.2 支払方法一覧取得

```http
GET /api/v1/masters/payment-methods
```

**認証**: 必要

**レスポンス**

```typescript
interface GetPaymentMethodsResponse {
  success: true;
  data: PaymentMethod[];
}
```

#### 7.3 墓地タイプ一覧取得

```http
GET /api/v1/masters/grave-types
```

**認証**: 必要

**レスポンス**

```typescript
interface GetGraveTypesResponse {
  success: true;
  data: GraveType[];
}
```

#### 7.4 宗派一覧取得

```http
GET /api/v1/masters/religious-sects
```

**認証**: 必要

**レスポンス**

```typescript
interface GetReligiousSectsResponse {
  success: true;
  data: ReligiousSect[];
}
```

### 8. バリデーション (Validations)

#### 8.1 契約番号チェック

```http
GET /api/v1/validations/contract-number
```

**認証**: 必要

**クエリパラメータ**

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| `contract_number` | string | Yes | チェックする契約番号 |

#### 8.2 契約データバリデーション

```http
POST /api/v1/validations/contract
```

**認証**: 必要

## フロントエンド実装のための共通ユーティリティ

### API クライアント基本実装

```typescript
class ApiClient {
  private baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api/v1';
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('cemetery_crm_token', token);
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('cemetery_crm_token');
    }
    return this.token;
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('cemetery_crm_token');
  }

  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<SuccessResponse<T> | ErrorResponse> {
    const url = `${this.baseURL}${endpoint}`;
    const token = this.getToken();

    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'API Error');
      }

      return data;
    } catch (error) {
      console.error('API Request failed:', error);
      throw error;
    }
  }

  async get<T>(endpoint: string): Promise<SuccessResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data: any): Promise<SuccessResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async put<T>(endpoint: string, data: any): Promise<SuccessResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete<T>(endpoint: string): Promise<SuccessResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
```

### React Hook 実装例

```typescript
import { useState, useEffect } from 'react';

export const useContracts = (params?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  staff_id?: string;
}) => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchContracts = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const searchParams = new URLSearchParams();
        if (params?.page) searchParams.set('page', params.page.toString());
        if (params?.limit) searchParams.set('limit', params.limit.toString());
        if (params?.search) searchParams.set('search', params.search);
        if (params?.status) searchParams.set('status', params.status);
        if (params?.staff_id) searchParams.set('staff_id', params.staff_id);

        const response = await apiClient.get<{
          contracts: Contract[];
          pagination: PaginationInfo;
        }>(`/contracts?${searchParams}`);

        setContracts(response.data.contracts);
        setPagination(response.data.pagination);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchContracts();
  }, [params]);

  return { contracts, pagination, loading, error };
};
```

## エラーハンドリング

フロントエンドでの推奨エラーハンドリング方法：

```typescript
const handleApiError = (error: ErrorResponse) => {
  switch (error.error.code) {
    case 'VALIDATION_ERROR':
      // フォームエラーの表示
      if (error.error.details) {
        error.error.details.forEach(detail => {
          console.error(`${detail.field}: ${detail.message}`);
        });
      }
      break;
    case 'UNAUTHORIZED':
      // ログイン画面への遷移
      apiClient.clearToken();
      window.location.href = '/login';
      break;
    case 'NOT_FOUND':
      // 404エラーの表示
      console.error('リソースが見つかりません');
      break;
    case 'INTERNAL_ERROR':
      // サーバーエラーの表示
      console.error('サーバーエラーが発生しました');
      break;
    default:
      console.error('予期しないエラー:', error.error.message);
  }
};
```

## 開発・デバッグ情報

### 開発環境設定

```bash
# バックエンドサーバー起動
npm run dev

# サーバーURL
http://localhost:3001
```

### テストユーザー

開発環境でのテスト用ログイン情報（実装次第で追加）

## 更新履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|----------|
| 2024-09-06 | 1.0.0 | 初版作成 |

---

この仕様書は Cemetery CRM API の完全なドキュメントです。フロントエンド実装時の参考として活用してください。