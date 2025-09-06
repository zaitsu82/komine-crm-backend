# Cemetery CRM データベース仕様書

## 概要

Cemetery CRM システムのデータベース仕様書です。PostgreSQL を使用し、Prisma ORM で管理されています。

### 基本情報

- **データベース**: PostgreSQL
- **ORM**: Prisma
- **文字エンコーディング**: UTF-8
- **タイムゾーン**: システム設定に依存

## データベース構成

### テーブル一覧

| テーブル分類 | テーブル名 | 論理名 | 主な用途 |
|-------------|-----------|--------|----------|
| **マスターテーブル** | `Staff` | スタッフ | システム利用者管理 |
| | `PaymentMethod` | 支払方法 | 支払方法マスター |
| | `GraveType` | 墓地タイプ | 墓地種別マスター |
| | `ReligiousSect` | 宗派 | 宗派マスター |
| **基幹テーブル** | `Contract` | 契約 | 契約基本情報 |
| | `Applicant` | 申請者 | 契約申請者情報 |
| | `Contractor` | 契約者 | 契約者基本情報 |
| | `ContractorDetails` | 契約者詳細 | 契約者追加情報 |
| **料金テーブル** | `UsageFee` | 使用料 | 墓地使用料情報 |
| | `ManagementFee` | 管理料 | 墓地管理料情報 |
| **墓石・請求テーブル** | `Gravestone` | 墓石 | 墓石情報 |
| | `BillingAccount` | 請求先口座 | 請求先口座情報 |
| **関連テーブル** | `FamilyContact` | 家族連絡先 | 家族・親族連絡先 |
| | `Burial` | 埋葬 | 埋葬・納骨記録 |
| | `Construction` | 工事 | 工事履歴 |
| | `ContractorHistory` | 契約者履歴 | 契約者変更履歴 |

## テーブル詳細仕様

### 1. マスターテーブル

#### 1.1 Staff（スタッフ）

システムを利用するスタッフの情報を管理

| カラム名 | 型 | 制約 | 説明 |
|---------|---|------|------|
| `id` | INT | PK, AUTO_INCREMENT | スタッフID |
| `name` | VARCHAR(100) | NOT NULL | スタッフ名 |
| `email` | VARCHAR(255) | | メールアドレス |
| `password` | VARCHAR(255) | NOT NULL | パスワード（ハッシュ化） |
| `is_active` | BOOLEAN | DEFAULT true | 有効フラグ |
| `created_at` | TIMESTAMP | DEFAULT now() | 作成日時 |
| `updated_at` | TIMESTAMP | DEFAULT now(), AUTO_UPDATE | 更新日時 |

**リレーション**
- `Contract` (1:N) - 担当契約一覧

#### 1.2 PaymentMethod（支払方法）

支払方法のマスターデータ

| カラム名 | 型 | 制約 | 説明 |
|---------|---|------|------|
| `id` | INT | PK, AUTO_INCREMENT | 支払方法ID |
| `name` | VARCHAR(50) | NOT NULL, UNIQUE | 支払方法名 |
| `created_at` | TIMESTAMP | DEFAULT now() | 作成日時 |

**リレーション**
- `UsageFee` (1:N) - 使用料支払方法
- `ManagementFee` (1:N) - 管理料支払方法

#### 1.3 GraveType（墓地タイプ）

墓地種別のマスターデータ

| カラム名 | 型 | 制約 | 説明 |
|---------|---|------|------|
| `id` | INT | PK, AUTO_INCREMENT | 墓地タイプID |
| `code` | VARCHAR(20) | NOT NULL, UNIQUE | 墓地タイプコード |
| `name` | VARCHAR(100) | NOT NULL | 墓地タイプ名 |
| `created_at` | TIMESTAMP | DEFAULT now() | 作成日時 |

**リレーション**
- `Gravestone` (1:N) - 墓石情報

#### 1.4 ReligiousSect（宗派）

宗派のマスターデータ

| カラム名 | 型 | 制約 | 説明 |
|---------|---|------|------|
| `id` | INT | PK, AUTO_INCREMENT | 宗派ID |
| `name` | VARCHAR(100) | NOT NULL, UNIQUE | 宗派名 |
| `created_at` | TIMESTAMP | DEFAULT now() | 作成日時 |

