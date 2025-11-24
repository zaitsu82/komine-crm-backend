# 合祀情報仕様書

## 概要

合祀情報機能は、霊園の一区画に複数の故人を祀る管理を行います。埋葬上限人数に達した日から有効期間のカウントを開始し、期間満了時に請求を自動実行します。

## データ構造

### CollectiveBurialモデル（Prisma）

```prisma
model CollectiveBurial {
  id                     String    @id @default(uuid())
  plot_id                String    @unique              // 区画ID（1:1関係）
  burial_capacity        Int                            // 埋葬上限人数
  current_burial_count   Int       @default(0)          // 現在埋葬人数
  capacity_reached_date  DateTime? @db.Date             // 上限到達日
  validity_period_years  Int                            // 有効期間（年単位）
  billing_scheduled_date DateTime? @db.Date             // 請求予定日
  billing_status         String    @default("pending")  // 請求状況
  billing_amount         Decimal?  @db.Decimal(15, 2)   // 請求金額
  notes                  String?   @db.Text             // 備考
  created_at             DateTime  @default(now())
  updated_at             DateTime  @updatedAt
  deleted_at             DateTime?

  Plot Plot @relation(fields: [plot_id], references: [id], onDelete: Cascade)
}
```

### フィールド説明

| フィールド名 | 型 | 必須 | 説明 |
|-------------|-----|------|------|
| id | String (UUID) | ✅ | 合祀情報の一意識別子 |
| plot_id | String (UUID) | ✅ | 関連する区画ID（外部キー、1:1） |
| burial_capacity | Int | ✅ | 埋葬可能な上限人数（例: 10人） |
| current_burial_count | Int | ✅ | 現在の埋葬人数（BuriedPersonsから自動集計） |
| capacity_reached_date | DateTime | ❌ | 上限到達日（上限人数に達した日時） |
| validity_period_years | Int | ✅ | 有効期間（年単位、例: 1年、3年、5年） |
| billing_scheduled_date | DateTime | ❌ | 請求予定日（上限到達日 + 有効期間） |
| billing_status | String | ✅ | 請求状況（pending/billed/paid） |
| billing_amount | Decimal | ❌ | 請求金額（円） |
| notes | String | ❌ | 備考・特記事項 |

## 業務フロー

### 1. 合祀情報の登録

**タイミング**: 区画作成時（`POST /api/v1/plots`）

**処理内容**:
- 区画情報と同時に合祀情報を登録
- 初期状態: `current_burial_count = 0`、`billing_status = "pending"`

**リクエスト例**:
```typescript
{
  plot: { /* 区画基本情報 */ },
  collectiveBurial: {
    burialCapacity: 10,           // 上限10人
    validityPeriodYears: 3,       // 有効期間3年
    billingAmount: 500000,        // 請求金額50万円
    notes: "家族墓としての利用"
  }
}
```

### 2. 埋葬者の登録・削除

**トリガー**:
- 埋葬者登録（`POST /api/v1/plots/:id` の `buriedPersons` 配列に追加）
- 埋葬者削除（`PUT /api/v1/plots/:id` の `buriedPersons` に `_delete: true` 指定）

**自動処理**:
1. **埋葬人数の自動更新**
   ```typescript
   current_burial_count = BuriedPersons.count({ where: { plot_id } })
   ```

2. **上限到達判定**
   ```typescript
   if (current_burial_count >= burial_capacity && !capacity_reached_date) {
     capacity_reached_date = new Date()
     billing_scheduled_date = addYears(capacity_reached_date, validity_period_years)
   }
   ```

3. **上限未満への戻り**
   ```typescript
   if (current_burial_count < burial_capacity && capacity_reached_date) {
     // 上限を下回った場合、日付をリセット
     capacity_reached_date = null
     billing_scheduled_date = null
   }
   ```

### 3. 請求処理の自動実行

**実行方法**: バッチ処理（cron job または定期実行スクリプト）

**対象抽出クエリ**:
```typescript
const billingTargets = await prisma.collectiveBurial.findMany({
  where: {
    billing_status: 'pending',
    billing_scheduled_date: {
      lte: new Date() // 請求予定日が今日以前
    },
    deleted_at: null
  },
  include: {
    Plot: {
      include: {
        Contractors: { orderBy: { created_at: 'desc' }, take: 1 }
      }
    }
  }
})
```

**請求処理フロー**:
1. 対象の合祀情報を抽出
2. 請求データを生成（請求先: 最新の契約者）
3. `billing_status` を `"billed"` に更新
4. 請求書発行または請求システムへの連携

**実装例**:
```typescript
// scripts/generate-collective-burial-invoices.ts
for (const burial of billingTargets) {
  // 請求データ生成
  await createInvoice({
    amount: burial.billing_amount,
    dueDate: burial.billing_scheduled_date,
    contractor: burial.Plot.Contractors[0],
    description: `合祀管理料（有効期間${burial.validity_period_years}年分）`
  })

  // ステータス更新
  await prisma.collectiveBurial.update({
    where: { id: burial.id },
    data: { billing_status: 'billed' }
  })
}
```

### 4. 請求状況の管理

**ステータス遷移**:
```
pending（未請求）
  ↓ 請求予定日到来
billed（請求済み）
  ↓ 入金確認
paid（支払済み）
```

**手動ステータス更新**:
```typescript
PUT /api/v1/plots/:id
{
  collectiveBurial: {
    billingStatus: "paid"
  }
}
```

