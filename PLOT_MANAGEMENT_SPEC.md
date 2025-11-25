# 区画管理システム設計仕様書

**バージョン**: v1.0.0
**ステータス**: 設計中
**最終更新**: 2025-11-25

## 概要

墓地の区画管理システムにおける新しいデータ構造設計。物理的な区画と販売単位を分離して管理することで、柔軟な面積販売と正確な在庫管理を実現します。

## 背景と目的

### 現状の課題

- **販売形式**: 一区画（3.6㎡）を基本としつつ、一区画に満たない面積（1.8㎡など）での販売も行われる
- **在庫管理**: 区画全体の販売状況と部分販売の管理が必要
- **ID管理**: 物理的な区画IDと販売契約IDを適切に分離する必要がある

### 解決策

物理的な区画（Physical_Plot）と販売単位（Contract_Plot）を分けて考えることで、以下を実現：

1. **柔軟な面積販売**: 3.6㎡、1.8㎡、0.9㎡など任意の面積で販売可能
2. **正確な在庫管理**: 物理区画ごとの残り販売可能面積を正確に把握
3. **明確なID管理**: 物理区画ID（場所）と契約区画ID（販売実績）を分離

## データモデル設計

### エンティティ関係図（概要）

```
Physical_Plot (1) ----< (N) Contract_Plot (N) >---- (1) Sale_Contract (N) >---- (1) Customer
  (物理区画)              (契約区画)                   (販売契約)                   (顧客)
```

### 1. Physical_Plot（物理区画マスタ）

霊園の土地の境界線で区切られた最小単位（3.6㎡区画）を管理します。

| カラム名 | データ型 | NULL許可 | 説明 | 備考 |
|---------|---------|---------|------|------|
| Physical_Plot_ID | INT/VARCHAR | NOT NULL | 物理区画を一意に識別するID | PRIMARY KEY、全区画に割り当て |
| Area_Name | VARCHAR | NOT NULL | 区域名 | 例: 第一区域、芝生区画 |
| Area_sqm | DECIMAL | NOT NULL | 区画の総面積 | 基本は3.6㎡（固定値） |
| Status | VARCHAR | NOT NULL | 状態 | 一部販売済、販売可能、全区画販売済など（集計用） |
| created_at | TIMESTAMP | NOT NULL | 作成日時 | デフォルト: CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP | NOT NULL | 更新日時 | デフォルト: CURRENT_TIMESTAMP |
| deleted_at | TIMESTAMP | NULL | 削除日時 | 論理削除用（Soft Delete） |

**インデックス**:
- PRIMARY KEY: Physical_Plot_ID
- INDEX: Area_Name
- INDEX: Status

**ビジネスルール**:
- Area_sqmは基本的に3.6㎡で固定（将来的に異なるサイズの区画もサポート可能）
- Statusは関連するContract_Plotの販売状況から自動計算
- 論理削除（Soft Delete）により履歴を保持

### 2. Contract_Plot（契約区画）

実際に顧客に販売・契約された単位（3.6㎡、1.8㎡など）を管理します。

| カラム名 | データ型 | NULL許可 | 説明 | 備考 |
|---------|---------|---------|------|------|
| Contract_Plot_ID | INT/VARCHAR | NOT NULL | 契約された区画を一意に識別するID | PRIMARY KEY |
| Physical_Plot_ID | INT/VARCHAR | NOT NULL | 参照キー：どの物理区画の一部か | FOREIGN KEY → Physical_Plot |
| Contract_Area_sqm | DECIMAL | NOT NULL | 契約された面積 | 例: 3.6, 1.8, 0.9など |
| Sale_Status | VARCHAR | NOT NULL | 販売状態 | 在庫、商談中、契約済（在庫管理の肝） |
| Location_Description | VARCHAR | NULL | 物理区画内のどの位置か | 例: 3.6㎡の「左半分」、「右側」など |
| created_at | TIMESTAMP | NOT NULL | 作成日時 | デフォルト: CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP | NOT NULL | 更新日時 | デフォルト: CURRENT_TIMESTAMP |
| deleted_at | TIMESTAMP | NULL | 削除日時 | 論理削除用（Soft Delete） |

