# 霊園管理システム API設計書

## 1. システム概要
霊園管理システムの各画面で必要なAPI仕様を定義。
RESTful APIの設計原則に従い、適切なHTTPメソッドとステータスコードを使用。

## 2. 共通仕様

### 2.1 ベースURL
```
https://api.cemetery-system.com/v1
```

### 2.2 認証
```
Authorization: Bearer <JWT_TOKEN>
```

### 2.3 共通レスポンス形式
#### 成功レスポンス
```json
{
  "success": true,
  "data": {},
  "message": "操作が正常に完了しました"
}
```

#### エラーレスポンス
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "エラーメッセージ",
    "details": []
  }
}
```

### 2.4 共通エラーコード
- `VALIDATION_ERROR`: 入力値検証エラー
- `NOT_FOUND`: リソースが見つからない
- `UNAUTHORIZED`: 認証エラー
- `FORBIDDEN`: 権限エラー
- `INTERNAL_ERROR`: サーバー内部エラー

## 3. API一覧

### 3.1 認証API

#### 3.1.1 ログイン
```
POST /auth/login
```

**リクエスト**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**レスポンス（成功）**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "name": "田中 太郎",
      "email": "tanaka@example.com"
    },
    "message": "ログインが正常に完了しました"
  }
}
```

**レスポンス（認証失敗）**
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "メールアドレスまたはパスワードが正しくありません",
    "details": []
  }
}
```

**バリデーションエラー**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "メールアドレスとパスワードは必須です",
    "details": [
      {
        "field": "email",
        "message": "メールアドレスは必須です"
      },
      {
        "field": "password", 
        "message": "パスワードは必須です"
      }
    ]
  }
}
```

#### 3.1.2 現在ユーザー情報取得
```
GET /auth/me
Authorization: Bearer <JWT_TOKEN>
```

**レスポンス**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "name": "田中 太郎",
      "email": "tanaka@example.com",
      "is_active": true
    }
  }
}
```

### 3.2 マスターデータ取得API

#### 3.2.1 担当者一覧取得
```
GET /masters/staff
```

**レスポンス**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "田中 太郎",
      "email": "tanaka@example.com",
      "is_active": true
    }
  ]
}
```

#### 3.2.2 支払方法一覧取得
```
GET /masters/payment-methods
```

**レスポンス**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "振込"
    },
    {
      "id": 2,
      "name": "口座振替"
    }
  ]
}
```

#### 3.2.3 墓地タイプ一覧取得
```
GET /masters/grave-types
```

**レスポンス**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "code": "J3",
      "name": "一般墓地J3"
    }
  ]
}
```

#### 3.2.4 宗派一覧取得
```
GET /masters/religious-sects
```

