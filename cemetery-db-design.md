# 霊園管理システム データベース設計書

## 1. システム概要
霊園の契約管理、埋葬管理、工事管理を行うシステムのデータベース設計

## 2. テーブル一覧

### 2.1 マスターテーブル

#### staff (担当者)
| カラム名 | データ型 | NULL | キー | デフォルト | 説明 |
|---------|---------|------|------|-----------|------|
| id | INT | NO | PK | AUTO_INCREMENT | 担当者ID |
| name | VARCHAR(100) | NO | | | 担当者名 |
| email | VARCHAR(255) | YES | | | メールアドレス |
| is_active | BOOLEAN | NO | | TRUE | 有効フラグ |
| created_at | DATETIME | NO | | CURRENT_TIMESTAMP | 作成日時 |
| updated_at | DATETIME | NO | | CURRENT_TIMESTAMP | 更新日時 |

#### payment_methods (支払方法)
| カラム名 | データ型 | NULL | キー | デフォルト | 説明 |
|---------|---------|------|------|-----------|------|
| id | INT | NO | PK | AUTO_INCREMENT | 支払方法ID |
| name | VARCHAR(50) | NO | UNIQUE | | 支払方法名 |
| created_at | DATETIME | NO | | CURRENT_TIMESTAMP | 作成日時 |

#### grave_types (墓地タイプ)
| カラム名 | データ型 | NULL | キー | デフォルト | 説明 |
|---------|---------|------|------|-----------|------|
| id | INT | NO | PK | AUTO_INCREMENT | 墓地タイプID |
| code | VARCHAR(20) | NO | UNIQUE | | タイプコード |
| name | VARCHAR(100) | NO | | | タイプ名 |
| created_at | DATETIME | NO | | CURRENT_TIMESTAMP | 作成日時 |

#### religious_sects (宗派)
| カラム名 | データ型 | NULL | キー | デフォルト | 説明 |
|---------|---------|------|------|-----------|------|
| id | INT | NO | PK | AUTO_INCREMENT | 宗派ID |
| name | VARCHAR(100) | NO | UNIQUE | | 宗派名 |
| created_at | DATETIME | NO | | CURRENT_TIMESTAMP | 作成日時 |

### 2.2 トランザクションテーブル

#### contracts (契約)
| カラム名 | データ型 | NULL | キー | デフォルト | 説明 |
|---------|---------|------|------|-----------|------|
| id | INT | NO | PK | AUTO_INCREMENT | 契約ID |
| contract_number | VARCHAR(50) | NO | UNIQUE | | 承諾書番号 |
| application_date | DATE | NO | | | 申込日 |
| reservation_date | DATE | YES | | | 予約日 |
| permission_date | DATE | NO | | | 許可日 |
| start_date | DATE | NO | | | 開始年月日 |
| staff_id | INT | YES | FK | | 担当者ID |
| status | ENUM('active','terminated','suspended') | NO | | 'active' | 契約状態 |
| created_at | DATETIME | NO | | CURRENT_TIMESTAMP | 作成日時 |
| updated_at | DATETIME | NO | | CURRENT_TIMESTAMP | 更新日時 |

#### applicants (申込者)
| カラム名 | データ型 | NULL | キー | デフォルト | 説明 |
|---------|---------|------|------|-----------|------|
| id | INT | NO | PK | AUTO_INCREMENT | 申込者ID |
| contract_id | INT | NO | FK,UNIQUE | | 契約ID |
| name | VARCHAR(100) | NO | | | 氏名 |
| name_kana | VARCHAR(100) | NO | | | ふりがな |
| postal_code | VARCHAR(10) | NO | | | 郵便番号 |
| address1 | VARCHAR(255) | NO | | | 住所1 |
| address2 | VARCHAR(255) | NO | | | 住所2 |
| phone1 | VARCHAR(20) | NO | | | 電話番号1 |
| phone2 | VARCHAR(20) | YES | | | 電話番号2 |
| created_at | DATETIME | NO | | CURRENT_TIMESTAMP | 作成日時 |
| updated_at | DATETIME | NO | | CURRENT_TIMESTAMP | 更新日時 |