**インデックス**:
- PRIMARY KEY: Contract_Plot_ID
- FOREIGN KEY: Physical_Plot_ID → Physical_Plot(Physical_Plot_ID)
- INDEX: Sale_Status
- INDEX: Physical_Plot_ID, Sale_Status（複合インデックス）

**ビジネスルール**:
- Contract_Area_sqmの合計は、親Physical_PlotのArea_sqmを超えてはならない
- Sale_Statusは「在庫」「商談中」「契約済」の3状態
- 同一Physical_Plot_ID内で、契約済み面積の合計 ≤ 3.6㎡を制約として設定

**在庫管理ロジック**:
```sql
-- 特定の物理区画の残り在庫面積を計算
SELECT
  pp.Physical_Plot_ID,
  pp.Area_sqm AS total_area,
  COALESCE(SUM(cp.Contract_Area_sqm), 0) AS contracted_area,
  pp.Area_sqm - COALESCE(SUM(cp.Contract_Area_sqm), 0) AS remaining_area
FROM Physical_Plot pp
LEFT JOIN Contract_Plot cp
  ON pp.Physical_Plot_ID = cp.Physical_Plot_ID
  AND cp.Sale_Status = '契約済'
  AND cp.deleted_at IS NULL
WHERE pp.deleted_at IS NULL
GROUP BY pp.Physical_Plot_ID, pp.Area_sqm;
```

### 3. Sale_Contract（販売契約）

顧客との契約情報を管理します。

| カラム名 | データ型 | NULL許可 | 説明 | 備考 |
|---------|---------|---------|------|------|
| Contract_ID | INT/VARCHAR | NOT NULL | 契約を一意に識別するID | PRIMARY KEY |
| Contract_Plot_ID | INT/VARCHAR | NOT NULL | 参照キー：どの区画の契約か | FOREIGN KEY → Contract_Plot |
| Customer_ID | INT | NOT NULL | 顧客マスタへの参照 | FOREIGN KEY → Customer |
| Customer_Role | VARCHAR | NOT NULL | 顧客の役割 | applicant（申込者）, contractor（契約者）, heir（相続人）など |
| Contract_Date | DATE | NOT NULL | 契約日 | |
| Price | DECIMAL | NOT NULL | 販売価格 | |
| Payment_Status | VARCHAR | NOT NULL | 支払い状況 | unpaid（未払い）, partial（一部入金）, paid（完済） |
| Reservation_Date | DATE | NULL | 予約日 | |
| Acceptance_Number | VARCHAR | NULL | 受付番号 | |
| Permit_Date | DATE | NULL | 許可日 | |
| Start_Date | DATE | NULL | 開始日 | |
| Notes | TEXT | NULL | 契約に関する備考 | |
| created_at | TIMESTAMP | NOT NULL | 作成日時 | デフォルト: CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP | NOT NULL | 更新日時 | デフォルト: CURRENT_TIMESTAMP |
| deleted_at | TIMESTAMP | NULL | 削除日時 | 論理削除用（Soft Delete） |

**インデックス**:
- PRIMARY KEY: Contract_ID
- FOREIGN KEY: Contract_Plot_ID → Contract_Plot(Contract_Plot_ID)
- FOREIGN KEY: Customer_ID → Customer(Customer_ID)
- INDEX: Customer_Role（役割で検索）
- INDEX: Contract_Date
- INDEX: Payment_Status

**ビジネスルール**:
- 1つのContract_Plotに対して1つのSale_Contractが紐づく（1:1関係）
- Contract作成時にContract_PlotのSale_Statusを「契約済」に自動更新
- Payment_Statusの変更履歴は別途Historyテーブルで管理
- **Customer_Role**により、同じ顧客でも契約ごとに異なる役割を持つことが可能
  - 例: 田中太郎さんが区画Aでは「applicant」（申込者）、区画Bでは「contractor」（契約者）