**リレーション**
- `Gravestone` (1:N) - 墓石情報
- `Burial` (1:N) - 埋葬情報

### 2. 基幹テーブル

#### 2.1 Contract（契約）

契約の基本情報を管理するメインテーブル

| カラム名 | 型 | 制約 | 説明 |
|---------|---|------|------|
| `id` | INT | PK, AUTO_INCREMENT | 契約ID |
| `contract_number` | VARCHAR(50) | NOT NULL, UNIQUE | 契約番号 |
| `application_date` | DATE | NOT NULL | 申請日 |
| `reservation_date` | DATE | | 予約日 |
| `permission_date` | DATE | NOT NULL | 許可日 |
| `start_date` | DATE | NOT NULL | 開始日 |
| `staff_id` | INT | FK | 担当スタッフID |
| `status` | ENUM | DEFAULT 'ACTIVE' | 契約ステータス |
| `created_at` | TIMESTAMP | DEFAULT now() | 作成日時 |
| `updated_at` | TIMESTAMP | DEFAULT now(), AUTO_UPDATE | 更新日時 |

**インデックス**
- `application_date` - 申請日での検索用
- `staff_id` - 担当者での検索用
- `status` - ステータス検索用

**リレーション**
- `Staff` (N:1) - 担当スタッフ
- `Applicant` (1:1) - 申請者情報
- `Contractor` (1:N) - 契約者一覧
- `UsageFee` (1:1) - 使用料情報
- `ManagementFee` (1:1) - 管理料情報
- `Gravestone` (1:1) - 墓石情報
- `BillingAccount` (1:1) - 請求先口座
- `FamilyContact` (1:N) - 家族連絡先
- `Burial` (1:N) - 埋葬記録
- `Construction` (1:N) - 工事履歴
- `ContractorHistory` (1:N) - 契約者変更履歴

#### 2.2 Applicant（申請者）

契約申請者の情報

| カラム名 | 型 | 制約 | 説明 |
|---------|---|------|------|
| `id` | INT | PK, AUTO_INCREMENT | 申請者ID |
| `contract_id` | INT | FK, UNIQUE | 契約ID |
| `name` | VARCHAR(100) | NOT NULL | 申請者名 |
| `name_kana` | VARCHAR(100) | NOT NULL | 申請者名（カナ） |
| `postal_code` | VARCHAR(10) | NOT NULL | 郵便番号 |
| `address1` | VARCHAR(255) | NOT NULL | 住所1 |
| `address2` | VARCHAR(255) | NOT NULL | 住所2 |
| `phone1` | VARCHAR(20) | NOT NULL | 電話番号1 |
| `phone2` | VARCHAR(20) | | 電話番号2 |
| `created_at` | TIMESTAMP | DEFAULT now() | 作成日時 |
| `updated_at` | TIMESTAMP | DEFAULT now(), AUTO_UPDATE | 更新日時 |

**リレーション**
- `Contract` (1:1) - 契約情報

#### 2.3 Contractor（契約者）

契約者の基本情報

| カラム名 | 型 | 制約 | 説明 |
|---------|---|------|------|
| `id` | INT | PK, AUTO_INCREMENT | 契約者ID |
| `contract_id` | INT | FK | 契約ID |
| `name` | VARCHAR(100) | NOT NULL | 契約者名 |
| `name_kana` | VARCHAR(100) | NOT NULL | 契約者名（カナ） |
| `birth_date` | DATE | NOT NULL | 生年月日 |
| `gender` | ENUM | NOT NULL | 性別（MALE/FEMALE/OTHER） |
| `postal_code` | VARCHAR(10) | NOT NULL | 郵便番号 |
| `address1` | VARCHAR(255) | NOT NULL | 住所1 |
| `address2` | VARCHAR(255) | NOT NULL | 住所2 |
| `phone1` | VARCHAR(20) | NOT NULL | 電話番号1 |
| `phone2` | VARCHAR(20) | | 電話番号2 |
| `fax` | VARCHAR(20) | | FAX番号 |
| `email` | VARCHAR(255) | | メールアドレス |
| `permanent_address1` | VARCHAR(255) | NOT NULL | 本籍地1 |
| `permanent_address2` | VARCHAR(255) | NOT NULL | 本籍地2 |
| `is_current` | BOOLEAN | DEFAULT true | 現在の契約者フラグ |
| `created_at` | TIMESTAMP | DEFAULT now() | 作成日時 |
| `updated_at` | TIMESTAMP | DEFAULT now(), AUTO_UPDATE | 更新日時 |

