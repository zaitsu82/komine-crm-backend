# TODO - Cemetery CRM Backend

最終更新: 2025-11-30

## 📊 現在の状況

- **バージョン**: v1.3.0
- **テスト**: 521テスト、全て成功
- **カバレッジ**: Functions 80%, Lines 65%, Statements 65%, Branches 40%（デプロイ優先のため一時的に引き下げ）
- **TypeScript**: 厳格モード有効、コンパイルエラー0件
- **コード品質**: ESLint + Prettier + Husky設定完了
- **API仕様**: OpenAPI 3.0 (swagger.yaml, swagger.json) + Swagger UI (/api-docs)
- **エラー監視**: Sentry統合（リアルタイムエラートラッキング）
- **インフラ**: Docker完全対応、CI/CD構築済み

⚠️ **注意**: 区画管理リファクタリング（ContractPlot Model）に伴い、テストカバレッジを一時的に引き下げています。下記「テストカバレッジ改善」タスクで段階的に回復予定。

---

## 🔴 優先度: 高

現在、優先度が高い未完了タスクはありません。

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