### 4. Customer（顧客マスタ）

人物情報を一元管理します。役割（申込者・契約者など）はSale_Contractで管理します。

| カラム名 | データ型 | NULL許可 | 説明 | 備考 |
|---------|---------|---------|------|------|
| Customer_ID | INT/VARCHAR | NOT NULL | 顧客を一意に識別するID | PRIMARY KEY |
| Name | VARCHAR | NOT NULL | 氏名 | |
| Name_Kana | VARCHAR | NOT NULL | 氏名カナ | |
| Birth_Date | DATE | NULL | 生年月日 | |
| Gender | VARCHAR | NULL | 性別 | |
| Postal_Code | VARCHAR | NOT NULL | 郵便番号 | |
| Address | VARCHAR | NOT NULL | 住所 | |
| Registered_Address | VARCHAR | NULL | 本籍地 | |
| Phone_Number | VARCHAR | NOT NULL | 電話番号 | |
| Fax_Number | VARCHAR | NULL | FAX番号 | |
| Email | VARCHAR | NULL | メールアドレス | |
| Notes | TEXT | NULL | 備考 | |
| created_at | TIMESTAMP | NOT NULL | 作成日時 | デフォルト: CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP | NOT NULL | 更新日時 | デフォルト: CURRENT_TIMESTAMP |
| deleted_at | TIMESTAMP | NULL | 削除日時 | 論理削除用（Soft Delete） |

**インデックス**:
- PRIMARY KEY: Customer_ID
- INDEX: Name, Name_Kana（複合インデックス、氏名検索用）
- INDEX: Phone_Number
- INDEX: Email

**ビジネスルール**:
- 人物情報のみを管理し、役割情報は持たない
- 同じ顧客が複数の契約を持つことが可能（1:N関係）
- 各契約における役割（申込者、契約者、相続人など）はSale_Contract.Customer_Roleで管理
- WorkInfo（勤務先情報）、BillingInfo（請求情報）と1:1の関係を持つ

**統合の背景**:
- 旧システムでは`Applicant`（申込者）と`Contractor`（契約者）が別テーブルだった
- データの重複（同じ人物の情報が複数箇所に存在）を防ぐため、顧客マスタとして統合
- 役割は契約ごとに異なる可能性があるため、SaleContractに`customer_role`フィールドを追加

### 5. UsageFee（使用料）

契約区画ごとの使用料情報を管理します。

| カラム名 | データ型 | NULL許可 | 説明 | 備考 |
|---------|---------|---------|------|------|
| Usage_Fee_ID | INT/VARCHAR | NOT NULL | 使用料を一意に識別するID | PRIMARY KEY |
| Contract_Plot_ID | INT/VARCHAR | NOT NULL | 参照キー：どの契約区画の使用料か | FOREIGN KEY → Contract_Plot、UNIQUE |
| Calculation_Type | VARCHAR | NOT NULL | 計算方式 | 一括、分割など |
| Tax_Type | VARCHAR | NOT NULL | 税区分 | 税込、税抜、非課税など |
| Billing_Type | VARCHAR | NOT NULL | 請求区分 | 年払い、月払いなど |
| Billing_Years | VARCHAR | NOT NULL | 請求年数 | |
| Area | VARCHAR | NOT NULL | 面積 | 契約区画の面積 |
| Unit_Price | VARCHAR | NOT NULL | 単価 | |
| Usage_Fee | VARCHAR | NOT NULL | 使用料 | 計算結果の金額 |
| Payment_Method | VARCHAR | NOT NULL | 支払方法 | 現金、振込、口座振替など |
| created_at | TIMESTAMP | NOT NULL | 作成日時 | デフォルト: CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP | NOT NULL | 更新日時 | デフォルト: CURRENT_TIMESTAMP |
| deleted_at | TIMESTAMP | NULL | 削除日時 | 論理削除用（Soft Delete） |