**インデックス**
- `name` - 名前検索用
- `name_kana` - カナ検索用
- `contract_id, is_current` - 現在の契約者検索用

**リレーション**
- `Contract` (N:1) - 契約情報
- `ContractorDetails` (1:1) - 契約者詳細
- `ContractorHistory` (1:N) - 変更履歴

#### 2.4 ContractorDetails（契約者詳細）

契約者の追加詳細情報

| カラム名 | 型 | 制約 | 説明 |
|---------|---|------|------|
| `id` | INT | PK, AUTO_INCREMENT | 詳細ID |
| `contractor_id` | INT | FK, UNIQUE | 契約者ID |
| `workplace_name` | VARCHAR(255) | | 勤務先名 |
| `workplace_kana` | VARCHAR(255) | | 勤務先名（カナ） |
| `workplace_address` | VARCHAR(500) | | 勤務先住所 |
| `workplace_phone1` | VARCHAR(20) | | 勤務先電話1 |
| `workplace_phone2` | VARCHAR(20) | | 勤務先電話2 |
| `dm_setting` | ENUM | DEFAULT 'SEND' | DM送付設定 |
| `mailing_address_type` | ENUM | DEFAULT 'HOME' | 郵送先種別 |
| `notes` | TEXT | | 備考 |
| `created_at` | TIMESTAMP | DEFAULT now() | 作成日時 |
| `updated_at` | TIMESTAMP | DEFAULT now(), AUTO_UPDATE | 更新日時 |

**リレーション**
- `Contractor` (1:1) - 契約者基本情報

### 3. 料金テーブル

#### 3.1 UsageFee（使用料）

墓地使用料の情報

| カラム名 | 型 | 制約 | 説明 |
|---------|---|------|------|
| `id` | INT | PK, AUTO_INCREMENT | 使用料ID |
| `contract_id` | INT | FK, UNIQUE | 契約ID |
| `calculation_type` | VARCHAR(50) | NOT NULL | 計算方式 |
| `tax_type` | ENUM | NOT NULL | 税込/税別区分 |
| `billing_type` | VARCHAR(50) | NOT NULL | 請求方式 |
| `billing_years` | INT | NOT NULL | 請求年数 |
| `area` | DECIMAL(10,2) | NOT NULL | 面積 |
| `unit_price` | DECIMAL(10,2) | | 単価 |
| `total_amount` | DECIMAL(10,2) | NOT NULL | 合計金額 |
| `payment_method_id` | INT | FK | 支払方法ID |
| `created_at` | TIMESTAMP | DEFAULT now() | 作成日時 |
| `updated_at` | TIMESTAMP | DEFAULT now(), AUTO_UPDATE | 更新日時 |

**リレーション**
- `Contract` (1:1) - 契約情報
- `PaymentMethod` (N:1) - 支払方法

#### 3.2 ManagementFee（管理料）

墓地管理料の情報

| カラム名 | 型 | 制約 | 説明 |
|---------|---|------|------|
| `id` | INT | PK, AUTO_INCREMENT | 管理料ID |
| `contract_id` | INT | FK, UNIQUE | 契約ID |
| `calculation_type` | VARCHAR(50) | NOT NULL | 計算方式 |
| `tax_type` | ENUM | NOT NULL | 税込/税別区分 |
| `billing_type` | VARCHAR(50) | NOT NULL | 請求方式 |
| `billing_years` | INT | NOT NULL | 請求年数 |
| `area` | DECIMAL(10,2) | NOT NULL | 面積 |
| `billing_month_interval` | INT | NOT NULL | 請求月間隔 |
| `management_fee` | DECIMAL(10,2) | NOT NULL | 管理料 |
| `unit_price` | DECIMAL(10,2) | | 単価 |
| `last_billing_month` | DATE | NOT NULL | 最終請求月 |
| `payment_method_id` | INT | FK | 支払方法ID |
| `created_at` | TIMESTAMP | DEFAULT now() | 作成日時 |
| `updated_at` | TIMESTAMP | DEFAULT now(), AUTO_UPDATE | 更新日時 |