#### contractors (契約者)
| カラム名 | データ型 | NULL | キー | デフォルト | 説明 |
|---------|---------|------|------|-----------|------|
| id | INT | NO | PK | AUTO_INCREMENT | 契約者ID |
| contract_id | INT | NO | FK | | 契約ID |
| name | VARCHAR(100) | NO | INDEX | | 氏名 |
| name_kana | VARCHAR(100) | NO | INDEX | | ふりがな |
| birth_date | DATE | NO | | | 生年月日 |
| gender | ENUM('male','female','other') | NO | | | 性別 |
| postal_code | VARCHAR(10) | NO | | | 郵便番号 |
| address1 | VARCHAR(255) | NO | | | 住所1 |
| address2 | VARCHAR(255) | NO | | | 住所2 |
| phone1 | VARCHAR(20) | NO | | | 電話番号1 |
| phone2 | VARCHAR(20) | YES | | | 電話番号2 |
| fax | VARCHAR(20) | YES | | | FAX |
| email | VARCHAR(255) | YES | | | メールアドレス |
| permanent_address1 | VARCHAR(255) | NO | | | 本籍住所1 |
| permanent_address2 | VARCHAR(255) | NO | | | 本籍住所2 |
| is_current | BOOLEAN | NO | | TRUE | 現在の契約者フラグ |
| created_at | DATETIME | NO | | CURRENT_TIMESTAMP | 作成日時 |
| updated_at | DATETIME | NO | | CURRENT_TIMESTAMP | 更新日時 |

#### contractor_details (契約者詳細)
| カラム名 | データ型 | NULL | キー | デフォルト | 説明 |
|---------|---------|------|------|-----------|------|
| id | INT | NO | PK | AUTO_INCREMENT | 詳細ID |
| contractor_id | INT | NO | FK,UNIQUE | | 契約者ID |
| workplace_name | VARCHAR(255) | YES | | | 勤務先名称 |
| workplace_kana | VARCHAR(255) | YES | | | 勤務先かな |
| workplace_address | VARCHAR(500) | YES | | | 勤務先住所 |
| workplace_phone1 | VARCHAR(20) | YES | | | 勤務先電話番号1 |
| workplace_phone2 | VARCHAR(20) | YES | | | 勤務先電話番号2 |
| dm_setting | ENUM('send','not_send') | NO | | 'send' | DM設定 |
| mailing_address_type | ENUM('home','workplace','other') | NO | | 'home' | 宛先区分 |
| notes | TEXT | YES | | | 備考 |
| created_at | DATETIME | NO | | CURRENT_TIMESTAMP | 作成日時 |
| updated_at | DATETIME | NO | | CURRENT_TIMESTAMP | 更新日時 |

#### usage_fees (使用料)
| カラム名 | データ型 | NULL | キー | デフォルト | 説明 |
|---------|---------|------|------|-----------|------|
| id | INT | NO | PK | AUTO_INCREMENT | 使用料ID |
| contract_id | INT | NO | FK,UNIQUE | | 契約ID |
| calculation_type | VARCHAR(50) | NO | | | 計算区分 |
| tax_type | ENUM('tax_included','tax_excluded') | NO | | | 税区分 |
| billing_type | VARCHAR(50) | NO | | | 請求区分 |
| billing_years | INT | NO | | | 請求年数 |
| area | DECIMAL(10,2) | NO | | | 面積（㎡） |
| unit_price | DECIMAL(10,2) | YES | | | 単価 |
| total_amount | DECIMAL(10,2) | NO | | | 使用料 |
| payment_method_id | INT | NO | FK | | 支払方法ID |
| created_at | DATETIME | NO | | CURRENT_TIMESTAMP | 作成日時 |
| updated_at | DATETIME | NO | | CURRENT_TIMESTAMP | 更新日時 |