**インデックス**:
- PRIMARY KEY: Usage_Fee_ID
- FOREIGN KEY: Contract_Plot_ID → Contract_Plot(Contract_Plot_ID)
- UNIQUE: Contract_Plot_ID（1契約区画に1使用料）

**ビジネスルール**:
- 1つのContract_Plotに対して1つのUsageFeeが紐づく（1:1関係）
- 分割販売の場合、契約区画の面積に応じて使用料を按分
- 旧システムではPlot（物理区画）に紐づいていたが、新システムではContractPlot（契約区画）に紐づけることで、分割販売時の料金計算が容易に

### 6. ManagementFee（管理料）

契約区画ごとの管理料情報を管理します。

| カラム名 | データ型 | NULL許可 | 説明 | 備考 |
|---------|---------|---------|------|------|
| Management_Fee_ID | INT/VARCHAR | NOT NULL | 管理料を一意に識別するID | PRIMARY KEY |
| Contract_Plot_ID | INT/VARCHAR | NOT NULL | 参照キー：どの契約区画の管理料か | FOREIGN KEY → Contract_Plot、UNIQUE |
| Calculation_Type | VARCHAR | NOT NULL | 計算方式 | 一括、分割など |
| Tax_Type | VARCHAR | NOT NULL | 税区分 | 税込、税抜、非課税など |
| Billing_Type | VARCHAR | NOT NULL | 請求区分 | 年払い、月払いなど |
| Billing_Years | VARCHAR | NOT NULL | 請求年数 | |
| Area | VARCHAR | NOT NULL | 面積 | 契約区画の面積 |
| Billing_Month | VARCHAR | NOT NULL | 請求月 | 毎年の請求月 |
| Management_Fee | VARCHAR | NOT NULL | 管理料 | 計算結果の金額 |
| Unit_Price | VARCHAR | NOT NULL | 単価 | |
| Last_Billing_Month | VARCHAR | NOT NULL | 最終請求月 | |
| Payment_Method | VARCHAR | NOT NULL | 支払方法 | 現金、振込、口座振替など |
| created_at | TIMESTAMP | NOT NULL | 作成日時 | デフォルト: CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP | NOT NULL | 更新日時 | デフォルト: CURRENT_TIMESTAMP |
| deleted_at | TIMESTAMP | NULL | 削除日時 | 論理削除用（Soft Delete） |

**インデックス**:
- PRIMARY KEY: Management_Fee_ID
- FOREIGN KEY: Contract_Plot_ID → Contract_Plot(Contract_Plot_ID)
- UNIQUE: Contract_Plot_ID（1契約区画に1管理料）

**ビジネスルール**:
- 1つのContract_Plotに対して1つのManagementFeeが紐づく（1:1関係）
- 分割販売の場合、契約区画の面積に応じて管理料を按分
- 定期的な請求（例: 毎年特定の月）を管理
- 旧システムではPlot（物理区画）に紐づいていたが、新システムではContractPlot（契約区画）に紐づけることで、分割販売時の料金計算が容易に

### 7. GravestoneInfo（墓石情報）

物理区画に建てられた墓石の物理的情報を管理します。