**リレーション**
- `Contract` (1:1) - 契約情報
- `PaymentMethod` (N:1) - 支払方法

### 4. 墓石・請求テーブル

#### 4.1 Gravestone（墓石）

墓石に関する情報

| カラム名 | 型 | 制約 | 説明 |
|---------|---|------|------|
| `id` | INT | PK, AUTO_INCREMENT | 墓石ID |
| `contract_id` | INT | FK, UNIQUE | 契約ID |
| `gravestone_price` | DECIMAL(10,2) | NOT NULL | 墓石価格 |
| `direction` | VARCHAR(50) | | 向き |
| `location` | VARCHAR(255) | | 場所 |
| `dealer` | VARCHAR(100) | NOT NULL | 取扱業者 |
| `grave_type_id` | INT | FK | 墓地タイプID |
| `religious_sect_id` | INT | FK | 宗派ID |
| `inscription` | TEXT | | 刻印内容 |
| `construction_deadline` | DATE | | 工事期限 |
| `construction_date` | DATE | | 工事日 |
| `memorial_tablet` | TEXT | | 位牌情報 |
| `created_at` | TIMESTAMP | DEFAULT now() | 作成日時 |
| `updated_at` | TIMESTAMP | DEFAULT now(), AUTO_UPDATE | 更新日時 |

**リレーション**
- `Contract` (1:1) - 契約情報
- `GraveType` (N:1) - 墓地タイプ
- `ReligiousSect` (N:1) - 宗派

#### 4.2 BillingAccount（請求先口座）

請求先口座の情報

| カラム名 | 型 | 制約 | 説明 |
|---------|---|------|------|
| `id` | INT | PK, AUTO_INCREMENT | 口座ID |
| `contract_id` | INT | FK, UNIQUE | 契約ID |
| `billing_type` | VARCHAR(50) | | 請求方式 |
| `institution_name` | VARCHAR(100) | | 金融機関名 |
| `branch_name` | VARCHAR(100) | | 支店名 |
| `account_type` | VARCHAR(50) | | 口座種別 |
| `account_number` | VARCHAR(50) | | 口座番号 |
| `account_holder` | VARCHAR(100) | | 口座名義 |
| `created_at` | TIMESTAMP | DEFAULT now() | 作成日時 |
| `updated_at` | TIMESTAMP | DEFAULT now(), AUTO_UPDATE | 更新日時 |

**リレーション**
- `Contract` (1:1) - 契約情報

### 5. 関連テーブル

#### 5.1 FamilyContact（家族連絡先）

家族・親族の連絡先情報

| カラム名 | 型 | 制約 | 説明 |
|---------|---|------|------|
| `id` | INT | PK, AUTO_INCREMENT | 連絡先ID |
| `contract_id` | INT | FK | 契約ID |
| `name` | VARCHAR(100) | NOT NULL | 氏名 |
| `name_kana` | VARCHAR(100) | NOT NULL | 氏名（カナ） |
| `birth_date` | DATE | | 生年月日 |
| `relationship` | VARCHAR(50) | | 続柄 |
| `postal_code` | VARCHAR(10) | | 郵便番号 |
| `address1` | VARCHAR(255) | | 住所1 |
| `address2` | VARCHAR(255) | | 住所2 |
| `address3` | VARCHAR(255) | | 住所3 |
| `phone1` | VARCHAR(20) | NOT NULL | 電話番号1 |
| `phone2` | VARCHAR(20) | | 電話番号2 |
| `fax` | VARCHAR(20) | | FAX番号 |
| `email` | VARCHAR(255) | | メールアドレス |
| `permanent_address` | VARCHAR(500) | | 本籍地 |
| `mailing_address_type` | ENUM | DEFAULT 'HOME' | 郵送先種別 |
| `workplace_name` | VARCHAR(255) | | 勤務先名 |
| `workplace_kana` | VARCHAR(255) | | 勤務先名（カナ） |
| `workplace_postal_code` | VARCHAR(10) | | 勤務先郵便番号 |
| `workplace_address1` | VARCHAR(255) | | 勤務先住所1 |
| `workplace_address2` | VARCHAR(255) | | 勤務先住所2 |
| `workplace_address3` | VARCHAR(255) | | 勤務先住所3 |
| `workplace_phone1` | VARCHAR(20) | | 勤務先電話1 |
| `workplace_phone2` | VARCHAR(20) | | 勤務先電話2 |
| `notes` | TEXT | | 備考 |
| `created_at` | TIMESTAMP | DEFAULT now() | 作成日時 |
| `updated_at` | TIMESTAMP | DEFAULT now(), AUTO_UPDATE | 更新日時 |

