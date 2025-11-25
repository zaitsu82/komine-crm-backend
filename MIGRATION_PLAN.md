# 区画管理システム 移行計画書

**バージョン**: v1.0.0
**作成日**: 2025-11-25
**ステータス**: 計画中

## 目的

既存のGravestone中心のデータモデルから、Physical_Plot/Contract_Plot中心の新しい区画管理システムへの完全移行を実施します。

## 移行方針

### 1. データ移行戦略

**方針**: 全テーブル削除・再作成

- ✅ **既存データの破棄**: Gravestone, Applicant, Contractor等の全データを削除
- ✅ **新規データ構造での開始**: Physical_Plot, Contract_Plot, Sale_Contract で再構築
- ✅ **シンプルな移行**: データ変換スクリプト不要、クリーンな再スタート

**影響範囲**:
- 全テーブルデータが失われる（開発環境のみ想定）
- Prismaマイグレーション履歴もリセット
- テストデータも全て再作成が必要

### 2. API互換性戦略

**方針**: 内部移行（エンドポイント維持、内部実装変更）

- ✅ **エンドポイント維持**: `/api/v1/plots` 等のURLは変更なし
- ✅ **内部実装刷新**: コントローラー内部で新モデル（Physical_Plot, Contract_Plot）を使用
- ⚠️ **レスポンス構造変更**: 新モデルに合わせてJSON構造が変わる

**エンドポイントマッピング**:

| 旧API | 新実装 | 説明 |
|------|-------|------|
| `GET /api/v1/plots` | Physical_Plot一覧取得 | 在庫情報も含めて返却 |
| `GET /api/v1/plots/:id` | Physical_Plot詳細 + Contract_Plot一覧 | 区画の詳細と契約状況 |
| `POST /api/v1/plots` | Physical_Plot + Contract_Plot作成 | リクエストボディに契約情報を含める |
| `PUT /api/v1/plots/:id` | Physical_Plot更新 | 基本情報のみ更新 |
| `DELETE /api/v1/plots/:id` | Physical_Plot論理削除 | 関連Contract_Plotも論理削除 |

**新規エンドポイント**:

| 新API | 説明 |
|------|------|
| `GET /api/v1/plots/:id/contracts` | 特定区画の契約一覧 |
| `POST /api/v1/plots/:id/contracts` | 新規契約の追加（部分販売） |
| `GET /api/v1/plots/:id/inventory` | 区画の在庫状況 |
| `GET /api/v1/contracts/:id` | 契約詳細取得 |
| `PUT /api/v1/contracts/:id` | 契約情報更新 |
| `DELETE /api/v1/contracts/:id` | 契約キャンセル（論理削除） |

### 3. テスト戦略

**方針**: 段階的に書き換え

- ✅ **モジュール単位で更新**: 各実装フェーズに合わせてテストも更新
- ✅ **カバレッジ維持**: 既存の高いカバレッジ基準（Functions 100%, Lines 99%）を維持
- ⚠️ **一時的なテスト失敗**: 移行期間中は一部テストが失敗する可能性

**テスト更新順序**:

1. **Phase 3後**: Physical_Plot, Contract_Plot, Sale_Contractの単体テスト作成
2. **Phase 5後**: 新Controller/Routesのテスト作成
3. **Phase 6**: 既存テスト（plots関連）を新モデルに書き換え
4. **Phase 6**: 統合テスト・E2Eテストの更新

## 影響範囲分析

### データベース

**削除されるテーブル**:
- `Gravestone` - 墓石マスタ
- `Applicant` - 申込者
- `Contractor` - 契約者
- `Billing_Info` - 請求情報（Contractorに紐づく）
- `Family_Contact` - 家族連絡先（Gravestoneに紐づく）
- `Burial` - 埋葬情報（Gravestoneに紐づく）
- `Construction` - 工事記録（Gravestoneに紐づく）
- `History` - 変更履歴（Gravestoneに紐づく）

**維持されるテーブル**:
- `Staff` - スタッフマスタ（認証用）
- 全てのMasterテーブル（Usage_Status, Cemetery_Type等）

**新規作成されるテーブル**:
- `Physical_Plot` - 物理区画マスタ
- `Contract_Plot` - 契約区画
- `Sale_Contract` - 販売契約
- `Customer` - 顧客マスタ（新規）

**特殊ケース: CollectiveBurial**:
- 現在の `CollectiveBurial` テーブルは `Gravestone` に紐づいている
- 新システムでは `Physical_Plot` に紐づけ直す必要がある
- オプション1: CollectiveBurialテーブルを削除・再作成
- オプション2: CollectiveBurialテーブルの外部キーを変更