**レスポンス**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "なし"
    },
    {
      "id": 2,
      "name": "浄土宗"
    }
  ]
}
```

### 3.3 契約管理API

#### 3.3.1 契約一覧取得
```
GET /contracts?page=1&limit=20&search=田中&status=active
```

**クエリパラメータ**
- `page`: ページ番号（デフォルト: 1）
- `limit`: 取得件数（デフォルト: 20）
- `search`: 検索キーワード（契約者名、承諾書番号等）
- `status`: 契約状態（active, terminated, suspended）
- `staff_id`: 担当者ID

**レスポンス**
```json
{
  "success": true,
  "data": {
    "contracts": [
      {
        "id": 1,
        "contract_number": "1234",
        "application_date": "2004-05-01",
        "contractor_name": "田中 太郎",
        "status": "active",
        "staff": {
          "id": 1,
          "name": "担当者名"
        }
      }
    ],
    "pagination": {
      "current_page": 1,
      "total_pages": 10,
      "total_items": 200,
      "per_page": 20
    }
  }
}
```

#### 3.3.2 契約詳細取得
```
GET /contracts/{contract_id}
```

**レスポンス**
```json
{
  "success": true,
  "data": {
    "contract": {
      "id": 1,
      "contract_number": "1234",
      "application_date": "2004-05-01",
      "reservation_date": "2004-04-15",
      "permission_date": "2004-05-01",
      "start_date": "2004-05-01",
      "staff_id": 1,
      "status": "active"
    },
    "applicant": {
      "name": "田中 太郎",
      "name_kana": "たなか たろう",
      "postal_code": "123-4567",
      "address1": "福岡県福岡市博多区住吉",
      "address2": "1-20-15",
      "phone1": "012-345-6789",
      "phone2": null
    },
    "contractor": {
      "id": 1,
      "name": "田中 太郎",
      "name_kana": "たなか たろう",
      "birth_date": "1958-05-10",
      "gender": "male",
      "postal_code": "123-4567",
      "address1": "福岡県福岡市博多区住吉",
      "address2": "1-20-15",
      "phone1": "012-345-6789",
      "phone2": null,
      "fax": null,
      "email": null,
      "permanent_address1": "神奈川県相模原市相生",
      "permanent_address2": "1-1-1",
      "is_current": true
    },
    "contractor_detail": {
      "workplace_name": null,
      "workplace_kana": null,
      "workplace_address": null,
      "workplace_phone1": null,
      "workplace_phone2": null,
      "dm_setting": "send",
      "mailing_address_type": "home",
      "notes": null
    },
    "usage_fee": {
      "calculation_type": "任意設定",
      "tax_type": "tax_included",
      "billing_type": "永代",
      "billing_years": 10,
      "area": 1.30,
      "unit_price": null,
      "total_amount": 195000,
      "payment_method": {
        "id": 1,
        "name": "振込"
      }
    },
    "management_fee": {
      "calculation_type": "任意設定",
      "tax_type": "tax_included",
      "billing_type": "あり",
      "billing_years": 10,
      "area": 1.30,
      "billing_month_interval": 36,
      "management_fee": 29900,
      "unit_price": null,
      "last_billing_month": "2024-03-01",
      "payment_method": {
        "id": 1,
        "name": "振込"
      }
    },
    "gravestone": {
      "gravestone_price": 797600,
      "direction": null,
      "location": null,
      "dealer": "小嶺",
      "grave_type": {
        "id": 1,
        "code": "J3",
        "name": "一般墓地J3"
      },
      "religious_sect": {
        "id": 1,
        "name": "なし"
      },
      "inscription": null,
      "construction_deadline": null,
      "construction_date": null,
      "memorial_tablet": null
    },
    "billing_account": {
      "billing_type": null,
      "institution_name": null,
      "branch_name": null,
      "account_type": null,
      "account_number": null,
      "account_holder": null
    }
  }
}
```

#### 3.3.3 契約新規作成
```
POST /contracts
```

**リクエスト**
```json
{
  "contract": {
    "contract_number": "1234",
    "application_date": "2004-05-01",
    "reservation_date": "2004-04-15",
    "permission_date": "2004-05-01",
    "start_date": "2004-05-01",
    "staff_id": 1
  },
  "applicant": {
    "name": "田中 太郎",
    "name_kana": "たなか たろう",
    "postal_code": "123-4567",
    "address1": "福岡県福岡市博多区住吉",
    "address2": "1-20-15",
    "phone1": "012-345-6789",
    "phone2": null
  },
  "contractor": {
    "name": "田中 太郎",
    "name_kana": "たなか たろう",
    "birth_date": "1958-05-10",
    "gender": "male",
    "postal_code": "123-4567",
    "address1": "福岡県福岡市博多区住吉",
    "address2": "1-20-15",
    "phone1": "012-345-6789",
    "phone2": null,
    "fax": null,
    "email": null,
    "permanent_address1": "神奈川県相模原市相生",
    "permanent_address2": "1-1-1"
  },
  "contractor_detail": {
    "workplace_name": null,
    "workplace_kana": null,
    "workplace_address": null,
    "workplace_phone1": null,
    "workplace_phone2": null,
    "dm_setting": "not_send",
    "mailing_address_type": "home",
    "notes": null
  },
  "usage_fee": {
    "calculation_type": "任意設定",
    "tax_type": "tax_included",
    "billing_type": "永代",
    "billing_years": 10,
    "area": 1.30,
    "unit_price": null,
    "total_amount": 195000,
    "payment_method_id": 1
  },
  "management_fee": {
    "calculation_type": "任意設定",
    "tax_type": "tax_included",
    "billing_type": "あり",
    "billing_years": 10,
    "area": 1.30,
    "billing_month_interval": 36,
    "management_fee": 29900,
    "unit_price": null,
    "last_billing_month": "2024-03-01",
    "payment_method_id": 1
  },
  "gravestone": {
    "gravestone_price": 797600,
    "direction": null,
    "location": null,
    "dealer": "小嶺",
    "grave_type_id": 1,
    "religious_sect_id": 1,
    "inscription": null,
    "construction_deadline": null,
    "construction_date": null,
    "memorial_tablet": null
  },
  "billing_account": {
    "billing_type": null,
    "institution_name": null,
    "branch_name": null,
    "account_type": null,
    "account_number": null,
    "account_holder": null
  }
}
```

#### 3.3.4 契約更新
```
PUT /contracts/{contract_id}
```

**リクエスト**: 3.3.3と同じ形式

#### 3.3.5 契約削除（論理削除）
```
DELETE /contracts/{contract_id}
```

### 3.4 連絡先/家族管理API

#### 3.4.1 連絡先一覧取得
```
GET /contracts/{contract_id}/family-contacts
```

**レスポンス**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "田中 太郎",
      "name_kana": "たなか たろう",
      "birth_date": null,
      "relationship": "長男",
      "postal_code": null,
      "address1": null,
      "address2": null,
      "address3": null,
      "phone1": "012-345-6789",
      "phone2": null,
      "fax": null,
      "email": null,
      "permanent_address": null,
      "mailing_address_type": "home",
      "workplace_name": null,
      "workplace_kana": null,
      "workplace_postal_code": null,
      "workplace_address1": null,
      "workplace_address2": null,
      "workplace_address3": null,
      "workplace_phone1": null,
      "workplace_phone2": null,
      "notes": null
    }
  ]
}
```