**インデックス**
- `contract_id` - 契約での検索用

**リレーション**
- `Contract` (N:1) - 契約情報

#### 5.2 Burial（埋葬）

埋葬・納骨記録の情報

| カラム名 | 型 | 制約 | 説明 |
|---------|---|------|------|
| `id` | INT | PK, AUTO_INCREMENT | 埋葬ID |
| `contract_id` | INT | FK | 契約ID |
| `name` | VARCHAR(100) | NOT NULL | 被埋葬者名 |
| `name_kana` | VARCHAR(100) | NOT NULL | 被埋葬者名（カナ） |
| `birth_date` | DATE | | 生年月日 |
| `gender` | ENUM | NOT NULL | 性別 |
| `posthumous_name1` | VARCHAR(100) | | 戒名1 |
| `posthumous_name2` | VARCHAR(100) | | 戒名2 |
| `death_date` | DATE | NOT NULL | 死亡日 |
| `age_at_death` | INT | | 享年 |
| `burial_date` | DATE | NOT NULL | 埋葬日 |
| `notification_date` | DATE | | 届出日 |
| `religious_sect_id` | INT | FK | 宗派ID |
| `memo` | TEXT | | メモ |
| `created_at` | TIMESTAMP | DEFAULT now() | 作成日時 |
| `updated_at` | TIMESTAMP | DEFAULT now(), AUTO_UPDATE | 更新日時 |

**インデックス**
- `contract_id` - 契約での検索用
- `burial_date` - 埋葬日での検索用
- `name` - 名前検索用

**リレーション**
- `Contract` (N:1) - 契約情報
- `ReligiousSect` (N:1) - 宗派

#### 5.3 Construction（工事）

工事履歴の情報

| カラム名 | 型 | 制約 | 説明 |
|---------|---|------|------|
| `id` | INT | PK, AUTO_INCREMENT | 工事ID |
| `contract_id` | INT | FK | 契約ID |
| `contractor_name` | VARCHAR(100) | | 施工業者名 |
| `start_date` | DATE | | 開始日 |
| `scheduled_end_date` | DATE | | 予定終了日 |
| `end_date` | DATE | | 実際の終了日 |
| `construction_details` | TEXT | | 工事内容 |
| `construction_amount` | DECIMAL(10,2) | | 工事金額 |
| `payment_amount` | DECIMAL(10,2) | | 支払金額 |
| `construction_type` | VARCHAR(50) | | 工事種別 |
| `notes` | TEXT | | 備考 |
| `created_at` | TIMESTAMP | DEFAULT now() | 作成日時 |
| `updated_at` | TIMESTAMP | DEFAULT now(), AUTO_UPDATE | 更新日時 |

**インデックス**
- `contract_id` - 契約での検索用
- `start_date` - 開始日での検索用

**リレーション**
- `Contract` (N:1) - 契約情報

#### 5.4 ContractorHistory（契約者履歴）

契約者の変更履歴

