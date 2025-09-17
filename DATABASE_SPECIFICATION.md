# 墓石管理システム データベース仕様書

## 概要

本書は墓石管理システムのデータベース設計について記載したものです。
システムの要件に基づき、墓石の管理から申込者・契約者情報、料金管理、履歴管理まで包括的に対応したデータベース設計となっています。

## データベース基本情報

- **データベース種別**: PostgreSQL
- **文字コード**: UTF-8
- **照合順序**: ja_JP.UTF-8
- **タイムゾーン**: Asia/Tokyo

---

## テーブル一覧

### メインテーブル
1. [墓石情報テーブル (Gravestone)](#1-墓石情報テーブル-gravestone)
2. [申込者情報テーブル (Applicant)](#2-申込者情報テーブル-applicant)
3. [契約者情報テーブル (Contractor)](#3-契約者情報テーブル-contractor)
4. [使用料情報テーブル (UsageFee)](#4-使用料情報テーブル-usagefee)
5. [管理料情報テーブル (ManagementFee)](#5-管理料情報テーブル-managementfee)
6. [請求情報テーブル (BillingInfo)](#6-請求情報テーブル-billinginfo)
7. [家族連絡先情報テーブル (FamilyContact)](#7-家族連絡先情報テーブル-familycontact)
8. [埋葬者情報テーブル (Burial)](#8-埋葬者情報テーブル-burial)
9. [工事情報テーブル (Construction)](#9-工事情報テーブル-construction)
10. [履歴情報テーブル (History)](#10-履歴情報テーブル-history)
11. [スタッフテーブル (Staff)](#11-スタッフテーブル-staff)

### マスタテーブル
12. [利用状況マスタ (UsageStatusMaster)](#12-利用状況マスタ-usagestatusmaster)
13. [墓地タイプマスタ (CemeteryTypeMaster)](#13-墓地タイプマスタ-cemeterytypemaster)
14. [宗派マスタ (DenominationMaster)](#14-宗派マスタ-denominationmaster)
15. [性別マスタ (GenderMaster)](#15-性別マスタ-gendermaster)
16. [支払方法マスタ (PaymentMethodMaster)](#16-支払方法マスタ-paymentmethodmaster)
17. [税区分マスタ (TaxTypeMaster)](#17-税区分マスタ-taxtypemaster)
18. [計算区分マスタ (CalcTypeMaster)](#18-計算区分マスタ-calctypemaster)
19. [請求区分マスタ (BillingTypeMaster)](#19-請求区分マスタ-billingtypemaster)
20. [口座科目マスタ (AccountTypeMaster)](#20-口座科目マスタ-accounttypemaster)
21. [宛先区分マスタ (RecipientTypeMaster)](#21-宛先区分マスタ-recipienttypemaster)
22. [続柄マスタ (RelationMaster)](#22-続柄マスタ-relationmaster)
23. [工事種別マスタ (ConstructionTypeMaster)](#23-工事種別マスタ-constructiontypemaster)
24. [更新種別マスタ (UpdateTypeMaster)](#24-更新種別マスタ-updatetypemaster)
25. [都道府県マスタ (PrefectureMaster)](#25-都道府県マスタ-prefecturemaster)

---

## メインテーブル詳細

### 1. 墓石情報テーブル (Gravestone)

**論理名**: 墓石情報テーブル  
**物理名**: gravestones  
**概要**: 墓石の基本情報を管理するメインテーブル

| No | 論理名 | 物理名 | データ型 | 長さ | NULL | デフォルト | 制約 | 備考 |
|----|--------|--------|----------|------|------|------------|------|------|
| 1 | 墓石ID | gravestone_id | INTEGER | - | × | AUTO_INCREMENT | PK | 主キー（自動生成） |
| 2 | 墓石コード | gravestone_code | VARCHAR | 20 | × | - | UNIQUE | 例：A-56 |
| 3 | 利用状況 | usage_status | VARCHAR | 20 | × | - | - | 例：利用中 |
| 4 | 墓石代 | price | DECIMAL | 10,2 | × | - | - | 例：797600 |
| 5 | 方位 | orientation | VARCHAR | 10 | ○ | - | - | |
| 6 | 位置 | location | VARCHAR | 100 | ○ | - | - | |
| 7 | 墓地タイプ | cemetery_type | VARCHAR | 20 | ○ | - | - | |
| 8 | 宗派 | denomination | VARCHAR | 20 | ○ | - | - | |
| 9 | 碑文 | inscription | TEXT | - | ○ | - | - | |
| 10 | 建立期限 | construction_deadline | DATE | - | ○ | - | - | |
| 11 | 建立日 | construction_date | DATE | - | ○ | - | - | |
| 12 | 墓誌 | epitaph | TEXT | - | ○ | - | - | |
| 13 | 備考 | remarks | TEXT | - | ○ | - | - | |
| 14 | 削除日時 | deleted_at | TIMESTAMP | - | ○ | - | - | 論理削除用 |

**インデックス**:
- PRIMARY KEY (gravestone_id)
- UNIQUE INDEX (gravestone_code)

---

### 2. 申込者情報テーブル (Applicant)

**論理名**: 申込者情報テーブル  
**物理名**: applicants  
**概要**: 墓石の申込者情報を管理

| No | 論理名 | 物理名 | データ型 | 長さ | NULL | デフォルト | 制約 | 備考 |
|----|--------|--------|----------|------|------|------------|------|------|
| 1 | 申込者情報ID | applicant_id | INTEGER | - | × | AUTO_INCREMENT | PK | 主キー（自動生成） |
| 2 | 墓石ID | gravestone_id | INTEGER | - | × | - | FK, UNIQUE | 外部キー |
| 3 | 申込日 | application_date | DATE | - | × | - | - | |
| 4 | 担当者氏名 | staff_name | VARCHAR | 50 | ○ | - | - | |
| 5 | 氏名 | name | VARCHAR | 100 | × | - | - | |
| 6 | ふりがな | kana | VARCHAR | 100 | × | - | - | |
| 7 | 郵便番号 | postal_code | VARCHAR | 8 | × | - | - | |
| 8 | 住所 | address | VARCHAR | 200 | × | - | - | |
| 9 | 電話番号 | phone | VARCHAR | 15 | × | - | - | |
| 10 | 備考 | remarks | TEXT | - | ○ | - | - | |
| 11 | 適用開始年月日 | effective_start_date | DATE | - | ○ | - | - | |
| 12 | 適用終了年月日 | effective_end_date | DATE | - | ○ | - | - | |
| 13 | 削除日時 | deleted_at | TIMESTAMP | - | ○ | - | - | 論理削除用 |

**外部キー**:
- gravestone_id → gravestones.gravestone_id

---

### 3. 契約者情報テーブル (Contractor)

**論理名**: 契約者情報テーブル  
**物理名**: contractors  
**概要**: 墓石の契約者情報を管理

| No | 論理名 | 物理名 | データ型 | 長さ | NULL | デフォルト | 制約 | 備考 |
|----|--------|--------|----------|------|------|------------|------|------|
| 1 | 契約者情報ID | contractor_id | INTEGER | - | × | AUTO_INCREMENT | PK | 主キー（自動生成） |
| 2 | 墓石ID | gravestone_id | INTEGER | - | × | - | FK | 外部キー |
| 3 | 予約日 | reservation_date | DATE | - | ○ | - | - | |
| 4 | 承諾書番号 | consent_form_number | VARCHAR | 50 | ○ | - | - | |
| 5 | 許可日 | permission_date | DATE | - | ○ | - | - | |
| 6 | 開始年月日 | start_date | DATE | - | × | - | - | |
| 7 | 氏名 | name | VARCHAR | 100 | × | - | - | |
| 8 | ふりがな | kana | VARCHAR | 100 | × | - | - | |
| 9 | 生年月日 | birth_date | DATE | - | ○ | - | - | |
| 10 | 性別 | gender | VARCHAR | 10 | ○ | - | - | |
| 11 | 郵便番号 | postal_code | VARCHAR | 8 | × | - | - | |
| 12 | 住所 | address | VARCHAR | 200 | × | - | - | |
| 13 | 電話番号 | phone | VARCHAR | 15 | × | - | - | |
| 14 | FAX | fax | VARCHAR | 15 | ○ | - | - | |
| 15 | メール | email | VARCHAR | 100 | ○ | - | - | |
| 16 | 本籍住所 | domicile_address | VARCHAR | 200 | ○ | - | - | |
| 17 | 勤務先名称 | workplace_name | VARCHAR | 100 | ○ | - | - | |
| 18 | 勤務先名称かな | workplace_kana | VARCHAR | 100 | ○ | - | - | |
| 19 | 勤務先住所 | workplace_address | VARCHAR | 200 | ○ | - | - | |
| 20 | 勤務先電話番号 | workplace_phone | VARCHAR | 15 | ○ | - | - | |
| 21 | DM設定 | dm_setting | VARCHAR | 20 | ○ | - | - | |
| 22 | 宛先区分 | recipient_type | VARCHAR | 20 | ○ | - | - | |
| 23 | 備考 | remarks | TEXT | - | ○ | - | - | |
| 24 | 適用開始年月日 | effective_start_date | DATE | - | ○ | - | - | |
| 25 | 適用終了年月日 | effective_end_date | DATE | - | ○ | - | - | |
| 26 | 削除日時 | deleted_at | TIMESTAMP | - | ○ | - | - | 論理削除用 |

**外部キー**:
- gravestone_id → gravestones.gravestone_id

---

### 4. 使用料情報テーブル (UsageFee)

**論理名**: 使用料情報テーブル  
**物理名**: usage_fees  
**概要**: 墓石の使用料に関する情報を管理

| No | 論理名 | 物理名 | データ型 | 長さ | NULL | デフォルト | 制約 | 備考 |
|----|--------|--------|----------|------|------|------------|------|------|
| 1 | 使用料情報ID | usage_fee_id | INTEGER | - | × | AUTO_INCREMENT | PK | 主キー（自動生成） |
| 2 | 墓石ID | gravestone_id | INTEGER | - | × | - | FK | 外部キー |
| 3 | 計算区分 | calc_type | VARCHAR | 20 | ○ | - | - | |
| 4 | 面積 | area | DECIMAL | 10,2 | ○ | - | - | |
| 5 | 使用料 | fee | DECIMAL | 10,2 | × | - | - | |
| 6 | 税区分 | tax_type | VARCHAR | 20 | ○ | - | - | |
| 7 | 請求年数 | billing_years | INTEGER | - | ○ | - | - | |
| 8 | 単価 | unit_price | DECIMAL | 10,2 | ○ | - | - | |
| 9 | 支払方法 | payment_method | VARCHAR | 20 | ○ | - | - | |
| 10 | 備考 | remarks | TEXT | - | ○ | - | - | |
| 11 | 適用開始年月日 | effective_start_date | DATE | - | ○ | - | - | |
| 12 | 適用終了年月日 | effective_end_date | DATE | - | ○ | - | - | |
| 13 | 削除日時 | deleted_at | TIMESTAMP | - | ○ | - | - | 論理削除用 |

**外部キー**:
- gravestone_id → gravestones.gravestone_id

---

### 5. 管理料情報テーブル (ManagementFee)

**論理名**: 管理料情報テーブル  
**物理名**: management_fees  
**概要**: 墓石の管理料に関する情報を管理

| No | 論理名 | 物理名 | データ型 | 長さ | NULL | デフォルト | 制約 | 備考 |
|----|--------|--------|----------|------|------|------------|------|------|
| 1 | 管理料情報ID | management_fee_id | INTEGER | - | × | AUTO_INCREMENT | PK | 主キー（自動生成） |
| 2 | 墓石ID | gravestone_id | INTEGER | - | × | - | FK | 外部キー |
| 3 | 計算区分 | calc_type | VARCHAR | 20 | ○ | - | - | |
| 4 | 請求区分 | billing_type | VARCHAR | 20 | ○ | - | - | |
| 5 | 面積 | area | DECIMAL | 10,2 | ○ | - | - | |
| 6 | 管理料 | fee | DECIMAL | 10,2 | × | - | - | |
| 7 | 最終請求年月 | last_billing_date | DATE | - | ○ | - | - | |
| 8 | 税区分 | tax_type | VARCHAR | 20 | ○ | - | - | |
| 9 | 請求年数 | billing_years | INTEGER | - | ○ | - | - | |
| 10 | 請求月 | billing_month | INTEGER | - | ○ | - | - | |
| 11 | 単価 | unit_price | DECIMAL | 10,2 | ○ | - | - | |
| 12 | 支払方法 | payment_method | VARCHAR | 20 | × | - | - | |
| 13 | 備考 | remarks | TEXT | - | ○ | - | - | |
| 14 | 適用開始年月日 | effective_start_date | DATE | - | ○ | - | - | |
| 15 | 適用終了年月日 | effective_end_date | DATE | - | ○ | - | - | |
| 16 | 削除日時 | deleted_at | TIMESTAMP | - | ○ | - | - | 論理削除用 |

**外部キー**:
- gravestone_id → gravestones.gravestone_id

---

### 6. 請求情報テーブル (BillingInfo)

**論理名**: 請求情報テーブル  
**物理名**: billing_infos  
**概要**: 墓石の請求先情報を管理

| No | 論理名 | 物理名 | データ型 | 長さ | NULL | デフォルト | 制約 | 備考 |
|----|--------|--------|----------|------|------|------------|------|------|
| 1 | 請求情報ID | billing_info_id | INTEGER | - | × | AUTO_INCREMENT | PK | 主キー（自動生成） |
| 2 | 墓石ID | gravestone_id | INTEGER | - | × | - | FK | 外部キー |
| 3 | 契約者情報ID | contractor_id | INTEGER | - | × | - | FK | 外部キー |
| 4 | 請求種別 | billing_type | VARCHAR | 20 | ○ | - | - | |
| 5 | 銀行名称 | bank_name | VARCHAR | 50 | ○ | - | - | |
| 6 | 支店名称 | branch_name | VARCHAR | 50 | ○ | - | - | |
| 7 | 口座科目 | account_type | VARCHAR | 20 | ○ | - | - | |
| 8 | 口座番号 | account_number | VARCHAR | 20 | ○ | - | - | |
| 9 | 口座名義 | account_holder | VARCHAR | 100 | ○ | - | - | |
| 10 | 備考 | remarks | TEXT | - | ○ | - | - | |
| 11 | 適用開始年月日 | effective_start_date | DATE | - | ○ | - | - | |
| 12 | 適用終了年月日 | effective_end_date | DATE | - | ○ | - | - | |
| 13 | 削除日時 | deleted_at | TIMESTAMP | - | ○ | - | - | 論理削除用 |

**外部キー**:
- gravestone_id → gravestones.gravestone_id
- contractor_id → contractors.contractor_id

---

### 7. 家族連絡先情報テーブル (FamilyContact)

**論理名**: 家族連絡先情報テーブル  
**物理名**: family_contacts  
**概要**: 契約者の家族連絡先情報を管理

| No | 論理名 | 物理名 | データ型 | 長さ | NULL | デフォルト | 制約 | 備考 |
|----|--------|--------|----------|------|------|------------|------|------|
| 1 | 家族連絡先情報ID | family_contact_id | INTEGER | - | × | AUTO_INCREMENT | PK | 主キー（自動生成） |
| 2 | 墓石ID | gravestone_id | INTEGER | - | × | - | FK | 外部キー |
| 3 | 契約者情報ID | contractor_id | INTEGER | - | × | - | FK | 外部キー |
| 4 | 氏名 | name | VARCHAR | 100 | ○ | - | - | |
| 5 | 生年月日 | birth_date | DATE | - | ○ | - | - | |
| 6 | 続柄 | relation | VARCHAR | 20 | ○ | - | - | |
| 7 | 電話番号 | phone | VARCHAR | 15 | ○ | - | - | |
| 8 | FAX | fax | VARCHAR | 15 | ○ | - | - | |
| 9 | メール | email | VARCHAR | 100 | ○ | - | - | |
| 10 | 住所 | address | VARCHAR | 200 | ○ | - | - | |
| 11 | 本籍住所 | domicile_address | VARCHAR | 200 | ○ | - | - | |
| 12 | 送付先区分 | recipient_type | VARCHAR | 20 | ○ | - | - | |
| 13 | 勤務先名称 | workplace_name | VARCHAR | 100 | ○ | - | - | |
| 14 | 勤務先名称かな | workplace_kana | VARCHAR | 100 | ○ | - | - | |
| 15 | 勤務先住所 | workplace_address | VARCHAR | 200 | ○ | - | - | |
| 16 | 勤務先電話番号 | workplace_phone | VARCHAR | 15 | ○ | - | - | |
| 17 | 備考 | remarks | TEXT | - | ○ | - | - | |
| 18 | 適用開始年月日 | effective_start_date | DATE | - | ○ | - | - | |
| 19 | 適用終了年月日 | effective_end_date | DATE | - | ○ | - | - | |
| 20 | 削除日時 | deleted_at | TIMESTAMP | - | ○ | - | - | 論理削除用 |

**外部キー**:
- gravestone_id → gravestones.gravestone_id
- contractor_id → contractors.contractor_id

---

### 8. 埋葬者情報テーブル (Burial)

**論理名**: 埋葬者情報テーブル  
**物理名**: burials  
**概要**: 墓石に埋葬された方の情報を管理

| No | 論理名 | 物理名 | データ型 | 長さ | NULL | デフォルト | 制約 | 備考 |
|----|--------|--------|----------|------|------|------------|------|------|
| 1 | 埋葬情報ID | burial_id | INTEGER | - | × | AUTO_INCREMENT | PK | 主キー（自動生成） |
| 2 | 墓石ID | gravestone_id | INTEGER | - | × | - | FK | 外部キー |
| 3 | 契約者情報ID | contractor_id | INTEGER | - | × | - | FK | 外部キー |
| 4 | 氏名 | name | VARCHAR | 100 | ○ | - | - | |
| 5 | ふりがな | kana | VARCHAR | 100 | ○ | - | - | |
| 6 | 生年月日 | birth_date | DATE | - | ○ | - | - | |
| 7 | 性別 | gender | VARCHAR | 10 | ○ | - | - | |
| 8 | 戒名 | posthumous_name | VARCHAR | 100 | ○ | - | - | |
| 9 | 命日 | death_date | DATE | - | ○ | - | - | |
| 10 | 享年 | age_at_death | INTEGER | - | ○ | - | - | |
| 11 | 埋葬日 | burial_date | DATE | - | ○ | - | - | |
| 12 | 届出日 | notification_date | DATE | - | ○ | - | - | |
| 13 | 宗派 | denomination | VARCHAR | 20 | ○ | - | - | |
| 14 | 備考 | remarks | TEXT | - | ○ | - | - | |
| 15 | 適用開始年月日 | effective_start_date | DATE | - | ○ | - | - | |
| 16 | 適用終了年月日 | effective_end_date | DATE | - | ○ | - | - | |
| 17 | 削除日時 | deleted_at | TIMESTAMP | - | ○ | - | - | 論理削除用 |

**外部キー**:
- gravestone_id → gravestones.gravestone_id
- contractor_id → contractors.contractor_id

---

### 9. 工事情報テーブル (Construction)

**論理名**: 工事情報テーブル  
**物理名**: constructions  
**概要**: 墓石に関する工事情報を管理

| No | 論理名 | 物理名 | データ型 | 長さ | NULL | デフォルト | 制約 | 備考 |
|----|--------|--------|----------|------|------|------------|------|------|
| 1 | 工事情報ID | construction_id | INTEGER | - | × | AUTO_INCREMENT | PK | 主キー（自動生成） |
| 2 | 墓石ID | gravestone_id | INTEGER | - | × | - | FK | 外部キー |
| 3 | 業者名 | contractor_name | VARCHAR | 100 | ○ | - | - | |
| 4 | 工事開始日 | start_date | DATE | - | ○ | - | - | |
| 5 | 終了予定日 | planned_end_date | DATE | - | ○ | - | - | |
| 6 | 工事終了日 | end_date | DATE | - | ○ | - | - | |
| 7 | 工事内容 | description | TEXT | - | ○ | - | - | |
| 8 | 施工金額 | cost | DECIMAL | 10,2 | ○ | - | - | |
| 9 | 入金金額 | payment_amount | DECIMAL | 10,2 | ○ | - | - | |
| 10 | 工事種別 | construction_type | VARCHAR | 20 | ○ | - | - | |
| 11 | 備考 | remarks | TEXT | - | ○ | - | - | |
| 12 | 削除日時 | deleted_at | TIMESTAMP | - | ○ | - | - | 論理削除用 |

**外部キー**:
- gravestone_id → gravestones.gravestone_id

---

### 10. 履歴情報テーブル (History)

**論理名**: 履歴情報テーブル  
**物理名**: histories  
**概要**: データの変更履歴を管理

| No | 論理名 | 物理名 | データ型 | 長さ | NULL | デフォルト | 制約 | 備考 |
|----|--------|--------|----------|------|------|------------|------|------|
| 1 | 履歴情報ID | history_id | INTEGER | - | × | AUTO_INCREMENT | PK | 主キー（自動生成） |
| 2 | 墓石ID | gravestone_id | INTEGER | - | × | - | FK | 外部キー |
| 3 | 契約者情報ID | contractor_id | INTEGER | - | × | - | FK | 外部キー |
| 4 | 更新前情報ID | before_record_id | INTEGER | - | ○ | - | - | |
| 5 | 更新後情報ID | after_record_id | INTEGER | - | ○ | - | - | |
| 6 | 更新種別 | update_type | VARCHAR | 20 | ○ | - | - | |
| 7 | 更新事由 | update_reason | VARCHAR | 100 | ○ | - | - | |
| 8 | 更新者 | updated_by | VARCHAR | 50 | ○ | - | - | |
| 9 | 更新日時 | updated_at | TIMESTAMP | - | × | - | - | |

**外部キー**:
- gravestone_id → gravestones.gravestone_id
- contractor_id → contractors.contractor_id

---

### 11. スタッフテーブル (Staff)

**論理名**: スタッフテーブル  
**物理名**: staff  
**概要**: システム利用者（スタッフ）の情報を管理

| No | 論理名 | 物理名 | データ型 | 長さ | NULL | デフォルト | 制約 | 備考 |
|----|--------|--------|----------|------|------|------------|------|------|
| 1 | スタッフID | staff_id | INTEGER | - | × | AUTO_INCREMENT | PK | 主キー（自動生成） |
| 2 | スタッフ名 | name | VARCHAR | 100 | × | - | - | |
| 3 | メールアドレス | email | VARCHAR | 100 | × | - | UNIQUE | |
| 4 | パスワード | password | VARCHAR | 255 | × | - | - | ハッシュ化 |
| 5 | ロール | role | VARCHAR | 20 | × | 'viewer' | - | 権限レベル（viewer, operator, manager, admin） |
| 6 | 有効フラグ | is_active | BOOLEAN | - | ○ | TRUE | - | |
| 7 | 最終ログイン日時 | last_login_at | TIMESTAMP | - | ○ | - | - | |
| 8 | 作成日時 | created_at | TIMESTAMP | - | × | CURRENT_TIMESTAMP | - | |
| 9 | 更新日時 | updated_at | TIMESTAMP | - | × | CURRENT_TIMESTAMP | - | 自動更新 |

**インデックス**:
- PRIMARY KEY (staff_id)
- UNIQUE INDEX (email)
- INDEX (role, is_active)

**初期データ例**:
- admin@example.com (role: admin)
- manager@example.com (role: manager)
- operator@example.com (role: operator)
- viewer@example.com (role: viewer)

---

## マスタテーブル詳細

### 12. 利用状況マスタ (UsageStatusMaster)

**論理名**: 利用状況マスタ  
**物理名**: usage_status_master  
**概要**: 墓石の利用状況の区分値を管理

| No | 論理名 | 物理名 | データ型 | 長さ | NULL | デフォルト | 制約 | 備考 |
|----|--------|--------|----------|------|------|------------|------|------|
| 1 | ID | id | INTEGER | - | × | AUTO_INCREMENT | PK | 主キー（自動生成） |
| 2 | コード | code | VARCHAR | 10 | × | - | UNIQUE | 業務キー |
| 3 | 名称 | name | VARCHAR | 50 | × | - | - | 表示名 |
| 4 | 説明 | description | VARCHAR | 200 | ○ | - | - | |
| 5 | 表示順序 | sort_order | INTEGER | - | ○ | - | - | |
| 6 | 有効フラグ | is_active | BOOLEAN | - | × | TRUE | - | |
| 7 | 作成日時 | created_at | TIMESTAMP | - | × | CURRENT_TIMESTAMP | - | |
| 8 | 更新日時 | updated_at | TIMESTAMP | - | × | CURRENT_TIMESTAMP | - | 自動更新 |

**初期データ例**:
- 空き
- 予約済み
- 利用中
- 使用停止
- メンテナンス中

---

### 13. 墓地タイプマスタ (CemeteryTypeMaster)

**論理名**: 墓地タイプマスタ  
**物理名**: cemetery_type_master  
**概要**: 墓地の種類区分値を管理

| No | 論理名 | 物理名 | データ型 | 長さ | NULL | デフォルト | 制約 | 備考 |
|----|--------|--------|----------|------|------|------------|------|------|
| 1 | ID | id | INTEGER | - | × | AUTO_INCREMENT | PK | 主キー（自動生成） |
| 2 | コード | code | VARCHAR | 10 | × | - | UNIQUE | 業務キー |
| 3 | 名称 | name | VARCHAR | 50 | × | - | - | 表示名 |
| 4 | 説明 | description | VARCHAR | 200 | ○ | - | - | |
| 5 | 表示順序 | sort_order | INTEGER | - | ○ | - | - | |
| 6 | 有効フラグ | is_active | BOOLEAN | - | × | TRUE | - | |
| 7 | 作成日時 | created_at | TIMESTAMP | - | × | CURRENT_TIMESTAMP | - | |
| 8 | 更新日時 | updated_at | TIMESTAMP | - | × | CURRENT_TIMESTAMP | - | 自動更新 |

**初期データ例**:
- 公営墓地
- 民営墓地
- 寺院墓地
- 共同墓地
- 納骨堂

---

### 14. 宗派マスタ (DenominationMaster)

**論理名**: 宗派マスタ  
**物理名**: denomination_master  
**概要**: 宗教・宗派の区分値を管理

| No | 論理名 | 物理名 | データ型 | 長さ | NULL | デフォルト | 制約 | 備考 |
|----|--------|--------|----------|------|------|------------|------|------|
| 1 | ID | id | INTEGER | - | × | AUTO_INCREMENT | PK | 主キー（自動生成） |
| 2 | コード | code | VARCHAR | 10 | × | - | UNIQUE | 業務キー |
| 3 | 名称 | name | VARCHAR | 50 | × | - | - | 表示名 |
| 4 | 説明 | description | VARCHAR | 200 | ○ | - | - | |
| 5 | 表示順序 | sort_order | INTEGER | - | ○ | - | - | |
| 6 | 有効フラグ | is_active | BOOLEAN | - | × | TRUE | - | |
| 7 | 作成日時 | created_at | TIMESTAMP | - | × | CURRENT_TIMESTAMP | - | |
| 8 | 更新日時 | updated_at | TIMESTAMP | - | × | CURRENT_TIMESTAMP | - | 自動更新 |

**初期データ例**:
- 浄土真宗
- 浄土宗
- 真言宗
- 曹洞宗
- 臨済宗
- 日蓮宗
- 天台宗
- その他仏教
- 神道
- キリスト教
- 無宗教

---

### 15. 性別マスタ (GenderMaster)

**論理名**: 性別マスタ  
**物理名**: gender_master  
**概要**: 性別の区分値を管理

| No | 論理名 | 物理名 | データ型 | 長さ | NULL | デフォルト | 制約 | 備考 |
|----|--------|--------|----------|------|------|------------|------|------|
| 1 | ID | id | INTEGER | - | × | AUTO_INCREMENT | PK | 主キー（自動生成） |
| 2 | コード | code | VARCHAR | 10 | × | - | UNIQUE | 業務キー |
| 3 | 名称 | name | VARCHAR | 50 | × | - | - | 表示名 |
| 4 | 説明 | description | VARCHAR | 200 | ○ | - | - | |
| 5 | 表示順序 | sort_order | INTEGER | - | ○ | - | - | |
| 6 | 有効フラグ | is_active | BOOLEAN | - | × | TRUE | - | |
| 7 | 作成日時 | created_at | TIMESTAMP | - | × | CURRENT_TIMESTAMP | - | |
| 8 | 更新日時 | updated_at | TIMESTAMP | - | × | CURRENT_TIMESTAMP | - | 自動更新 |

**初期データ例**:
- 男性
- 女性
- その他
- 不明

---

### 16. 支払方法マスタ (PaymentMethodMaster)

**論理名**: 支払方法マスタ  
**物理名**: payment_method_master  
**概要**: 支払い方法の区分値を管理

| No | 論理名 | 物理名 | データ型 | 長さ | NULL | デフォルト | 制約 | 備考 |
|----|--------|--------|----------|------|------|------------|------|------|
| 1 | ID | id | INTEGER | - | × | AUTO_INCREMENT | PK | 主キー（自動生成） |
| 2 | コード | code | VARCHAR | 10 | × | - | UNIQUE | 業務キー |
| 3 | 名称 | name | VARCHAR | 50 | × | - | - | 表示名 |
| 4 | 説明 | description | VARCHAR | 200 | ○ | - | - | |
| 5 | 表示順序 | sort_order | INTEGER | - | ○ | - | - | |
| 6 | 有効フラグ | is_active | BOOLEAN | - | × | TRUE | - | |
| 7 | 作成日時 | created_at | TIMESTAMP | - | × | CURRENT_TIMESTAMP | - | |
| 8 | 更新日時 | updated_at | TIMESTAMP | - | × | CURRENT_TIMESTAMP | - | 自動更新 |

**初期データ例**:
- 現金
- 銀行振込
- 口座振替
- クレジットカード
- 分割払い

---

### 17. 税区分マスタ (TaxTypeMaster)

**論理名**: 税区分マスタ  
**物理名**: tax_type_master  
**概要**: 税金の種類と税率を管理

| No | 論理名 | 物理名 | データ型 | 長さ | NULL | デフォルト | 制約 | 備考 |
|----|--------|--------|----------|------|------|------------|------|------|
| 1 | ID | id | INTEGER | - | × | AUTO_INCREMENT | PK | 主キー（自動生成） |
| 2 | コード | code | VARCHAR | 10 | × | - | UNIQUE | 業務キー |
| 3 | 名称 | name | VARCHAR | 50 | × | - | - | 表示名 |
| 4 | 税率 | tax_rate | DECIMAL | 5,2 | ○ | - | - | パーセンテージ |
| 5 | 説明 | description | VARCHAR | 200 | ○ | - | - | |
| 6 | 表示順序 | sort_order | INTEGER | - | ○ | - | - | |
| 7 | 有効フラグ | is_active | BOOLEAN | - | × | TRUE | - | |
| 8 | 作成日時 | created_at | TIMESTAMP | - | × | CURRENT_TIMESTAMP | - | |
| 9 | 更新日時 | updated_at | TIMESTAMP | - | × | CURRENT_TIMESTAMP | - | 自動更新 |

**初期データ例**:
- 非課税 (0.00%)
- 消費税8% (8.00%)
- 消費税10% (10.00%)

---

### 18. 計算区分マスタ (CalcTypeMaster)

**論理名**: 計算区分マスタ  
**物理名**: calc_type_master  
**概要**: 料金計算方法の区分値を管理

| No | 論理名 | 物理名 | データ型 | 長さ | NULL | デフォルト | 制約 | 備考 |
|----|--------|--------|----------|------|------|------------|------|------|
| 1 | ID | id | INTEGER | - | × | AUTO_INCREMENT | PK | 主キー（自動生成） |
| 2 | コード | code | VARCHAR | 10 | × | - | UNIQUE | 業務キー |
| 3 | 名称 | name | VARCHAR | 50 | × | - | - | 表示名 |
| 4 | 説明 | description | VARCHAR | 200 | ○ | - | - | |
| 5 | 表示順序 | sort_order | INTEGER | - | ○ | - | - | |
| 6 | 有効フラグ | is_active | BOOLEAN | - | × | TRUE | - | |
| 7 | 作成日時 | created_at | TIMESTAMP | - | × | CURRENT_TIMESTAMP | - | |
| 8 | 更新日時 | updated_at | TIMESTAMP | - | × | CURRENT_TIMESTAMP | - | 自動更新 |

**初期データ例**:
- 面積単価
- 一律料金
- 階段料金
- 基本料金＋従量

---

### 19. 請求区分マスタ (BillingTypeMaster)

**論理名**: 請求区分マスタ  
**物理名**: billing_type_master  
**概要**: 請求の種類区分値を管理

| No | 論理名 | 物理名 | データ型 | 長さ | NULL | デフォルト | 制約 | 備考 |
|----|--------|--------|----------|------|------|------------|------|------|
| 1 | ID | id | INTEGER | - | × | AUTO_INCREMENT | PK | 主キー（自動生成） |
| 2 | コード | code | VARCHAR | 10 | × | - | UNIQUE | 業務キー |
| 3 | 名称 | name | VARCHAR | 50 | × | - | - | 表示名 |
| 4 | 説明 | description | VARCHAR | 200 | ○ | - | - | |
| 5 | 表示順序 | sort_order | INTEGER | - | ○ | - | - | |
| 6 | 有効フラグ | is_active | BOOLEAN | - | × | TRUE | - | |
| 7 | 作成日時 | created_at | TIMESTAMP | - | × | CURRENT_TIMESTAMP | - | |
| 8 | 更新日時 | updated_at | TIMESTAMP | - | × | CURRENT_TIMESTAMP | - | 自動更新 |

**初期データ例**:
- 年次請求
- 月次請求
- 一括請求
- 臨時請求

---

### 20. 口座科目マスタ (AccountTypeMaster)

**論理名**: 口座科目マスタ  
**物理名**: account_type_master  
**概要**: 銀行口座の種類区分値を管理

| No | 論理名 | 物理名 | データ型 | 長さ | NULL | デフォルト | 制約 | 備考 |
|----|--------|--------|----------|------|------|------------|------|------|
| 1 | ID | id | INTEGER | - | × | AUTO_INCREMENT | PK | 主キー（自動生成） |
| 2 | コード | code | VARCHAR | 10 | × | - | UNIQUE | 業務キー |
| 3 | 名称 | name | VARCHAR | 50 | × | - | - | 表示名 |
| 4 | 説明 | description | VARCHAR | 200 | ○ | - | - | |
| 5 | 表示順序 | sort_order | INTEGER | - | ○ | - | - | |
| 6 | 有効フラグ | is_active | BOOLEAN | - | × | TRUE | - | |
| 7 | 作成日時 | created_at | TIMESTAMP | - | × | CURRENT_TIMESTAMP | - | |
| 8 | 更新日時 | updated_at | TIMESTAMP | - | × | CURRENT_TIMESTAMP | - | 自動更新 |

**初期データ例**:
- 普通預金
- 当座預金
- 定期預金
- 貯蓄預金

---

### 21. 宛先区分マスタ (RecipientTypeMaster)

**論理名**: 宛先区分マスタ  
**物理名**: recipient_type_master  
**概要**: 郵送物の宛先区分値を管理

| No | 論理名 | 物理名 | データ型 | 長さ | NULL | デフォルト | 制約 | 備考 |
|----|--------|--------|----------|------|------|------------|------|------|
| 1 | ID | id | INTEGER | - | × | AUTO_INCREMENT | PK | 主キー（自動生成） |
| 2 | コード | code | VARCHAR | 10 | × | - | UNIQUE | 業務キー |
| 3 | 名称 | name | VARCHAR | 50 | × | - | - | 表示名 |
| 4 | 説明 | description | VARCHAR | 200 | ○ | - | - | |
| 5 | 表示順序 | sort_order | INTEGER | - | ○ | - | - | |
| 6 | 有効フラグ | is_active | BOOLEAN | - | × | TRUE | - | |
| 7 | 作成日時 | created_at | TIMESTAMP | - | × | CURRENT_TIMESTAMP | - | |
| 8 | 更新日時 | updated_at | TIMESTAMP | - | × | CURRENT_TIMESTAMP | - | 自動更新 |

**初期データ例**:
- 契約者住所
- 勤務先住所
- 家族住所
- その他住所

---

### 22. 続柄マスタ (RelationMaster)

**論理名**: 続柄マスタ  
**物理名**: relation_master  
**概要**: 家族関係の区分値を管理

| No | 論理名 | 物理名 | データ型 | 長さ | NULL | デフォルト | 制約 | 備考 |
|----|--------|--------|----------|------|------|------------|------|------|
| 1 | ID | id | INTEGER | - | × | AUTO_INCREMENT | PK | 主キー（自動生成） |
| 2 | コード | code | VARCHAR | 10 | × | - | UNIQUE | 業務キー |
| 3 | 名称 | name | VARCHAR | 50 | × | - | - | 表示名 |
| 4 | 説明 | description | VARCHAR | 200 | ○ | - | - | |
| 5 | 表示順序 | sort_order | INTEGER | - | ○ | - | - | |
| 6 | 有効フラグ | is_active | BOOLEAN | - | × | TRUE | - | |
| 7 | 作成日時 | created_at | TIMESTAMP | - | × | CURRENT_TIMESTAMP | - | |
| 8 | 更新日時 | updated_at | TIMESTAMP | - | × | CURRENT_TIMESTAMP | - | 自動更新 |

**初期データ例**:
- 配偶者
- 子
- 父
- 母
- 兄弟姉妹
- 祖父母
- 孫
- その他親族
- 友人・知人

---

### 23. 工事種別マスタ (ConstructionTypeMaster)

**論理名**: 工事種別マスタ  
**物理名**: construction_type_master  
**概要**: 工事の種類区分値を管理

| No | 論理名 | 物理名 | データ型 | 長さ | NULL | デフォルト | 制約 | 備考 |
|----|--------|--------|----------|------|------|------------|------|------|
| 1 | ID | id | INTEGER | - | × | AUTO_INCREMENT | PK | 主キー（自動生成） |
| 2 | コード | code | VARCHAR | 10 | × | - | UNIQUE | 業務キー |
| 3 | 名称 | name | VARCHAR | 50 | × | - | - | 表示名 |
| 4 | 説明 | description | VARCHAR | 200 | ○ | - | - | |
| 5 | 表示順序 | sort_order | INTEGER | - | ○ | - | - | |
| 6 | 有効フラグ | is_active | BOOLEAN | - | × | TRUE | - | |
| 7 | 作成日時 | created_at | TIMESTAMP | - | × | CURRENT_TIMESTAMP | - | |
| 8 | 更新日時 | updated_at | TIMESTAMP | - | × | CURRENT_TIMESTAMP | - | 自動更新 |

**初期データ例**:
- 新規建立
- 改修工事
- 追加彫刻
- 清掃・メンテナンス
- 撤去工事

---

### 24. 更新種別マスタ (UpdateTypeMaster)

**論理名**: 更新種別マスタ  
**物理名**: update_type_master  
**概要**: 履歴の更新種別区分値を管理

| No | 論理名 | 物理名 | データ型 | 長さ | NULL | デフォルト | 制約 | 備考 |
|----|--------|--------|----------|------|------|------------|------|------|
| 1 | ID | id | INTEGER | - | × | AUTO_INCREMENT | PK | 主キー（自動生成） |
| 2 | コード | code | VARCHAR | 10 | × | - | UNIQUE | 業務キー |
| 3 | 名称 | name | VARCHAR | 50 | × | - | - | 表示名 |
| 4 | 説明 | description | VARCHAR | 200 | ○ | - | - | |
| 5 | 表示順序 | sort_order | INTEGER | - | ○ | - | - | |
| 6 | 有効フラグ | is_active | BOOLEAN | - | × | TRUE | - | |
| 7 | 作成日時 | created_at | TIMESTAMP | - | × | CURRENT_TIMESTAMP | - | |
| 8 | 更新日時 | updated_at | TIMESTAMP | - | × | CURRENT_TIMESTAMP | - | 自動更新 |

**初期データ例**:
- 新規登録
- 更新
- 削除
- 復旧
- 状態変更

---

### 25. 都道府県マスタ (PrefectureMaster)

**論理名**: 都道府県マスタ  
**物理名**: prefecture_master  
**概要**: 都道府県コードと名称を管理

| No | 論理名 | 物理名 | データ型 | 長さ | NULL | デフォルト | 制約 | 備考 |
|----|--------|--------|----------|------|------|------------|------|------|
| 1 | ID | id | INTEGER | - | × | AUTO_INCREMENT | PK | 主キー（自動生成） |
| 2 | コード | code | VARCHAR | 2 | × | - | UNIQUE | JIS都道府県コード |
| 3 | 名称 | name | VARCHAR | 10 | × | - | - | 都道府県名 |
| 4 | 名称かな | name_kana | VARCHAR | 20 | ○ | - | - | ひらがな表記 |
| 5 | 表示順序 | sort_order | INTEGER | - | ○ | - | - | |
| 6 | 有効フラグ | is_active | BOOLEAN | - | × | TRUE | - | |
| 7 | 作成日時 | created_at | TIMESTAMP | - | × | CURRENT_TIMESTAMP | - | |
| 8 | 更新日時 | updated_at | TIMESTAMP | - | × | CURRENT_TIMESTAMP | - | 自動更新 |

**初期データ例**:
- 01: 北海道
- 02: 青森県
- 03: 岩手県
- ... (47都道府県すべて)

---

## リレーション定義

### 主要なリレーション

#### 1. 墓石 → 申込者 (1:1)
- `gravestones.gravestone_id` ← `applicants.gravestone_id`

#### 2. 墓石 → 契約者 (1:N)
- `gravestones.gravestone_id` ← `contractors.gravestone_id`

#### 3. 墓石 → 使用料 (1:N)
- `gravestones.gravestone_id` ← `usage_fees.gravestone_id`

#### 4. 墓石 → 管理料 (1:N)
- `gravestones.gravestone_id` ← `management_fees.gravestone_id`

#### 5. 墓石 + 契約者 → 請求情報 (N:N)
- `gravestones.gravestone_id` ← `billing_infos.gravestone_id`
- `contractors.contractor_id` ← `billing_infos.contractor_id`

#### 6. 墓石 + 契約者 → 家族連絡先 (N:N)
- `gravestones.gravestone_id` ← `family_contacts.gravestone_id`
- `contractors.contractor_id` ← `family_contacts.contractor_id`

#### 7. 墓石 + 契約者 → 埋葬情報 (N:N)
- `gravestones.gravestone_id` ← `burials.gravestone_id`
- `contractors.contractor_id` ← `burials.contractor_id`

#### 8. 墓石 → 工事情報 (1:N)
- `gravestones.gravestone_id` ← `constructions.gravestone_id`

#### 9. 墓石 + 契約者 → 履歴 (N:N)
- `gravestones.gravestone_id` ← `histories.gravestone_id`
- `contractors.contractor_id` ← `histories.contractor_id`

### マスタテーブルとの参照関係

各業務テーブルの区分値フィールドは、対応するマスタテーブルのcodeフィールドを参照します。

---

## インデックス設計

### 主要インデックス

#### パフォーマンス向上のための複合インデックス

```sql
-- 墓石検索用
CREATE INDEX idx_gravestone_status_type ON gravestones(usage_status, cemetery_type);

-- 契約者検索用
CREATE INDEX idx_contractor_name_kana ON contractors(name, kana);
CREATE INDEX idx_contractor_phone ON contractors(phone);

-- 料金検索用
CREATE INDEX idx_usage_fee_gravestone_effective ON usage_fees(gravestone_id, effective_start_date, effective_end_date);
CREATE INDEX idx_management_fee_gravestone_effective ON management_fees(gravestone_id, effective_start_date, effective_end_date);

-- 履歴検索用
CREATE INDEX idx_history_gravestone_updated ON histories(gravestone_id, updated_at);
CREATE INDEX idx_history_contractor_updated ON histories(contractor_id, updated_at);

-- 論理削除対応
CREATE INDEX idx_gravestone_deleted ON gravestones(deleted_at);
CREATE INDEX idx_contractor_deleted ON contractors(deleted_at);
```

---

## セキュリティ要件

### データ保護

1. **個人情報の暗号化**
   - パスワードはハッシュ化（bcrypt推奨）
   - 機密性の高い個人情報は暗号化対象

2. **アクセス制御**
   - スタッフテーブルによる認証・認可
   - ロールベースアクセス制御の実装

3. **監査ログ**
   - Historyテーブルによる変更履歴管理
   - 全ての重要な操作をログ記録

### データ整合性

1. **外部キー制約**
   - 参照整合性の確保
   - CASCADE/RESTRICT設定

2. **チェック制約**
   - 論理的なデータ整合性確保
   - 範囲チェック・フォーマットチェック

3. **トランザクション管理**
   - 複数テーブル更新時の整合性保証

---

## バックアップ・復旧戦略

### バックアップ要件

1. **定期バックアップ**
   - 日次フルバックアップ
   - 時間単位の差分バックアップ

2. **ポイントインタイム復旧**
   - WALログによる任意時点復旧
   - RPO: 1時間以内

3. **災害対策**
   - 異なる地理的場所への複製
   - クラウドストレージへのバックアップ

---

## パフォーマンス要件

### レスポンス時間目標

- 単純検索: 100ms以内
- 複雑検索: 1秒以内
- レポート生成: 10秒以内

### スケーラビリティ

- 想定データ量: 墓石10万件、契約者20万件
- 同時接続ユーザー: 100人
- データ保存期間: 永続（論理削除）

---

## 運用要件

### メンテナンス

1. **統計情報更新**
   - 定期的なANALYZE実行
   - インデックス再構築

2. **容量監視**
   - ディスク使用量監視
   - ログファイル管理

3. **マスタデータ管理**
   - 定期的なマスタデータ見直し
   - 無効データのクリーンアップ

### 移行・展開

1. **データ移行**
   - 既存システムからの移行手順
   - データ整合性チェック

2. **バージョン管理**
   - スキーマ変更の管理
   - ロールバック手順

---

以上が墓石管理システムのデータベース仕様書です。この仕様書を基にPrismaスキーマファイルを作成してください。