#### management_fees (管理料)
| カラム名 | データ型 | NULL | キー | デフォルト | 説明 |
|---------|---------|------|------|-----------|------|
| id | INT | NO | PK | AUTO_INCREMENT | 管理料ID |
| contract_id | INT | NO | FK,UNIQUE | | 契約ID |
| calculation_type | VARCHAR(50) | NO | | | 計算区分 |
| tax_type | ENUM('tax_included','tax_excluded') | NO | | | 税区分 |
| billing_type | VARCHAR(50) | NO | | | 請求区分 |
| billing_years | INT | NO | | | 請求年数 |
| area | DECIMAL(10,2) | NO | | | 面積（㎡） |
| billing_month_interval | INT | NO | | | 請求月間隔 |
| management_fee | DECIMAL(10,2) | NO | | | 管理料 |
| unit_price | DECIMAL(10,2) | YES | | | 単価 |
| last_billing_month | DATE | NO | | | 最終請求月 |
| payment_method_id | INT | NO | FK | | 支払方法ID |
| created_at | DATETIME | NO | | CURRENT_TIMESTAMP | 作成日時 |
| updated_at | DATETIME | NO | | CURRENT_TIMESTAMP | 更新日時 |

#### gravestones (墓石)
| カラム名 | データ型 | NULL | キー | デフォルト | 説明 |
|---------|---------|------|------|-----------|------|
| id | INT | NO | PK | AUTO_INCREMENT | 墓石ID |
| contract_id | INT | NO | FK,UNIQUE | | 契約ID |
| gravestone_price | DECIMAL(10,2) | NO | | | 墓石代 |
| direction | VARCHAR(50) | YES | | | 方位 |
| location | VARCHAR(255) | YES | | | 位置 |
| dealer | VARCHAR(100) | NO | | | 墓石取扱 |
| grave_type_id | INT | NO | FK | | 墓地タイプID |
| religious_sect_id | INT | YES | FK | | 宗派ID |
| inscription | TEXT | YES | | | 碑文 |
| construction_deadline | DATE | YES | | | 建立期限 |
| construction_date | DATE | YES | | | 建立日 |
| memorial_tablet | TEXT | YES | | | 墓誌 |
| created_at | DATETIME | NO | | CURRENT_TIMESTAMP | 作成日時 |
| updated_at | DATETIME | NO | | CURRENT_TIMESTAMP | 更新日時 |

#### billing_accounts (請求口座情報)
| カラム名 | データ型 | NULL | キー | デフォルト | 説明 |
|---------|---------|------|------|-----------|------|
| id | INT | NO | PK | AUTO_INCREMENT | 請求口座ID |
| contract_id | INT | NO | FK,UNIQUE | | 契約ID |
| billing_type | VARCHAR(50) | YES | | | 請求種別 |
| institution_name | VARCHAR(100) | YES | | | 機関名称 |
| branch_name | VARCHAR(100) | YES | | | 支店名称 |
| account_type | VARCHAR(50) | YES | | | 口座科目 |
| account_number | VARCHAR(50) | YES | | | 記号番号 |
| account_holder | VARCHAR(100) | YES | | | 口座名義 |
| created_at | DATETIME | NO | | CURRENT_TIMESTAMP | 作成日時 |
| updated_at | DATETIME | NO | | CURRENT_TIMESTAMP | 更新日時 |