| カラム名 | 型 | 制約 | 説明 |
|---------|---|------|------|
| `id` | INT | PK, AUTO_INCREMENT | 履歴ID |
| `contract_id` | INT | FK | 契約ID |
| `contractor_id` | INT | FK | 契約者ID |
| `name` | VARCHAR(100) | NOT NULL | 変更前氏名 |
| `name_kana` | VARCHAR(100) | NOT NULL | 変更前氏名（カナ） |
| `birth_date` | DATE | NOT NULL | 生年月日 |
| `postal_code` | VARCHAR(10) | NOT NULL | 郵便番号 |
| `address1` | VARCHAR(255) | NOT NULL | 住所1 |
| `address2` | VARCHAR(255) | NOT NULL | 住所2 |
| `phone1` | VARCHAR(20) | NOT NULL | 電話番号1 |
| `phone2` | VARCHAR(20) | | 電話番号2 |
| `fax` | VARCHAR(20) | | FAX番号 |
| `email` | VARCHAR(255) | | メールアドレス |
| `workplace_name` | VARCHAR(255) | | 勤務先名 |
| `workplace_kana` | VARCHAR(255) | | 勤務先名（カナ） |
| `workplace_postal_code` | VARCHAR(10) | | 勤務先郵便番号 |
| `workplace_address1` | VARCHAR(255) | | 勤務先住所1 |
| `workplace_address2` | VARCHAR(255) | | 勤務先住所2 |
| `workplace_phone1` | VARCHAR(20) | | 勤務先電話1 |
| `workplace_phone2` | VARCHAR(20) | | 勤務先電話2 |
| `change_date` | DATE | NOT NULL | 変更日 |
| `change_reason` | TEXT | | 変更理由 |
| `created_at` | TIMESTAMP | DEFAULT now() | 作成日時 |

**インデックス**
- `contract_id` - 契約での検索用
- `change_date` - 変更日での検索用

**リレーション**
- `Contract` (N:1) - 契約情報
- `Contractor` (N:1) - 契約者情報

## ENUMカラムの定義

### ContractStatus（契約ステータス）

| 値 | データベース値 | 説明 |
|---|--------------|------|
| `ACTIVE` | `active` | 有効 |
| `TERMINATED` | `terminated` | 解約 |
| `SUSPENDED` | `suspended` | 停止 |

### Gender（性別）

| 値 | データベース値 | 説明 |
|---|--------------|------|
| `MALE` | `male` | 男性 |
| `FEMALE` | `female` | 女性 |
| `OTHER` | `other` | その他 |

### DmSetting（DM送付設定）

| 値 | データベース値 | 説明 |
|---|--------------|------|
| `SEND` | `send` | 送付する |
| `NOT_SEND` | `not_send` | 送付しない |

### AddressType（住所種別）

| 値 | データベース値 | 説明 |
|---|--------------|------|
| `HOME` | `home` | 自宅 |
| `WORKPLACE` | `workplace` | 勤務先 |
| `OTHER` | `other` | その他 |

### TaxType（税区分）

| 値 | データベース値 | 説明 |
|---|--------------|------|
| `TAX_INCLUDED` | `tax_included` | 税込 |
| `TAX_EXCLUDED` | `tax_excluded` | 税別 |

## データベースER図（概念図）

```
[Staff] 1----N [Contract] 1----1 [Applicant]
                    |
                    +---1:1--- [UsageFee] ----N:1--- [PaymentMethod]
                    |
                    +---1:1--- [ManagementFee] ----N:1--- [PaymentMethod]
                    |
                    +---1:1--- [Gravestone] ----N:1--- [GraveType]
                    |                     |
                    |                     +---N:1--- [ReligiousSect]
                    |
                    +---1:1--- [BillingAccount]
                    |
                    +---1:N--- [Contractor] 1----1 [ContractorDetails]
                    |               |
                    |               +---1:N--- [ContractorHistory]
                    |
                    +---1:N--- [FamilyContact]
                    |
                    +---1:N--- [Burial] ----N:1--- [ReligiousSect]
                    |
                    +---1:N--- [Construction]
```

## インデックス戦略

### 主要なインデックス

1. **Contract テーブル**
   - `application_date` - 申請日による並び替え・検索
   - `staff_id` - 担当者による絞り込み
   - `status` - ステータス検索

2. **Contractor テーブル**
   - `name` - 名前検索
   - `name_kana` - カナ検索
   - `(contract_id, is_current)` - 現在の契約者検索

3. **FamilyContact テーブル**
   - `contract_id` - 契約による絞り込み

4. **Burial テーブル**
   - `contract_id` - 契約による絞り込み
   - `burial_date` - 埋葬日での並び替え・検索
   - `name` - 被埋葬者名検索

5. **Construction テーブル**
   - `contract_id` - 契約による絞り込み
   - `start_date` - 工事開始日での並び替え・検索