#### 3.4.2 連絡先新規作成
```
POST /contracts/{contract_id}/family-contacts
```

**リクエスト**
```json
{
  "name": "田中 太郎",
  "name_kana": "たなか たろう",
  "birth_date": null,
  "relationship": "長男",
  "postal_code": null,
  "address1": null,
  "address2": null,
  "address3": null,
  "phone1": "012-345-6789",
  "phone2": null,
  "fax": null,
  "email": null,
  "permanent_address": null,
  "mailing_address_type": "home",
  "workplace_name": null,
  "workplace_kana": null,
  "workplace_postal_code": null,
  "workplace_address1": null,
  "workplace_address2": null,
  "workplace_address3": null,
  "workplace_phone1": null,
  "workplace_phone2": null,
  "notes": null
}
```

#### 3.4.3 連絡先更新
```
PUT /family-contacts/{contact_id}
```

#### 3.4.4 連絡先削除
```
DELETE /family-contacts/{contact_id}
```

### 3.5 埋葬情報管理API

#### 3.5.1 埋葬情報一覧取得
```
GET /contracts/{contract_id}/burials
```

**レスポンス**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "田中 工",
      "name_kana": "たなか たくみ",
      "birth_date": null,
      "gender": "male",
      "posthumous_name1": null,
      "posthumous_name2": null,
      "death_date": "1967-01-19",
      "age_at_death": null,
      "burial_date": "2004-07-04",
      "notification_date": null,
      "religious_sect": {
        "id": 1,
        "name": "なし"
      },
      "memo": null
    }
  ]
}
```

#### 3.5.2 埋葬情報新規作成
```
POST /contracts/{contract_id}/burials
```

**リクエスト**
```json
{
  "name": "田中 工",
  "name_kana": "たなか たくみ",
  "birth_date": null,
  "gender": "male",
  "posthumous_name1": null,
  "posthumous_name2": null,
  "death_date": "1967-01-19",
  "age_at_death": null,
  "burial_date": "2004-07-04",
  "notification_date": null,
  "religious_sect_id": 1,
  "memo": null
}
```

#### 3.5.3 埋葬情報更新
```
PUT /burials/{burial_id}
```

#### 3.5.4 埋葬情報削除
```
DELETE /burials/{burial_id}
```

### 3.6 工事情報管理API

#### 3.6.1 工事情報一覧取得
```
GET /contracts/{contract_id}/constructions
```

**レスポンス**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "contractor_name": "建設業者A",
      "start_date": "2024-01-15",
      "scheduled_end_date": "2024-02-15",
      "end_date": null,
      "construction_details": "基礎工事",
      "construction_amount": 500000,
      "payment_amount": 250000,
      "construction_type": "基礎工事",
      "notes": null
    }
  ]
}
```

#### 3.6.2 工事情報新規作成
```
POST /contracts/{contract_id}/constructions
```

#### 3.6.3 工事情報更新
```
PUT /constructions/{construction_id}
```

#### 3.6.4 工事情報削除
```
DELETE /constructions/{construction_id}
```

### 3.7 契約者履歴管理API

#### 3.7.1 契約者履歴一覧取得
```
GET /contracts/{contract_id}/contractor-histories
```