### ソースコード

**削除・大幅変更が必要なファイル**:
- `src/plots/plotController.ts` - 完全書き換え
- `src/plots/plotRoutes.ts` - ルート追加
- `src/type.ts` - 型定義の大幅変更
- `tests/plots/*.test.ts` - テストの大幅書き換え

**新規作成が必要なファイル**:
- `src/physical-plots/physicalPlotController.ts`
- `src/contract-plots/contractPlotController.ts`
- `src/sale-contracts/saleContractController.ts`
- `src/customers/customerController.ts`
- `src/utils/inventoryUtils.ts` - 在庫管理ユーティリティ

**維持されるファイル**:
- `src/middleware/*` - 認証・認可は変更なし
- `src/masters/*` - マスタデータ管理は変更なし
- `src/auth/*` - 認証APIは変更なし

### ドキュメント

**更新が必要なドキュメント**:
- `README.md` - システム概要の更新
- `CLAUDE.md` - 開発ガイドラインの更新
- `DATABASE_SPECIFICATION.md` - データベース仕様（存在しないが作成を検討）
- `swagger.yaml` - API仕様の大幅更新
- `swagger.json` - 再生成が必要
- `CHANGELOG.md` - 大規模変更の記録

**新規作成したドキュメント**:
- ✅ `PLOT_MANAGEMENT_SPEC.md` - 区画管理システム仕様書
- ✅ `MIGRATION_PLAN.md` - 本移行計画書

## リスク分析

| リスク | 影響度 | 確率 | 対策 |
|-------|-------|-----|-----|
| データ損失 | 高 | 低 | バックアップ取得、開発環境での実施確認 |
| API互換性問題 | 中 | 高 | レスポンス構造のドキュメント化、フロントエンド側の同期更新 |
| テストカバレッジ低下 | 中 | 中 | 各フェーズでカバレッジ確認、基準値を下回らないよう注意 |
| CollectiveBurial機能の破損 | 高 | 中 | CollectiveBurial移行の慎重な実施、専用テスト作成 |
| スケジュール遅延 | 中 | 中 | 各フェーズの完了条件を明確化、進捗の定期確認 |
| 移行中のシステム停止 | 低 | 低 | 開発環境での実施、本番環境は未適用 |

## 実装スケジュール

### Phase 1: 準備（✅完了）
- [x] 仕様書整理（PLOT_MANAGEMENT_SPEC.md作成）
- [x] 移行計画書作成（本ドキュメント）

### Phase 2: データモデル実装
**所要時間**: 2-3時間

- [ ] 既存テーブルの削除準備（Prismaスキーマコメントアウト）
- [ ] Physical_Plot, Contract_Plot, Sale_Contract, Customer のPrisma定義
- [ ] CollectiveBurialの外部キー変更（Gravestone → Physical_Plot）
- [ ] リレーションシップの定義
- [ ] Prismaマイグレーションファイル生成
- [ ] データベースのリセット（`npx prisma migrate reset`）
- [ ] マイグレーション適用確認

**完了条件**:
- ✅ Prismaスキーマが正しく定義されている
- ✅ マイグレーションが正常に適用される
- ✅ Prisma Clientが正常に生成される

### Phase 3: TypeScript型定義
**所要時間**: 1-2時間

- [ ] `src/type.ts` に Physical_Plot関連の型定義
- [ ] Contract_Plot関連の型定義
- [ ] Sale_Contract関連の型定義
- [ ] Customer関連の型定義
- [ ] 在庫管理用の型定義
- [ ] リクエスト/レスポンス用のDTO型定義

**完了条件**:
- ✅ 全ての新モデルに対する型が定義されている
- ✅ TypeScriptコンパイルエラーがない

### Phase 4: ユーティリティ関数実装
**所要時間**: 1-2時間

- [ ] `src/utils/inventoryUtils.ts` 作成
  - 在庫計算ロジック
  - 販売可能面積の計算
  - Physical_Plotステータス自動更新
- [ ] `src/validations/plotValidations.ts` 更新
  - Contract_Plot面積の妥当性検証
  - 在庫超過チェック
- [ ] ユーティリティ関数のテスト作成

**完了条件**:
- ✅ 在庫管理ロジックが正しく動作する
- ✅ バリデーションが適切に機能する
- ✅ ユーティリティ関数のテストカバレッジ100%

### Phase 5: Controller/Routes実装
**所要時間**: 4-6時間

#### 5-1: Physical_Plot（物理区画）
- [ ] `src/plots/plotController.ts` の大幅書き換え
  - Physical_Plot一覧取得（在庫情報含む）
  - Physical_Plot詳細取得（Contract_Plot一覧含む）
  - Physical_Plot作成
  - Physical_Plot更新
  - Physical_Plot削除（論理削除）