#### family_contacts (連絡先/家族)
| カラム名 | データ型 | NULL | キー | デフォルト | 説明 |
|---------|---------|------|------|-----------|------|
| id | INT | NO | PK | AUTO_INCREMENT | 連絡先ID |
| contract_id | INT | NO | FK,INDEX | | 契約ID |
| name | VARCHAR(100) | NO | | | 氏名 |
| name_kana | VARCHAR(100) | NO | | | ふりがな |
| birth_date | DATE | YES | | | 生年月日 |
| relationship | VARCHAR(50) | YES | | | 続柄 |
| postal_code | VARCHAR(10) | YES | | | 郵便番号 |
| address1 | VARCHAR(255) | YES | | | 住所1 |
| address2 | VARCHAR(255) | YES | | | 住所2 |
| address3 | VARCHAR(255) | YES | | | 住所3 |
| phone1 | VARCHAR(20) | NO | | | 電話番号1 |
| phone2 | VARCHAR(20) | YES | | | 電話番号2 |
| fax | VARCHAR(20) | YES | | | FAX |
| email | VARCHAR(255) | YES | | | メールアドレス |
| permanent_address | VARCHAR(500) | YES | | | 本籍住所 |
| mailing_address_type | ENUM('home','workplace','other') | NO | | 'home' | 送付先区分 |
| workplace_name | VARCHAR(255) | YES | | | 勤務先名称 |
| workplace_kana | VARCHAR(255) | YES | | | 勤務先かな |
| workplace_postal_code | VARCHAR(10) | YES | | | 勤務先郵便番号 |
| workplace_address1 | VARCHAR(255) | YES | | | 勤務先住所1 |
| workplace_address2 | VARCHAR(255) | YES | | | 勤務先住所2 |
| workplace_address3 | VARCHAR(255) | YES | | | 勤務先住所3 |
| workplace_phone1 | VARCHAR(20) | YES | | | 勤務先電話番号1 |
| workplace_phone2 | VARCHAR(20) | YES | | | 勤務先電話番号2 |
| notes | TEXT | YES | | | 備考 |
| created_at | DATETIME | NO | | CURRENT_TIMESTAMP | 作成日時 |
| updated_at | DATETIME | NO | | CURRENT_TIMESTAMP | 更新日時 |

#### burials (埋葬情報)
| カラム名 | データ型 | NULL | キー | デフォルト | 説明 |
|---------|---------|------|------|-----------|------|
| id | INT | NO | PK | AUTO_INCREMENT | 埋葬ID |
| contract_id | INT | NO | FK,INDEX | | 契約ID |
| name | VARCHAR(100) | NO | INDEX | | 氏名 |
| name_kana | VARCHAR(100) | NO | | | ふりがな |
| birth_date | DATE | YES | | | 生年月日 |
| gender | ENUM('male','female','other') | NO | | | 性別 |
| posthumous_name1 | VARCHAR(100) | YES | | | 戒名1 |
| posthumous_name2 | VARCHAR(100) | YES | | | 戒名2 |
| death_date | DATE | NO | | | 命日 |
| age_at_death | INT | YES | | | 享年 |
| burial_date | DATE | NO | INDEX | | 埋葬日 |
| notification_date | DATE | YES | | | 届出日 |
| religious_sect_id | INT | YES | FK | | 宗派ID |
| memo | TEXT | YES | | | メモ |
| created_at | DATETIME | NO | | CURRENT_TIMESTAMP | 作成日時 |
| updated_at | DATETIME | NO | | CURRENT_TIMESTAMP | 更新日時 |

#### constructions (工事情報)
| カラム名 | データ型 | NULL | キー | デフォルト | 説明 |
|---------|---------|------|------|-----------|------|
| id | INT | NO | PK | AUTO_INCREMENT | 工事ID |
| contract_id | INT | NO | FK,INDEX | | 契約ID |
| contractor_name | VARCHAR(100) | YES | | | 業者名 |
| start_date | DATE | YES | INDEX | | 工事開始日 |
| scheduled_end_date | DATE | YES | | | 終了予定日 |
| end_date | DATE | YES | | | 工事終了日 |
| construction_details | TEXT | YES | | | 工事内容 |
| construction_amount | DECIMAL(10,2) | YES | | | 施工金額 |
| payment_amount | DECIMAL(10,2) | YES | | | 入金金額 |
| construction_type | VARCHAR(50) | YES | | | 工事種別 |
| notes | TEXT | YES | | | 備考 |
| created_at | DATETIME | NO | | CURRENT_TIMESTAMP | 作成日時 |
| updated_at | DATETIME | NO | | CURRENT_TIMESTAMP | 更新日時 |

