# TODO - Cemetery CRM Backend

最終更新: 2025-12-09

## 📊 現在の状況

- **バージョン**: v1.3.0
- **テスト**: 521テスト、全て成功
- **カバレッジ**: Functions 80%, Lines 65%, Statements 65%, Branches 40%（デプロイ優先のため一時的に引き下げ）
- **TypeScript**: ⚠️ **ビルドエラー有り** - スキーマ修正に伴うリレーション名の修正が必要
- **コード品質**: ESLint + Prettier + Husky設定完了
- **API仕様**: OpenAPI 3.0 (swagger.yaml, swagger.json) + Swagger UI (/api-docs)
- **エラー監視**: Sentry統合（リアルタイムエラートラッキング）
- **インフラ**: Docker完全対応、CI/CD構築済み

⚠️ **注意**: 区画管理リファクタリング（ContractPlot Model）に伴い、テストカバレッジを一時的に引き下げています。下記「テストカバレッジ改善」タスクで段階的に回復予定。

⚠️ **注意**: DBスキーマ修正（ENUM追加、is_primary削除、CollectiveBurial 1:1化）に伴い、TypeScriptビルドエラーが発生しています。下記「スキーマ修正に伴うコード修正」で対応予定。

---

## 🔴 優先度: 高

### スキーマ修正に伴うコード修正

2025-12-09にDBスキーマの以下の変更を実施しました。これに伴い、TypeScriptビルドエラーが発生しており、早急な修正が必要です。

#### 実施済みのスキーマ変更
- ✅ `ContractRole` ENUMを追加（`applicant`, `contractor`）
- ✅ `SaleContractRole.role`をString型からContractRole型に変更
- ✅ `SaleContractRole.is_primary`フィールドを削除
- ✅ `CollectiveBurial`を1対多から1対1リレーションに変更（`contract_plot_id`に`@unique`追加）
- ✅ `ContractPlot.collectiveBurials[]` → `ContractPlot.collectiveBurial?`に変更
- ✅ リレーションを1対多に修正（`constructionInfos`, `familyContacts`, `buriedPersons`を配列型に）
- ✅ `BuriedPerson`, `CollectiveBurial`の`contract_plot_id`から`@unique`を削除
- ✅ **型安全性向上のためENUM化を実施**（2025-12-09追加）:
  - `AddressType` ENUM追加（`home`, `work`, `other`）
  - `DmSetting` ENUM追加（`allow`, `deny`, `limited`）
  - `BillingType` ENUM追加（`individual`, `corporate`, `bank_transfer`）
  - `AccountType` ENUM追加（`ordinary`, `current`, `savings`）
  - `BillingStatus` ENUM追加（`pending`, `billed`, `paid`）
  - `ActionType` ENUM追加（`CREATE`, `UPDATE`, `DELETE`）
  - `StaffRole` ENUM追加（`viewer`, `operator`, `manager`, `admin`）
  - `FamilyContact.mailing_type`をString型からAddressType型に変更
  - `WorkInfo.dm_setting`をString型からDmSetting型に変更
  - `WorkInfo.address_type`をString型からAddressType型に変更
  - `BillingInfo.billing_type`をString型からBillingType型に変更
  - `BillingInfo.account_type`をString型からAccountType型に変更
  - `CollectiveBurial.billing_status`をString型からBillingStatus型に変更
  - `History.action_type`をString型からActionType型に変更
  - `Staff.role`をString型からStaffRole型に変更
  - `src/type.ts`に新しいENUM型をインポート追加

#### 必要な修正作業

##### 1. リレーション名の大文字小文字を修正（最優先）
Prismaは小文字キャメルケースでリレーション名を生成するため、以下の置換が必要です：

**対象ファイル**: `src/plots/controllers/*.ts`, `src/plots/services/*.ts`, `src/utils/collectiveBurialUtils.ts`

**置換が必要なリレーション名**:
- [ ] `SaleContractRoles` → `saleContractRoles`（全ファイル）
- [ ] `PhysicalPlot` → `physicalPlot`（全ファイル）
- [ ] `UsageFee` → `usageFee`（全ファイル）
- [ ] `ManagementFee` → `managementFee`（全ファイル）
- [ ] `BuriedPersons` → `buriedPersons`（getPlotById.ts, contractService.ts）
- [ ] `Customer` → `customer`（リレーション参照箇所）

##### 2. is_primary参照の削除（高優先度）
以下のファイルから`is_primary`フィールドの参照を全て削除する必要があります：

**削除が必要なファイル**:
- [ ] `src/plots/controllers/getPlotById.ts`
  - `role.is_primary`の参照を削除
  - 主契約者検索ロジックを最初の役割取得に変更