**レスポンス**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "contractor_id": 1,
      "name": "田中 修",
      "name_kana": "たなか おさむ",
      "birth_date": "1958-05-10",
      "postal_code": "102-3456",
      "address1": "福岡県北九州市小倉南区守石",
      "address2": "1-1-3",
      "phone1": "092-123-4567",
      "phone2": null,
      "fax": null,
      "email": null,
      "workplace_name": null,
      "workplace_kana": null,
      "workplace_postal_code": null,
      "workplace_address1": null,
      "workplace_address2": null,
      "workplace_phone1": null,
      "workplace_phone2": null,
      "change_date": "2024-01-15",
      "change_reason": "住所変更"
    }
  ]
}
```

#### 3.7.2 契約者変更履歴作成
```
POST /contracts/{contract_id}/contractor-histories
```

**リクエスト**
```json
{
  "contractor_id": 1,
  "name": "田中 修",
  "name_kana": "たなか おさむ",
  "birth_date": "1958-05-10",
  "postal_code": "102-3456",
  "address1": "福岡県北九州市小倉南区守石",
  "address2": "1-1-3",
  "phone1": "092-123-4567",
  "phone2": null,
  "fax": null,
  "email": null,
  "workplace_name": null,
  "workplace_kana": null,
  "workplace_postal_code": null,
  "workplace_address1": null,
  "workplace_address2": null,
  "workplace_phone1": null,
  "workplace_phone2": null,
  "change_date": "2024-01-15",
  "change_reason": "住所変更"
}
```

### 3.8 バリデーションAPI

#### 3.8.1 承諾書番号重複チェック
```
GET /validations/contract-number?number=1234&exclude_id=1
```

**レスポンス**
```json
{
  "success": true,
  "data": {
    "is_duplicate": false
  }
}
```

#### 3.8.2 入力値バリデーション
```
POST /validations/contract
```

**リクエスト**: 契約作成時と同じ形式

**レスポンス**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "入力値にエラーがあります",
    "details": [
      {
        "field": "applicant.name",
        "message": "申込者の氏名は必須です"
      },
      {
        "field": "contract.contract_number",
        "message": "承諾書番号が重複しています"
      }
    ]
  }
}
```

## 4. エラーハンドリング

### 4.1 HTTPステータスコード
- `200 OK`: 成功
- `201 Created`: 作成成功
- `400 Bad Request`: リクエストエラー
- `401 Unauthorized`: 認証エラー
- `403 Forbidden`: 権限エラー
- `404 Not Found`: リソース未発見
- `409 Conflict`: 競合エラー（重複等）
- `422 Unprocessable Entity`: バリデーションエラー
- `500 Internal Server Error`: サーバーエラー

### 4.2 バリデーションルール

#### 必須項目チェック
- 申込者情報: 申込日、氏名、ふりがな、郵便番号、住所1、住所2、電話番号1
- 契約者情報: 承諾書番号、許可日、開始年月日、氏名、ふりがな、生年月日、性別、郵便番号、住所1、住所2、電話番号1、本籍住所1、本籍住所2
- 使用料: 計算区分、税区分、請求区分、請求年数、面積、使用料、支払方法
- 管理料: 計算区分、税区分、請求区分、請求年数、面積、請求月、管理料、最終請求月、支払方法
- 墓石: 墓石代、墓石取扱、墓地タイプ、宗派
- 基本情報②: DM設定、宛先区分
- 連絡先/家族: 氏名、ふりがな、電話番号1、送付先区分
- 埋葬情報: 氏名、ふりがな、性別、命日、埋葬日
- 履歴情報: 氏名、ふりがな、生年月日、郵便番号、住所1、住所2、電話番号1

#### データ型チェック
- 日付形式: YYYY-MM-DD
- 郵便番号形式: 123-4567
- 電話番号形式: 012-345-6789
- 金額: 数値のみ
- メールアドレス: RFC5322準拠

#### 業務ルールチェック
- 承諾書番号の一意性
- 日付の論理チェック（開始日 >= 許可日等）
- 金額の妥当性チェック

## 5. セキュリティ考慮事項

### 5.1 認証・認可
- JWT トークンによる認証
- ロールベースのアクセス制御
- API キーによるアクセス制限

### 5.2 データ保護
- SQL インジェクション対策
- XSS 対策
- CSRF 対策
- 入力値サニタイゼーション

### 5.3 ログ・監査
- API アクセスログ
- データ変更履歴
- エラーログ

## 6. パフォーマンス考慮事項

### 6.1 レスポンス最適化
- ページネーション実装
- 必要なデータのみ取得（部分取得）
- キャッシュ機能

### 6.2 データベース最適化
- 適切なインデックス設計
- N+1 問題の回避
- クエリの最適化

## 7. API テストケース例

### 7.1 契約作成テスト
```javascript
// 正常系
POST /contracts
{
  // 必須項目がすべて設定された正常なデータ
}
期待結果: 201 Created

// 異常系 - 必須項目不足
POST /contracts
{
  // 申込者の氏名が未設定
}
期待結果: 422 Unprocessable Entity

// 異常系 - 承諾書番号重複
POST /contracts
{
  // 既存の承諾書番号を指定
}
期待結果: 409 Conflict
```

### 7.2 契約検索テスト
```javascript
// 正常系
GET /contracts?search=田中&page=1&limit=10
期待結果: 200 OK, 検索結果が返却される

// 異常系 - 存在しない契約ID
GET /contracts/99999
期待結果: 404 Not Found
```