| カラム名 | データ型 | NULL許可 | 説明 | 備考 |
|---------|---------|---------|------|------|
| Gravestone_Info_ID | INT/VARCHAR | NOT NULL | 墓石情報を一意に識別するID | PRIMARY KEY |
| Physical_Plot_ID | INT/VARCHAR | NOT NULL | 参照キー：どの物理区画の墓石か | FOREIGN KEY → Physical_Plot、UNIQUE |
| Gravestone_Base | VARCHAR | NOT NULL | 墓石基礎 | |
| Enclosure_Position | VARCHAR | NOT NULL | 囲障位置 | |
| Gravestone_Dealer | VARCHAR | NOT NULL | 石材店 | |
| Gravestone_Type | VARCHAR | NOT NULL | 墓石種別 | |
| Surrounding_Area | VARCHAR | NOT NULL | 周辺区画 | |
| Establishment_Deadline | DATE | NULL | 設置期限 | |
| Establishment_Date | DATE | NULL | 設置日 | |
| created_at | TIMESTAMP | NOT NULL | 作成日時 | デフォルト: CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP | NOT NULL | 更新日時 | デフォルト: CURRENT_TIMESTAMP |
| deleted_at | TIMESTAMP | NULL | 削除日時 | 論理削除用（Soft Delete） |

**インデックス**:
- PRIMARY KEY: Gravestone_Info_ID
- FOREIGN KEY: Physical_Plot_ID → Physical_Plot(Physical_Plot_ID)
- UNIQUE: Physical_Plot_ID（1物理区画に1墓石情報）

**ビジネスルール**:
- 1つのPhysical_Plotに対して1つのGravestoneInfoが紐づく（1:1関係）
- 墓石は物理的な土地（物理区画）に建てられるため、PhysicalPlotに紐づける
- 分割販売されても墓石は1つなので、ContractPlotではなくPhysicalPlotに紐づけるのが適切

### 8. ConstructionInfo（工事情報）

物理区画で行われる工事の情報を管理します。工事進捗、許可状況、支払状況など、工事に関する全情報を一元管理します。

| カラム名 | データ型 | NULL許可 | 説明 | 備考 |
|---------|---------|---------|------|------|
| Construction_Info_ID | INT/VARCHAR | NOT NULL | 工事情報を一意に識別するID | PRIMARY KEY |
| Physical_Plot_ID | INT/VARCHAR | NOT NULL | 参照キー：どの物理区画の工事か | FOREIGN KEY → Physical_Plot、UNIQUE |
| Construction_Type | VARCHAR | NULL | 工事区分 | |
| Start_Date | DATE | NULL | 着工予定日 | |
| Completion_Date | DATE | NULL | 完工予定日 | |
| Contractor | VARCHAR | NULL | 工事業者名 | |
| Supervisor | VARCHAR | NULL | 工事担当者名 | |
| Progress | VARCHAR | NULL | 進捗状況 | |
| Work_Item_1～2 | VARCHAR | NULL | 工事項目1～2 | 複数の工事項目を管理 |
| Work_Date_1～2 | DATE | NULL | 実施日1～2 | |
| Work_Amount_1～2 | DECIMAL | NULL | 金額1～2 | |
| Work_Status_1～2 | VARCHAR | NULL | 状況1～2 | |
| Permit_Number | VARCHAR | NULL | 工事許可番号 | |
| Application_Date | DATE | NULL | 申請日 | |
| Permit_Date | DATE | NULL | 許可日 | |
| Permit_Status | VARCHAR | NULL | 許可状況 | |
| Payment_Type_1～2 | VARCHAR | NULL | 支払区分1～2 | |
| Payment_Amount_1～2 | DECIMAL | NULL | 金額1～2 | |
| Payment_Date_1 | DATE | NULL | 支払日1 | |
| Payment_Scheduled_Date_2 | DATE | NULL | 支払予定日2 | |
| Payment_Status_1～2 | VARCHAR | NULL | 状況1～2 | |
| Construction_Notes | TEXT | NULL | 工事備考 | |
| created_at | TIMESTAMP | NOT NULL | 作成日時 | デフォルト: CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP | NOT NULL | 更新日時 | デフォルト: CURRENT_TIMESTAMP |
| deleted_at | TIMESTAMP | NULL | 削除日時 | 論理削除用（Soft Delete） |