- [ ] `src/plots/controllers/getPlots.ts`
  - `role.is_primary`の参照を削除
  - レスポンスの`isPrimary`フィールドを削除
- [ ] `src/plots/controllers/getPlotContracts.ts`
  - `where: { deleted_at: null, is_primary: true }`を削除
- [ ] `src/plots/controllers/getPlotInventory.ts`
  - `where: { deleted_at: null, is_primary: true }`を削除
- [ ] `src/plots/controllers/updatePlot.ts`
  - `is_primary: roleData.isPrimary ?? false`を削除
  - `role.is_primary`の参照を削除
- [ ] `src/plots/services/plotService.ts`
  - `where: { deleted_at: null, is_primary: true }`を削除
- [ ] `src/plots/services/contractService.ts`
  - `role.is_primary`の参照を削除（2箇所）
  - レスポンスの`isPrimary`フィールドを削除
- [ ] `src/utils/collectiveBurialUtils.ts`
  - `where: { deleted_at: null, is_primary: true }`を削除

##### 3. CollectiveBurial参照の修正
- [ ] 配列アクセス（`collectiveBurials[0]`）を単数形アクセス（`collectiveBurial`）に変更

##### 4. 動作確認
- [ ] `npm run build`でビルドエラーが無いことを確認
- [ ] 既存のテストが全て通ることを確認（`npm test`）
- [ ] API動作確認（Postmanコレクション実行）

#### 参考情報
- スキーマファイル: `prisma/schema.prisma`
- 既に修正済み: `createPlot.ts`, `createPlotContract.ts`, `type.ts`

---

## 🟡 優先度: 中

### テストカバレッジ改善

区画管理リファクタリング（ContractPlot Model v2.0）に伴い、以下のテストを再実装してカバレッジを段階的に回復する必要があります。

#### 1. 削除されたテストの再実装
- [ ] `tests/plots/plotController.test.ts` - getPlots エラーハンドリングテスト
  - データベースエラー時のレスポンス確認（500エラー）
- [ ] `tests/plots/plotController.test.ts` - createPlot エラーケーステスト
  - 物理区画が見つからない場合のテスト（400エラー）
  - 一般的なエラーハンドリングテスト（500エラー）
- [ ] `tests/plots/plotController.test.ts` - updatePlot テスト
  - 契約区画が見つからない場合のテスト（400エラー）
- [ ] `tests/plots/plotController.test.ts` - deletePlot 成功テスト
  - 契約区画と関連データのソフトデリート確認
  - トランザクション実行確認
  - 物理区画ステータス更新確認
- [ ] `tests/plots/plotController.test.ts` - createPlotContract 成功テスト
  - 新規契約作成の基本フロー確認
  - 勤務先情報・請求先情報の作成確認
  - 使用料・管理料の作成確認

#### 2. トランザクションモックの改善
- [ ] Prisma `$transaction` モックの正しい実装
  - ネストされたPrisma操作の適切なシミュレーション
  - トランザクションコールバック内のエラーハンドリング
  - 参考: `tests/plots/plotController.test.ts:64-65` の既存実装

#### 3. カバレッジ閾値の段階的引き上げ
- [ ] **フェーズ1**: 上記テストを再実装後
  - Statements: 65% → 75%
  - Lines: 65% → 75%
  - Functions: 80% → 90%
  - Branches: 40% → 50%
- [ ] **フェーズ2**: 区画管理の統合テスト追加後
  - Statements: 75% → 85%
  - Lines: 75% → 85%
  - Functions: 90% → 95%
  - Branches: 50% → 65%
- [ ] **フェーズ3**: 全機能のエッジケーステスト完了後（最終目標）
  - Statements: 85% → 97%
  - Lines: 85% → 99%
  - Functions: 95% → 100%
  - Branches: 65% → 80%

#### 4. 新規コントローラーのテストカバレッジ向上
現在のカバレッジ状況（`src/plots/controllers/`）:
- ✅ `createPlot.ts`: 97.56% (良好)
- ✅ `getPlots.ts`: 100% (完璧)
- ❌ `updatePlot.ts`: 6.41% (要改善)
- ❌ `createPlotContract.ts`: 54.54% (要改善)
- ❌ `deletePlot.ts`: 45.45% (要改善)
- ⚠️ `getPlotById.ts`: 75% (改善推奨)
- ⚠️ `getPlotContracts.ts`: 86.66% (改善推奨)
- ⚠️ `getPlotInventory.ts`: 82.6% (改善推奨)