- [ ] `src/plots/plotRoutes.ts` にルート追加
  - `GET /plots/:id/contracts` - 契約一覧
  - `POST /plots/:id/contracts` - 新規契約
  - `GET /plots/:id/inventory` - 在庫状況

#### 5-2: Contract_Plot & Sale_Contract（契約管理）
- [ ] `src/contracts/contractController.ts` 新規作成
  - Contract_Plot作成（部分販売）
  - Contract_Plot詳細取得
  - Contract_Plot更新
  - Contract_Plot削除（契約キャンセル）
  - Sale_Contract作成・更新・削除
- [ ] `src/contracts/contractRoutes.ts` 新規作成
  - `GET /contracts/:id` - 契約詳細
  - `PUT /contracts/:id` - 契約更新
  - `DELETE /contracts/:id` - 契約キャンセル

#### 5-3: CollectiveBurial統合
- [ ] `src/utils/collectiveBurialUtils.ts` 更新
  - Gravestone → Physical_Plot への参照変更
- [ ] CollectiveBurial関連のControllerロジック更新

**完了条件**:
- ✅ 全APIエンドポイントが正常に動作する
- ✅ CRUD操作が正しく機能する
- ✅ 在庫管理ロジックが統合されている
- ✅ CollectiveBurial機能が動作する

### Phase 6: テスト実装
**所要時間**: 6-8時間

#### 6-1: 単体テスト（Controller）
- [ ] `tests/plots/plotController.test.ts` 大幅書き換え
  - Physical_Plot CRUD操作のテスト
  - 在庫計算ロジックのテスト
  - エラーハンドリングのテスト
- [ ] `tests/contracts/contractController.test.ts` 新規作成
  - Contract_Plot CRUD操作のテスト
  - Sale_Contract CRUD操作のテスト
- [ ] `tests/utils/inventoryUtils.test.ts` 新規作成
  - 在庫計算の各種シナリオテスト

#### 6-2: 統合テスト（Routes）
- [ ] `tests/plots/plotRoutes.test.ts` 書き換え
- [ ] `tests/contracts/contractRoutes.test.ts` 新規作成

#### 6-3: CollectiveBurialテスト更新
- [ ] `tests/utils/collectiveBurialUtils.test.ts` 更新
  - Gravestone → Physical_Plot への参照変更テスト

#### 6-4: E2Eテスト
- [ ] Playwrightテストの更新（該当する場合）

**完了条件**:
- ✅ テストカバレッジ: Functions 100%, Lines 99%, Statements 97%, Branches 80%
- ✅ 全テストが成功する
- ✅ CI/CDパイプラインが正常に動作する

### Phase 7: API仕様書更新
**所要時間**: 2-3時間

- [ ] `swagger.yaml` 更新
  - Physical_Plot, Contract_Plot, Sale_Contract のスキーマ定義
  - 既存エンドポイントのレスポンス構造更新
  - 新規エンドポイントの追加
- [ ] `swagger.json` 再生成
- [ ] Swagger仕様の検証（`npm run swagger:validate`）
- [ ] Swagger UI での動作確認

**完了条件**:
- ✅ Swagger仕様が正常に検証される
- ✅ Swagger UIで全エンドポイントが表示される
- ✅ Try it out機能で実際にAPIが呼び出せる

### Phase 8: ドキュメント更新
**所要時間**: 1-2時間

- [ ] `CLAUDE.md` 更新
  - 新しいデータモデルの説明追加
  - API構造の更新
- [ ] `README.md` 更新
  - プロジェクト概要の更新
- [ ] `CHANGELOG.md` 更新
  - v2.0.0として大規模変更を記録

**完了条件**:
- ✅ 全てのドキュメントが最新の実装を反映している

### Phase 9: 最終確認・デプロイ準備
**所要時間**: 1時間

- [ ] 全テストの実行確認
- [ ] カバレッジレポート確認
- [ ] CI/CDパイプライン確認
- [ ] Docker環境での動作確認
- [ ] データベースマイグレーション手順の文書化

**完了条件**:
- ✅ 全ての品質基準を満たしている
- ✅ 本番環境デプロイ準備が完了している

## 総所要時間見積もり