**インデックス**:
- PRIMARY KEY: Construction_Info_ID
- FOREIGN KEY: Physical_Plot_ID → Physical_Plot(Physical_Plot_ID)
- UNIQUE: Physical_Plot_ID（1物理区画に1工事情報）

**ビジネスルール**:
- 1つのPhysical_Plotに対して1つのConstructionInfoが紐づく（1:1関係）
- 工事は物理的な区画全体に対して行われるため、PhysicalPlotに紐づける
- 工事項目・支払を複数管理できる構造（最大2件ずつ）

## 運用シナリオ

### シナリオ1: 一区画（3.6㎡）での販売

1. Physical_Plot_ID = "A-56", Area_sqm = 3.6 の物理区画が存在
2. 顧客が全体を購入
3. Contract_Plot作成: Contract_Area_sqm = 3.6, Sale_Status = "契約済"
4. Sale_Contract作成: Price = 1,000,000円

**結果**: Physical_Plot "A-56"の残り在庫 = 0㎡

### シナリオ2: 一区画を1.8㎡ずつ分割販売

1. Physical_Plot_ID = "B-23", Area_sqm = 3.6 の物理区画が存在
2. 顧客Aが前半部分（1.8㎡）を購入
   - Contract_Plot_1作成: Contract_Area_sqm = 1.8, Location_Description = "前半"
   - Sale_Contract作成
3. 顧客Bが後半部分（1.8㎡）を購入
   - Contract_Plot_2作成: Contract_Area_sqm = 1.8, Location_Description = "後半"
   - Sale_Contract作成

**結果**: Physical_Plot "B-23"の残り在庫 = 0㎡

### シナリオ3: 部分販売後の残り在庫管理

1. Physical_Plot_ID = "C-12", Area_sqm = 3.6 の物理区画が存在
2. 顧客が1.8㎡を購入
   - Contract_Plot作成: Contract_Area_sqm = 1.8
3. システムが自動計算: 残り在庫 = 3.6 - 1.8 = 1.8㎡
4. Physical_PlotのStatusを「一部販売済」に自動更新

**結果**: Physical_Plot "C-12"の残り在庫 = 1.8㎡（販売可能）

## 在庫管理の実現

### 在庫確認クエリ

**販売可能な区画を取得**:
```sql
SELECT
  pp.Physical_Plot_ID,
  pp.Area_Name,
  pp.Area_sqm - COALESCE(SUM(cp.Contract_Area_sqm), 0) AS available_area
FROM Physical_Plot pp
LEFT JOIN Contract_Plot cp
  ON pp.Physical_Plot_ID = cp.Physical_Plot_ID
  AND cp.Sale_Status IN ('契約済', '商談中')
  AND cp.deleted_at IS NULL
WHERE pp.deleted_at IS NULL
GROUP BY pp.Physical_Plot_ID, pp.Area_Name, pp.Area_sqm
HAVING available_area > 0
ORDER BY pp.Area_Name;
```

### 在庫状態の自動更新

Contract_Plotの変更時にPhysical_PlotのStatusを自動更新するトリガー/ロジック:

```typescript
async function updatePhysicalPlotStatus(physicalPlotId: string) {
  const plot = await prisma.physical_Plot.findUnique({
    where: { Physical_Plot_ID: physicalPlotId },
    include: {
      contract_Plots: {
        where: {
          Sale_Status: '契約済',
          deleted_at: null
        }
      }
    }
  });

  const contractedArea = plot.contract_Plots.reduce(
    (sum, cp) => sum + cp.Contract_Area_sqm,
    0
  );

  let newStatus: string;
  if (contractedArea === 0) {
    newStatus = '販売可能';
  } else if (contractedArea >= plot.Area_sqm) {
    newStatus = '全区画販売済';
  } else {
    newStatus = '一部販売済';
  }

  await prisma.physical_Plot.update({
    where: { Physical_Plot_ID: physicalPlotId },
    data: { Status: newStatus }
  });
}
```

## 既存システムとの関係

### 現在のシステム（Gravestone中心）