優先的に改善すべきファイル:
- [ ] `updatePlot.ts` のテストケース追加（現在6.41%）
- [ ] `createPlotContract.ts` のテストケース追加（現在54.54%）
- [ ] `deletePlot.ts` のテストケース追加（現在45.45%）

### CI/CD拡張
- [ ] 自動デプロイ設定（AWS）
- [ ] E2Eテスト実行（Playwright）
- [ ] パフォーマンステスト

---

## 🟢 優先度: 低

### 1. パフォーマンス最適化
- [ ] Redis等のキャッシュ導入
  - マスターデータキャッシュ
  - APIレスポンスキャッシュ
  - レート制限カウンター（メモリ→Redis化）
  - セッション管理
- [ ] データベースクエリ最適化（N+1問題の検証）
- [ ] gzip/Brotli圧縮設定
- [ ] Connection Pooling最適化

### 2. ロギング強化
- [ ] 構造化ロギング（JSON形式）
- [ ] ログレベル管理
- [ ] ログローテーション設定
- [ ] 外部ロギングサービス連携

### 3. 監視・モニタリング
- [ ] 詳細メトリクス追加
- [ ] APM導入
- [ ] アラート設定

### 4. エラーハンドリング強化
- [ ] Slack/Email通知統合（Sentry Alertsの活用）

### 5. 認証・認可改善
- [ ] リフレッシュトークン自動更新
- [ ] トークン失効（Blacklist）機能
- [ ] MFA（多要素認証）

### 6. データベース管理
- [ ] マイグレーション戦略定義
- [ ] シードデータ管理スクリプト改善
- [ ] バックアップ・リストア戦略

### 7. API改善
- [ ] WebSocket/SSE（リアルタイム機能）

### 8. History API拡張（必要に応じて）
- [ ] `GET /api/v1/history` - 全履歴の検索・フィルタ
- [ ] `POST /api/v1/history/:id/restore` - 履歴からの復元

---

## 💡 将来的な検討事項

### Staff API
ユーザー管理機能（スタッフ新規登録機能の実装）

#### 実装が必要なエンドポイント
- [ ] `POST /api/v1/staff` - スタッフ新規登録
  - Supabase Admin APIでユーザー作成 (`supabase.auth.admin.createUser`)
  - 取得したsupabase_uidでStaffテーブルにレコード作成
  - トランザクション処理でロールバック対応
- [ ] `GET /api/v1/staff` - スタッフ一覧取得
  - ページネーション対応
  - deleted_at IS NULL でフィルタリング（削除済みは非表示）
- [ ] `GET /api/v1/staff/:id` - スタッフ詳細取得
- [ ] `PUT /api/v1/staff/:id` - スタッフ情報更新
  - 名前、メールアドレス、役割の更新
  - Supabase側のメールアドレス更新も同期
- [ ] `DELETE /api/v1/staff/:id` - スタッフ削除（ソフトデリート）
  - deleted_atに現在日時を設定
  - is_activeをfalseに更新

#### 実装が必要なファイル
- [ ] `src/staff/staffController.ts` - CRUD処理の実装
- [ ] `src/staff/staffRoutes.ts` - ルート定義
- [ ] `src/validations/staffValidation.ts` - リクエストバリデーション
- [ ] `tests/staff/staffController.test.ts` - コントローラーテスト
- [ ] `tests/staff/staffRoutes.test.ts` - ルートテスト

#### 注意事項
- **supabase_uidはNOT NULL制約**のため、必ずSupabase Admin APIでユーザー作成が必須
- スタッフ作成フロー:
  1. Supabase Admin API: `createUser({ email, password, email_confirm: true })`
  2. supabase_uid取得: `data.user.id`
  3. Staff作成: `prisma.staff.create({ supabase_uid, name, email, role })`
- エラー時のロールバック処理が必要（Supabaseユーザー削除も含む）
- 管理者権限（admin）のみアクセス可能にする権限設定

### その他
- GraphQL代替検討
- 環境別設定ファイルの分離（.env.development, .env.production）
- シークレット管理（AWS Secrets Manager, Vault等）

---

## 📝 完了済みマイルストーン

詳細は CHANGELOG.md を参照してください。

- ✅ History API実装（v0.2.0）
- ✅ 本番環境設定・CORS（v0.3.0）
- ✅ CI/CD基本構築（v0.4.0）
- ✅ Docker化（v1.0.0）
- ✅ ドキュメント整備（v1.0.0）
- ✅ セキュリティスキャン強化（v1.1.0）
- ✅ Swagger UI実装（v1.2.0）
- ✅ Sentryエラートラッキング（v1.3.0）