#### contractor_histories (契約者履歴)
| カラム名 | データ型 | NULL | キー | デフォルト | 説明 |
|---------|---------|------|------|-----------|------|
| id | INT | NO | PK | AUTO_INCREMENT | 履歴ID |
| contract_id | INT | NO | FK,INDEX | | 契約ID |
| contractor_id | INT | NO | FK | | 契約者ID |
| name | VARCHAR(100) | NO | | | 氏名 |
| name_kana | VARCHAR(100) | NO | | | ふりがな |
| birth_date | DATE | NO | | | 生年月日 |
| postal_code | VARCHAR(10) | NO | | | 郵便番号 |
| address1 | VARCHAR(255) | NO | | | 住所1 |
| address2 | VARCHAR(255) | NO | | | 住所2 |
| phone1 | VARCHAR(20) | NO | | | 電話番号1 |
| phone2 | VARCHAR(20) | YES | | | 電話番号2 |
| fax | VARCHAR(20) | YES | | | FAX |
| email | VARCHAR(255) | YES | | | メールアドレス |
| workplace_name | VARCHAR(255) | YES | | | 勤務先名称 |
| workplace_kana | VARCHAR(255) | YES | | | 勤務先かな |
| workplace_postal_code | VARCHAR(10) | YES | | | 勤務先郵便番号 |
| workplace_address1 | VARCHAR(255) | YES | | | 勤務先住所1 |
| workplace_address2 | VARCHAR(255) | YES | | | 勤務先住所2 |
| workplace_phone1 | VARCHAR(20) | YES | | | 勤務先電話番号1 |
| workplace_phone2 | VARCHAR(20) | YES | | | 勤務先電話番号2 |
| change_date | DATE | NO | INDEX | | 変更日 |
| change_reason | TEXT | YES | | | 変更理由 |
| created_at | DATETIME | NO | | CURRENT_TIMESTAMP | 作成日時 |

## 3. リレーションシップ

### 3.1 主要なリレーション
- **contracts** → **applicants**: 1対1
- **contracts** → **contractors**: 1対多（現在の契約者は is_current = true）
- **contracts** → **usage_fees**: 1対1
- **contracts** → **management_fees**: 1対1
- **contracts** → **gravestones**: 1対1
- **contracts** → **billing_accounts**: 1対1
- **contracts** → **family_contacts**: 1対多
- **contracts** → **burials**: 1対多
- **contracts** → **constructions**: 1対多
- **contracts** → **contractor_histories**: 1対多
- **contractors** → **contractor_details**: 1対1

### 3.2 マスターテーブルとのリレーション
- **contracts** → **staff**: 多対1
- **usage_fees** → **payment_methods**: 多対1
- **management_fees** → **payment_methods**: 多対1
- **gravestones** → **grave_types**: 多対1
- **gravestones** → **religious_sects**: 多対1
- **burials** → **religious_sects**: 多対1

## 4. インデックス設計

### 4.1 推奨インデックス
1. **contracts**
   - contract_number (UNIQUE)
   - application_date
   - staff_id
   - status

2. **contractors**
   - contract_id, is_current (複合インデックス)
   - name
   - name_kana

3. **burials**
   - contract_id
   - burial_date
   - name

4. **constructions**
   - contract_id
   - start_date

5. **contractor_histories**
   - contract_id
   - change_date

## 5. 特記事項

### 5.1 データ型の選定理由
- **金額フィールド**: DECIMAL(10,2) - 円単位での正確な計算のため
- **日付フィールド**: DATE/DATETIME - 和暦表示は画面側で対応
- **性別**: ENUM - 限定的な選択肢のため
- **ステータス**: ENUM - 状態管理の明確化

### 5.2 正規化について
- 第3正規形まで正規化を実施
- 住所情報は都道府県・市区町村での分割も検討したが、画面定義に合わせて2分割で設計
- 契約者の変更履歴を contractor_histories テーブルで管理

### 5.3 拡張性の考慮
- 各テーブルに created_at, updated_at を設置
- 論理削除が必要な場合は deleted_at カラムを追加可能
- マスターテーブルは将来的な拡張を考慮した設計

### 5.4 パフォーマンス考慮事項
- 頻繁に検索される項目にインデックスを設定
- 契約番号など一意性が必要な項目にUNIQUE制約を設定
- 大量データが想定される burials, constructions テーブルには適切なインデックスを配置