現在の実装では以下のモデルが存在：
- **Gravestone**: 墓石単位の管理（gravestone_code: "A-56"など）
- **Applicant**: 申込者（1:1）
- **Contractor**: 契約者（1:N）
- **CollectiveBurial**: 合祀情報

### 新システム（Physical_Plot中心）

新設計では以下のモデルに移行：
- **Physical_Plot**: 物理区画（Gravestoneに相当）
- **Contract_Plot**: 契約区画（新規概念）
- **Sale_Contract**: 販売契約（Contractorに相当）
- **Customer**: 顧客（ApplicantとContractorを統合）

### 移行マッピング

| 旧モデル | 新モデル | 備考 |
|---------|---------|------|
| Gravestone | Physical_Plot | 1:1で変換可能、gravestone_code → Physical_Plot_ID |
| Applicant | Customer | 顧客マスタに統合 |
| Contractor | Sale_Contract + Customer | ContractorはSale_Contractに変換、人物情報はCustomerへ |
| CollectiveBurial | （維持または拡張） | Physical_Plotに紐づけて維持 |

**注意**: 既存のGravestoneは「区画全体（3.6㎡）の販売」のみを扱っていたため、過去データは全て`Contract_Area_sqm = 3.6`としてContract_Plotに変換されます。

## メリット

### 1. 柔軟な面積販売

- ✅ 3.6㎡、1.8㎡、0.9㎡など任意の面積で販売可能
- ✅ 将来的に異なるサイズの区画（5.0㎡など）にも対応可能

### 2. 正確な在庫管理

- ✅ 物理区画ごとの残り販売可能面積をリアルタイムで把握
- ✅ 部分販売の状況を正確に追跡
- ✅ 在庫切れ防止（販売可能面積を超える契約を防ぐ）

### 3. ID管理の明確化

- ✅ Physical_Plot_ID: 土地の場所を示す固定ID
- ✅ Contract_Plot_ID: 販売された在庫を示すID
- ✅ Contract_ID: 顧客との契約を示すID

### 4. 拡張性

- ✅ 将来的なビジネス要件の変化に柔軟に対応
- ✅ 新しい販売形式（定期借地権など）への拡張が容易

## 実装計画

### Phase 1: 仕様書整理（✅完了）
- [x] managemnt.mdの構造化
- [x] データモデル定義の表形式化
- [x] ビジネスルールの明確化
- [x] 既存システムとの関係整理

### Phase 2: 移行計画書作成
- [ ] データ移行戦略の策定
- [ ] API互換性戦略の策定
- [ ] テスト戦略の策定
- [ ] ロールバック計画の策定

### Phase 3: データモデル実装
- [ ] Prismaスキーマ定義
- [ ] マイグレーションファイル作成
- [ ] データ移行スクリプト作成

### Phase 4: TypeScript型定義
- [ ] Physical_Plot型定義
- [ ] Contract_Plot型定義
- [ ] Sale_Contract型定義

### Phase 5: Controller/Routes実装
- [ ] Physical_Plot CRUD
- [ ] Contract_Plot CRUD
- [ ] Sale_Contract CRUD
- [ ] 在庫管理ロジック

### Phase 6: テスト実装
- [ ] 単体テスト
- [ ] 統合テスト
- [ ] E2Eテスト

### Phase 7: API仕様書更新
- [ ] swagger.yaml更新
- [ ] Postmanコレクション更新

## 参考資料

### ドキュメント
- データベース仕様: `prisma/schema.prisma`
- API仕様: `swagger.yaml`
- プロジェクト手順書: `CLAUDE.md`
- 移行計画書: `MIGRATION_PLAN.md`（作成予定）

### 関連仕様書
- 合祀情報仕様書: `COLLECTIVE_BURIAL_SPEC.md`

---

**変更履歴**:
- 2025-11-25: v1.0.0 初版作成（managemnt.mdから構造化）