6. **ContractorHistory テーブル**
   - `contract_id` - 契約による絞り込み
   - `change_date` - 変更日での並び替え・検索

## データ制約とビジネスルール

### 必須項目制約

1. **基本情報の必須項目**
   - 氏名・氏名カナは必須
   - 住所（address1, address2）は必須
   - 電話番号（phone1）は必須

2. **日付の制約**
   - 埋葬日 ≧ 死亡日
   - 工事終了日 ≧ 工事開始日
   - 申請日 ≦ 許可日 ≦ 開始日

3. **契約者の制約**
   - 1契約につき1人の現在契約者（`is_current = true`）が必須

### 外部キー制約

すべての外部キー参照において、参照整合性を保持：

- `ON DELETE CASCADE` - 親レコード削除時に子レコードも削除
- `ON DELETE SET NULL` - 親レコード削除時に外部キーをNULLに設定

## Prisma クライアント使用例

### 基本的なクエリ例

```typescript
// 契約一覧取得（関連データ含む）
const contracts = await prisma.contract.findMany({
  include: {
    staff: {
      select: { id: true, name: true }
    },
    contractors: {
      where: { isCurrent: true },
      select: { name: true }
    }
  },
  orderBy: { applicationDate: 'desc' }
});

// 契約詳細取得
const contractDetail = await prisma.contract.findUnique({
  where: { id: contractId },
  include: {
    applicant: true,
    contractors: true,
    usageFee: { include: { paymentMethod: true } },
    managementFee: { include: { paymentMethod: true } },
    gravestone: {
      include: {
        graveType: true,
        religiousSect: true
      }
    },
    familyContacts: true,
    burials: { include: { religiousSect: true } },
    constructions: true,
    contractorHistories: {
      orderBy: { changeDate: 'desc' }
    }
  }
});

// 埋葬記録の作成
const burial = await prisma.burial.create({
  data: {
    contractId: contractId,
    name: "山田花子",
    nameKana: "ヤマダハナコ",
    gender: "FEMALE",
    deathDate: new Date("2024-01-15"),
    burialDate: new Date("2024-01-20"),
    religiousSectId: 1
  }
});
```

### 複雑なクエリ例

```typescript
// 契約検索（複数条件）
const searchContracts = await prisma.contract.findMany({
  where: {
    AND: [
      {
        OR: [
          { contractNumber: { contains: searchTerm } },
          { contractors: { some: { name: { contains: searchTerm } } } }
        ]
      },
      { status: "ACTIVE" },
      { staffId: staffId }
    ]
  },
  include: {
    staff: { select: { name: true } },
    contractors: {
      where: { isCurrent: true },
      select: { name: true }
    }
  },
  skip: (page - 1) * limit,
  take: limit
});

// 月別埋葬統計
const burialStats = await prisma.burial.groupBy({
  by: ['contractId'],
  _count: { id: true },
  where: {
    burialDate: {
      gte: new Date(`${year}-${month}-01`),
      lt: new Date(`${year}-${month + 1}-01`)
    }
  }
});
```

## バックアップ・メンテナンス

### 推奨バックアップ戦略

1. **日次バックアップ**: 全データベースの完全バックアップ
2. **時間単位ログバックアップ**: トランザクションログ
3. **月次アーカイブ**: 長期保存用バックアップ

### パフォーマンス監視

監視すべき項目：

1. **スロークエリ**: 実行時間が長いクエリの特定
2. **インデックス使用率**: インデックスの効果測定
3. **テーブルサイズ**: データ増加トレンドの監視
4. **ロック競合**: 同時アクセスでの競合状況

## 開発・運用情報

### Prisma マイグレーション

```bash
# マイグレーション作成
npx prisma migrate dev --name add_new_column

# 本番環境適用
npx prisma migrate deploy

# マイグレーション履歴確認
npx prisma migrate status
```

### データベース接続設定

```env
# .env ファイル設定例
DATABASE_URL="postgresql://username:password@localhost:5432/cemetery_crm?schema=public"
```

## 更新履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|----------|
| 2024-09-06 | 1.0.0 | 初版作成 |

---

この仕様書は Cemetery CRM システムのデータベース設計の完全なドキュメントです。フロントエンド・バックエンド開発の際の参考として活用してください。