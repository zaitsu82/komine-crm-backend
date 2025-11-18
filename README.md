# Cemetery CRM Backend

Cemetery CRM（kurosakicrm）は、墓地・墓石管理を行うための包括的なバックエンドシステムです。

## 📋 目次

- [概要](#概要)
- [主な機能](#主な機能)
- [技術スタック](#技術スタック)
- [セットアップ](#セットアップ)
  - [ローカル環境](#ローカル環境)
  - [Docker環境](#docker環境)
- [開発ガイド](#開発ガイド)
- [テスト](#テスト)
- [API仕様](#api仕様)
- [デプロイメント](#デプロイメント)
- [ドキュメント](#ドキュメント)
- [ライセンス](#ライセンス)

---

## 📖 概要

Cemetery CRM Backendは、墓地管理業務のデジタル化を支援するREST APIサーバーです。区画管理、契約者情報、請求情報、履歴管理など、墓地運営に必要な機能を提供します。

### 特徴

- 🔐 **Supabase認証**: JWT認証とロールベースアクセス制御
- 📊 **包括的なデータ管理**: 区画、契約者、請求、埋葬者など全情報を一元管理
- 📝 **履歴追跡**: 全ての変更履歴を自動記録
- 🔒 **セキュリティ**: Helmet、CORS、Rate Limiting、XSS対策を実装
- ✅ **高品質**: テストカバレッジ（Functions 100%, Lines 99%, Statements 97%, Branches 81%）
- 🚀 **CI/CD対応**: GitHub Actionsによる自動テスト・ビルド
- 🐳 **Docker対応**: コンテナ化による簡単なデプロイメント

---

## 🚀 主な機能

### 区画管理（Plots）
- 区画の作成、更新、削除、検索
- 契約者情報、請求情報、埋葬者情報の統合管理
- 変更履歴の自動記録と参照

### 認証・認可
- Supabase JWTトークン認証
- ロールベースアクセス制御（viewer, operator, manager, admin）
- パスワード変更機能

### マスタデータ管理
- 使用状況、墓地種別、宗派、性別など各種マスタデータ
- 都道府県、支払方法、税区分などのコード管理

### セキュリティ
- CORS設定（オリジンホワイトリスト）
- Rate Limiting（DDoS対策）
- XSS対策（入力サニタイゼーション）
- HPP対策（HTTP Parameter Pollution）
- Helmet（セキュリティヘッダー）

---

## 🛠️ 技術スタック

### バックエンド
- **Node.js** (v18.x / v20.x / v22.x)
- **TypeScript** (v5.8.3)
- **Express.js** (v4.19.2)

### データベース
- **PostgreSQL** (v16)
- **Prisma ORM** (v6.9.0)

### 認証
- **Supabase** (v2.76.1)

### セキュリティ
- **Helmet** - セキュリティヘッダー
- **CORS** - クロスオリジンリソース共有
- **express-rate-limit** - レート制限
- **HPP** - HTTP Parameter Pollution対策

### テスト
- **Jest** (v30.1.3)
- **Supertest** (v7.1.4)
- **Playwright** (v1.55.0) - E2Eテスト

### コード品質
- **ESLint** (v8.57.1)
- **Prettier** (v3.6.2)
- **Husky** - Gitフック
- **lint-staged** - ステージングファイルのLint

### CI/CD
- **GitHub Actions** - 自動テスト・ビルド
- **Codecov** - カバレッジレポート

### コンテナ化
- **Docker** - コンテナ化
- **Docker Compose** - マルチコンテナ管理

---

## ⚙️ セットアップ

### 前提条件

- **Node.js**: v18.x, v20.x, v22.xのいずれか
- **PostgreSQL**: v16以降（Dockerを使用する場合は不要）
- **npm**: v8以降

### ローカル環境

#### 1. リポジトリのクローン

```bash
git clone https://github.com/your-org/cemetery-crm-backend.git
cd cemetery-crm-backend
```

#### 2. 依存関係のインストール

```bash
npm install
```

#### 3. 環境変数の設定

```bash
# .env.exampleをコピーして.envを作成
cp .env.example .env

# .envファイルを編集
# 必要な値を設定:
# - DATABASE_URL
# - SUPABASE_URL
# - SUPABASE_SERVICE_ROLE_KEY
# - ALLOWED_ORIGINS
```

#### 4. Prismaのセットアップ

```bash
# Prismaクライアント生成
npx prisma generate

# データベースマイグレーション
npx prisma migrate dev

# （任意）テストデータの投入
node scripts/insert-test-data.js
```

#### 5. 開発サーバー起動

```bash
npm run dev
```

サーバーは `http://localhost:4000` で起動します。

ヘルスチェック: `http://localhost:4000/health`

---

### Docker環境

Docker環境では、アプリケーションとPostgreSQLデータベースが自動的にセットアップされます。

#### 前提条件

- **Docker**: v20.10以降
- **Docker Compose**: v2.0以降

#### クイックスタート

```bash
# 1. 環境変数設定
cp .env.example .env
# .envファイルを編集（特にDB_USER, DB_PASSWORD, DB_NAMEを確認）

# 2. Docker Composeで起動（本番環境モード）
docker compose up -d

# または開発環境モード（ホットリロード有効）
docker compose -f docker-compose.dev.yml up -d

# 3. 動作確認
curl http://localhost:4000/health

# 4. ログ確認
docker compose logs -f app

# 5. 停止
docker compose down
```

#### Docker詳細ガイド

Docker環境の詳細なセットアップ手順、トラブルシューティング、パフォーマンスチューニングについては、以下のドキュメントを参照してください：

📖 **[DOCKER_SETUP.md](./DOCKER_SETUP.md)** - Docker環境セットアップガイド

主なトピック：
- 開発環境と本番環境の違い
- データベースマイグレーション
- コンテナ管理コマンド
- トラブルシューティング
- セキュリティベストプラクティス

---

## 💻 開発ガイド

### スクリプト一覧

```bash
# 開発サーバー起動（ホットリロード）
npm run dev

# 本番用ビルド
npm run build

# 本番サーバー起動（ビルド後）
npm start

# テスト実行
npm test                    # 全テスト実行
npm run test:watch          # ウォッチモード
npm run test:coverage       # カバレッジレポート生成
npm run test:e2e            # E2Eテスト（Playwright）

# コード品質
npm run lint                # ESLintチェック
npm run lint:fix            # ESLint自動修正
npm run format              # Prettierフォーマット
npm run format:check        # フォーマットチェック

# API仕様書
npm run swagger:validate    # OpenAPI仕様検証
npm run swagger:json        # YAML→JSON変換
npm run swagger:build       # 仕様書ビルド

# データベース
npx prisma generate         # Prismaクライアント生成
npx prisma migrate dev      # マイグレーション作成・適用
npx prisma migrate deploy   # 本番環境マイグレーション
npx prisma studio           # Prisma Studio起動
```

### コーディング規約

- **ESLint**: コードの静的解析とスタイル統一
- **Prettier**: コードフォーマット統一
- **Pre-commit hooks**: コミット前に自動でlint + format実行
- **TypeScript strict mode**: 厳格な型チェック

### ブランチ戦略

- `main`: 本番環境用ブランチ
- `develop`: 開発用メインブランチ
- `feature/*`: 機能開発ブランチ

### コミット時の注意

Huskyによりコミット前に以下が自動実行されます：
- ESLintによる構文チェック
- Prettierによるフォーマット

---

## ✅ テスト

### テスト実行

```bash
# 全テスト実行
npm test

# カバレッジレポート生成
npm run test:coverage

# 特定のテストファイル実行
npm test -- tests/plots/plotController.test.ts

# テスト名でフィルタ
npm test -- --testNamePattern="GET /api/v1/plots"
```

### カバレッジ目標

現在のカバレッジ（424テスト）:
- **Functions**: 100%
- **Lines**: 99.16%
- **Statements**: 97.87%
- **Branches**: 81.72%

### E2Eテスト

```bash
# Playwrightテスト実行
npm run test:e2e

# UIモードで実行
npm run test:e2e:ui

# デバッグモード
npm run test:e2e:debug
```

---

## 📚 API仕様

### OpenAPI仕様書

- **swagger.yaml** - YAML形式のAPI仕様書
- **swagger.json** - JSON形式のAPI仕様書

### 主要エンドポイント

#### 認証
- `POST /api/v1/auth/login` - ログイン
- `POST /api/v1/auth/logout` - ログアウト
- `GET /api/v1/auth/me` - 現在のユーザー情報取得
- `POST /api/v1/auth/change-password` - パスワード変更

#### 区画管理
- `GET /api/v1/plots` - 区画一覧取得
- `GET /api/v1/plots/:id` - 区画詳細取得
- `POST /api/v1/plots` - 区画新規作成
- `PUT /api/v1/plots/:id` - 区画更新
- `DELETE /api/v1/plots/:id` - 区画削除

#### マスタデータ
- `GET /api/v1/masters/:type` - マスタデータ取得

詳細は `swagger.yaml` を参照してください。

---

## 🚀 デプロイメント

### 本番環境セットアップ

本番環境へのデプロイ手順、環境変数設定、セキュリティチェックリストについては、以下のドキュメントを参照してください：

📖 **[PRODUCTION_SETUP.md](./PRODUCTION_SETUP.md)** - 本番環境セットアップガイド

### CI/CD

GitHub Actionsによる自動テスト・ビルドパイプラインを実装しています。

📖 **[CI_CD_SETUP.md](./CI_CD_SETUP.md)** - CI/CDセットアップガイド

#### CI/CDワークフロー

- ✅ **Build**: TypeScriptコンパイルチェック
- ✅ **Lint & Format Check**: ESLint + Prettier検証
- ✅ **Swagger Validation**: API仕様書検証
- ✅ **Test**: 複数Node.jsバージョン（18.x, 20.x, 22.x）でテスト実行
- ✅ **Coverage**: Codecovへカバレッジレポート送信

---

## 📖 ドキュメント

### 主要ドキュメント

- **[README.md](./README.md)** - このファイル（プロジェクト概要）
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - 貢献者向けガイドライン
- **[CHANGELOG.md](./CHANGELOG.md)** - 変更履歴
- **[CLAUDE.md](./CLAUDE.md)** - プロジェクト概要と開発ガイドライン
- **[DOCKER_SETUP.md](./DOCKER_SETUP.md)** - Docker環境セットアップ
- **[PRODUCTION_SETUP.md](./PRODUCTION_SETUP.md)** - 本番環境セットアップ
- **[CI_CD_SETUP.md](./CI_CD_SETUP.md)** - CI/CDセットアップ
- **[TODO.md](./TODO.md)** - タスク管理と進捗状況

### API仕様書

- **[swagger.yaml](./swagger.yaml)** - OpenAPI 3.0仕様書（YAML）
- **[swagger.json](./swagger.json)** - OpenAPI 3.0仕様書（JSON）

### データベース

- **[prisma/schema.prisma](./prisma/schema.prisma)** - Prismaスキーマ定義

---

## 🔒 セキュリティ

### 実装済みセキュリティ対策

- **Helmet**: セキュリティヘッダー設定（CSP, HSTS, X-Frame-Options等）
- **CORS**: オリジンホワイトリスト
- **Rate Limiting**: DDoS対策（100 req/15min）
- **HPP Protection**: HTTP Parameter Pollution対策
- **XSS Protection**: 入力サニタイゼーション
- **JWT認証**: Supabaseベースのトークン認証
- **Role-based Access Control**: ロールベースの権限管理

### セキュリティベストプラクティス

1. `.env`ファイルをGitにコミットしない
2. 本番環境では強力なパスワードを使用
3. `ALLOWED_ORIGINS`を適切に設定
4. 定期的な依存関係の更新（`npm audit`）
5. ログから機密情報を除外

---

## 🤝 貢献

貢献は歓迎します！詳細な貢献ガイドラインは **[CONTRIBUTING.md](./CONTRIBUTING.md)** を参照してください。

### クイックスタート

1. このリポジトリをフォーク
2. 機能ブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add some amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. Pull Requestを作成

### コミット前のチェック

```bash
# Lint & Format
npm run lint
npm run format

# テスト実行
npm test

# カバレッジ確認
npm run test:coverage
```

### その他の貢献方法

- バグ報告（Issue作成）
- 機能提案（Issue作成）
- ドキュメント改善
- コードレビュー

詳細は **[CONTRIBUTING.md](./CONTRIBUTING.md)** をご覧ください。

---

## 📄 ライセンス

このプロジェクトのライセンス情報については、LICENSEファイルを参照してください。

---

## 🆘 サポート

問題が発生した場合は、以下を確認してください：

1. [GitHub Issues](https://github.com/your-org/cemetery-crm-backend/issues)
2. ドキュメント: `CLAUDE.md`, `DOCKER_SETUP.md`, `PRODUCTION_SETUP.md`
3. API仕様書: `swagger.yaml`

---

**最終更新**: 2025-11-19
**バージョン**: 1.0.0