| フェーズ | 所要時間 | 累計 |
|---------|---------|-----|
| Phase 1: 準備 | 完了 | - |
| Phase 2: データモデル実装 | 2-3時間 | 2-3時間 |
| Phase 3: TypeScript型定義 | 1-2時間 | 3-5時間 |
| Phase 4: ユーティリティ関数 | 1-2時間 | 4-7時間 |
| Phase 5: Controller/Routes | 4-6時間 | 8-13時間 |
| Phase 6: テスト実装 | 6-8時間 | 14-21時間 |
| Phase 7: API仕様書更新 | 2-3時間 | 16-24時間 |
| Phase 8: ドキュメント更新 | 1-2時間 | 17-26時間 |
| Phase 9: 最終確認 | 1時間 | 18-27時間 |

**合計**: 約18-27時間（2-3営業日相当）

## ロールバック計画

### シナリオ1: Phase 2完了前の問題発生

**対応**:
1. Gitで直前のコミットに戻る
2. Prismaマイグレーションをリセット
3. データベースを元の状態に復元

**影響**: 最小限（コードのみ）

### シナリオ2: Phase 5完了後の重大なバグ発見

**対応**:
1. Gitブランチを作成してバグ修正
2. 修正後、移行を続行
3. 必要に応じて該当フェーズを再実施

**影響**: 中程度（スケジュール遅延）

### シナリオ3: Phase 9完了後の本番環境問題

**対応**:
1. 旧バージョンのDockerイメージに切り戻し
2. データベースバックアップから復元
3. 問題の原因を特定・修正
4. 再度移行を実施

**影響**: 大（本番環境停止の可能性）

**予防策**:
- 本番環境適用前に、ステージング環境で十分なテストを実施
- データベースの完全バックアップを取得
- 段階的なロールアウト（カナリアリリース）を検討

## チェックリスト

### Phase 2: データモデル実装
- [ ] Prismaスキーマに Physical_Plot 定義
- [ ] Prismaスキーマに Contract_Plot 定義
- [ ] Prismaスキーマに Sale_Contract 定義
- [ ] Prismaスキーマに Customer 定義
- [ ] CollectiveBurial の外部キー変更
- [ ] リレーションシップ定義完了
- [ ] マイグレーションファイル生成
- [ ] データベースリセット実施
- [ ] Prisma Client 生成確認

### Phase 3: TypeScript型定義
- [ ] Physical_Plot型定義
- [ ] Contract_Plot型定義
- [ ] Sale_Contract型定義
- [ ] Customer型定義
- [ ] 在庫管理用型定義
- [ ] リクエストDTO型定義
- [ ] レスポンスDTO型定義
- [ ] TypeScriptコンパイル成功

### Phase 4: ユーティリティ関数
- [ ] inventoryUtils.ts 作成
- [ ] 在庫計算ロジック実装
- [ ] ステータス自動更新ロジック実装
- [ ] バリデーション実装
- [ ] ユーティリティ関数テスト作成
- [ ] テストカバレッジ100%確認

### Phase 5: Controller/Routes
- [ ] plotController.ts 書き換え完了
- [ ] plotRoutes.ts ルート追加完了
- [ ] contractController.ts 作成完了
- [ ] contractRoutes.ts 作成完了
- [ ] CollectiveBurial統合完了
- [ ] 全エンドポイント動作確認
- [ ] Postmanでの手動テスト完了

### Phase 6: テスト実装
- [ ] plotController.test.ts 書き換え完了
- [ ] contractController.test.ts 作成完了
- [ ] inventoryUtils.test.ts 作成完了
- [ ] plotRoutes.test.ts 書き換え完了
- [ ] contractRoutes.test.ts 作成完了
- [ ] collectiveBurialUtils.test.ts 更新完了
- [ ] テストカバレッジ基準達成
- [ ] 全テスト成功確認
- [ ] CI/CD パイプライン成功確認

### Phase 7: API仕様書更新
- [ ] swagger.yaml スキーマ定義追加
- [ ] swagger.yaml エンドポイント更新
- [ ] swagger.json 再生成
- [ ] Swagger検証成功
- [ ] Swagger UI 動作確認

### Phase 8: ドキュメント更新
- [ ] CLAUDE.md 更新
- [ ] README.md 更新
- [ ] CHANGELOG.md 更新
- [ ] 全ドキュメントレビュー完了

### Phase 9: 最終確認
- [ ] 全テスト実行成功
- [ ] カバレッジレポート確認
- [ ] CI/CD パイプライン確認
- [ ] Docker環境動作確認
- [ ] マイグレーション手順文書化
- [ ] デプロイ準備完了

## 承認

| 役割 | 氏名 | 承認日 | 署名 |
|-----|------|-------|------|
| プロジェクトオーナー | | | |
| システムアーキテクト | | | |
| 開発リーダー | | | |

---

**変更履歴**:
- 2025-11-25: v1.0.0 初版作成