## API仕様

### 区画情報取得（合祀情報含む）

```
GET /api/v1/plots/:id
```

**レスポンス例**:
```json
{
  "success": true,
  "data": {
    "id": "uuid-plot-1",
    "plotNumber": "A-56",
    // ... その他の区画情報
    "collectiveBurial": {
      "id": "uuid-cb-1",
      "burialCapacity": 10,
      "currentBurialCount": 8,
      "capacityReachedDate": null,
      "validityPeriodYears": 3,
      "billingScheduledDate": null,
      "billingStatus": "pending",
      "billingAmount": 500000,
      "notes": "家族墓としての利用"
    }
  }
}
```

### 合祀情報の作成

区画作成時に合祀情報を同時登録:

```
POST /api/v1/plots
```

**リクエストボディ**:
```json
{
  "plot": { /* 区画基本情報 */ },
  "collectiveBurial": {
    "burialCapacity": 10,
    "validityPeriodYears": 3,
    "billingAmount": 500000,
    "notes": "家族墓としての利用"
  }
}
```

### 合祀情報の更新

```
PUT /api/v1/plots/:id
```

**リクエストボディ**:
```json
{
  "collectiveBurial": {
    "burialCapacity": 12,
    "validityPeriodYears": 5,
    "billingAmount": 600000,
    "notes": "上限人数を増加"
  }
}
```

### 合祀情報の削除

```
PUT /api/v1/plots/:id
```

**リクエストボディ**:
```json
{
  "collectiveBurial": null
}
```

## 実装チェックリスト

### Phase 1: 基本機能（現在完了）
- [x] Prisma schemaにCollectiveBurialモデル追加
- [x] TypeScript型定義（CollectiveBurialInfo）追加
- [x] plotInfo, CreatePlotInput, UpdatePlotInputに合祀情報追加
- [x] 業務ロジック仕様書作成

### Phase 2: Controller実装（未実装）
- [ ] plotControllerにcollectiveBurial関連処理を追加
  - [ ] 作成処理（createPlot内）
  - [ ] 更新処理（updatePlot内）
  - [ ] 削除処理（updatePlot内）
  - [ ] 取得処理（getPlotById内）
- [ ] 埋葬者登録時のcurrent_burial_count自動更新
- [ ] 上限到達判定ロジック実装
- [ ] billing_scheduled_date自動計算

### Phase 3: バッチ処理（未実装）
- [ ] 請求対象抽出スクリプト作成
  - `scripts/generate-collective-burial-invoices.ts`
- [ ] 請求データ生成処理実装
- [ ] billing_statusステータス更新
- [ ] cron設定（毎日実行）

### Phase 4: テスト（未実装）
- [ ] CollectiveBurial CRUD操作のテスト
- [ ] 埋葬人数自動カウントのテスト
- [ ] 上限到達判定のテスト
- [ ] 請求予定日計算のテスト
- [ ] バッチ処理のテスト

### Phase 5: API仕様書更新（未実装）
- [ ] swagger.yamlにCollectiveBurialスキーマ追加
- [ ] リクエスト/レスポンス例の追加
- [ ] DATABASE_SPECIFICATION.md更新

## ユースケース例

### ケース1: 家族墓の管理

**シナリオ**:
- 家族墓（区画A-56）に最大10人埋葬可能
- 有効期間3年、期間満了後に50万円請求

**タイムライン**:
1. **2024年1月**: 区画作成、合祀情報登録（`burial_capacity=10`、`validity_period_years=3`）
2. **2024年5月**: 1人目埋葬（`current_burial_count=1`）
3. **2025年3月**: 8人目埋葬（`current_burial_count=8`）
4. **2026年7月15日**: 10人目埋葬
   - `current_burial_count=10`
   - `capacity_reached_date=2026-07-15`
   - `billing_scheduled_date=2029-07-15`（3年後）
5. **2029年7月15日**: バッチ処理実行
   - 請求データ生成（50万円）
   - `billing_status="billed"`
6. **2029年8月1日**: 入金確認
   - `billing_status="paid"`

### ケース2: 上限未満での推移

**シナリオ**:
- 区画B-12に最大5人埋葬可能
- 現在4人埋葬、1人改葬により3人に減少

**処理**:
1. **初期状態**: `current_burial_count=4`、`capacity_reached_date=null`
2. **1人改葬**: BuriedPerson削除
3. **自動処理**: `current_burial_count=3`（上限未満のため、日付リセットは不要）

## 注意事項

### データ整合性
- **current_burial_count**: BuriedPersonsテーブルのレコード数と必ず一致させること
- 埋葬者の追加・削除時に自動更新処理が必須
- トランザクション内で処理して整合性を保証

### 請求処理
- バッチ処理の実行時刻は営業時間外を推奨（例: 深夜2:00）
- 請求失敗時のリトライ処理を実装
- 請求済みレコードの重複処理を防止

### パフォーマンス
- `billing_scheduled_date`にインデックス作成済み
- バッチ処理では100件ずつ処理するなどの考慮が必要

## 参考資料

- Prisma Schema: `prisma/schema.prisma`
- TypeScript型定義: `src/type.ts`
- データベース仕様: `DATABASE_SPECIFICATION.md`
- API仕様: `swagger.yaml`

---

最終更新: 2025-11-24
バージョン: v1.3.0
