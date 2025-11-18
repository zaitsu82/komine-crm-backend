# Docker セットアップガイド

Cemetery CRM Backend のDocker環境構築ガイド

## 📋 目次

- [概要](#概要)
- [前提条件](#前提条件)
- [クイックスタート](#クイックスタート)
- [開発環境セットアップ](#開発環境セットアップ)
- [本番環境セットアップ](#本番環境セットアップ)
- [Dockerコマンドリファレンス](#dockerコマンドリファレンス)
- [データベースマイグレーション](#データベースマイグレーション)
- [トラブルシューティング](#トラブルシューティング)
- [セキュリティベストプラクティス](#セキュリティベストプラクティス)
- [パフォーマンスチューニング](#パフォーマンスチューニング)

---

## 📖 概要

このプロジェクトは、Dockerを使用してバックエンドアプリケーションとPostgreSQLデータベースをコンテナ化しています。

### アーキテクチャ

```
┌─────────────────────────────────────────┐
│  Docker Compose                         │
│  ┌───────────────┐  ┌───────────────┐  │
│  │ App Container │  │  DB Container │  │
│  │ (Node.js)     │  │  (PostgreSQL) │  │
│  │ Port: 4000    │  │  Port: 5432   │  │
│  └───────────────┘  └───────────────┘  │
│         │                    │          │
│         └────────┬───────────┘          │
│                  │                      │
│         cemetery-crm-network            │
└─────────────────────────────────────────┘
```

### 提供されるファイル

- **Dockerfile** - 本番環境用イメージ（マルチステージビルド）
- **Dockerfile.dev** - 開発環境用イメージ（ホットリロード対応）
- **docker-compose.yml** - 本番環境用Docker Compose設定
- **docker-compose.dev.yml** - 開発環境用Docker Compose設定
- **.dockerignore** - Dockerビルド時の除外ファイル定義

---

## 🔧 前提条件

### 必須

- **Docker**: 20.10以降
- **Docker Compose**: v2.0以降

### インストール確認

```bash
docker --version
# Docker version 20.10.x以降

docker compose version
# Docker Compose version v2.x.x以降
```

### Docker のインストール

- **Windows/Mac**: [Docker Desktop](https://www.docker.com/products/docker-desktop)
- **Linux**: [Docker Engine](https://docs.docker.com/engine/install/)

---

## 🚀 クイックスタート

### 1. 環境変数の設定

```bash
# .env.example をコピーして .env を作成
cp .env.example .env

# .env ファイルを編集（必要に応じて値を変更）
# 特に以下の項目を確認：
# - DB_USER, DB_PASSWORD, DB_NAME
# - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
# - ALLOWED_ORIGINS
```

### 2. Docker Composeで起動

```bash
# 本番環境モード
docker compose up -d

# または開発環境モード（ホットリロード有効）
docker compose -f docker-compose.dev.yml up -d
```

### 3. 動作確認

```bash
# ヘルスチェック
curl http://localhost:4000/health

# ログ確認
docker compose logs -f app
```

### 4. 停止

```bash
# 本番環境
docker compose down

# 開発環境
docker compose -f docker-compose.dev.yml down
```

---

## 💻 開発環境セットアップ

開発環境では、ソースコードの変更が即座に反映されるホットリロード機能が有効です。

### 起動

```bash
# コンテナをビルド＆起動
docker compose -f docker-compose.dev.yml up --build

# バックグラウンドで起動
docker compose -f docker-compose.dev.yml up -d
```

### 特徴

- **ホットリロード**: `src/`ディレクトリの変更を自動検出
- **デバッグモード**: `ts-node-dev`による開発サーバー
- **CORS設定**: すべてのオリジンを許可（開発用）

### ソースコード変更の反映

ホストマシンの`src/`ディレクトリがコンテナにマウントされているため、ファイルを編集すると自動的にサーバーが再起動します。

### Prismaスキーマ変更時

```bash
# Prismaクライアントを再生成
docker compose -f docker-compose.dev.yml exec app npx prisma generate

# マイグレーション実行
docker compose -f docker-compose.dev.yml exec app npx prisma migrate dev
```

---

## 🏭 本番環境セットアップ

本番環境では、最適化されたマルチステージビルドイメージを使用します。

### ビルド

```bash
# イメージをビルド
docker compose build

# キャッシュを使わずにビルド
docker compose build --no-cache
```

### 起動

```bash
# コンテナを起動
docker compose up -d

# ログを確認
docker compose logs -f
```

### 環境変数の設定

本番環境では、以下の環境変数を必ず設定してください：

```env
NODE_ENV=production
DATABASE_URL=postgresql://user:password@db:5432/dbname
ALLOWED_ORIGINS=https://your-frontend-domain.com
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### セキュリティ注意事項

- `.env`ファイルは絶対にGitリポジトリにコミットしない
- 強力なデータベースパスワードを使用
- `ALLOWED_ORIGINS`を適切に設定（本番ドメインのみ）

---

## 📚 Dockerコマンドリファレンス

### 基本操作

```bash
# コンテナ起動
docker compose up -d

# コンテナ停止
docker compose down

# コンテナ再起動
docker compose restart

# コンテナ状態確認
docker compose ps

# ログ確認（リアルタイム）
docker compose logs -f

# 特定サービスのログ
docker compose logs -f app
docker compose logs -f db
```

### イメージ管理

```bash
# イメージビルド
docker compose build

# イメージ一覧
docker images | grep cemetery-crm

# 未使用イメージ削除
docker image prune

# すべての未使用リソース削除
docker system prune -a
```

### コンテナ操作

```bash
# コンテナ内でコマンド実行
docker compose exec app sh

# データベースコンテナに接続
docker compose exec db psql -U cemetery_user -d komine_cemetery_crm

# アプリケーションコンテナでnpmコマンド実行
docker compose exec app npm test
docker compose exec app npm run lint
```

### ボリューム管理

```bash
# ボリューム一覧
docker volume ls

# データベースボリュームを含めて完全削除
docker compose down -v

# 特定ボリュームの削除
docker volume rm cemetery-crm-backend_postgres_data
```

---

## 🗄️ データベースマイグレーション

### 初回セットアップ

```bash
# コンテナ起動後、Prismaマイグレーション実行
docker compose exec app npx prisma migrate deploy

# または開発環境
docker compose -f docker-compose.dev.yml exec app npx prisma migrate dev
```

### マイグレーション作成

```bash
# 開発環境でマイグレーション作成
docker compose -f docker-compose.dev.yml exec app npx prisma migrate dev --name add_new_field

# 本番環境へ適用
docker compose exec app npx prisma migrate deploy
```

### Prisma Studio（DBブラウザ）

```bash
# Prisma Studioを起動（ポート5555）
docker compose exec app npx prisma studio
```

ブラウザで `http://localhost:5555` を開く

### データベースバックアップ

```bash
# データベース全体をバックアップ
docker compose exec db pg_dump -U cemetery_user komine_cemetery_crm > backup.sql

# バックアップからリストア
docker compose exec -T db psql -U cemetery_user komine_cemetery_crm < backup.sql
```

---

## 🔍 トラブルシューティング

### コンテナが起動しない

```bash
# ログを確認
docker compose logs

# 特定サービスのログ
docker compose logs app
docker compose logs db

# コンテナの状態確認
docker compose ps
```

### データベース接続エラー

**症状**: `ECONNREFUSED` または `Connection refused`

**解決策**:

```bash
# データベースコンテナのヘルスチェック確認
docker compose ps

# データベースログ確認
docker compose logs db

# データベースコンテナ再起動
docker compose restart db
```

### ポートが既に使用中

**症状**: `Bind for 0.0.0.0:4000 failed: port is already allocated`

**解決策**:

```bash
# ポートを使用しているプロセスを確認（Windows）
netstat -ano | findstr :4000

# ポートを使用しているプロセスを確認（Linux/Mac）
lsof -i :4000

# .envファイルでポート変更
PORT=4001
```

### Prismaクライアントエラー

**症状**: `Prisma Client not generated`

**解決策**:

```bash
# Prismaクライアント再生成
docker compose exec app npx prisma generate

# コンテナ再ビルド
docker compose up --build
```

### ホットリロードが動作しない（開発環境）

**解決策**:

```bash
# コンテナ再起動
docker compose -f docker-compose.dev.yml restart app

# ボリュームマウント確認
docker compose -f docker-compose.dev.yml exec app ls -la /app/src
```

### メモリ不足エラー

**症状**: `Cannot allocate memory`

**解決策**:

Docker Desktopの設定でメモリを増やす（推奨: 4GB以上）

### パーミッションエラー

**症状**: `Permission denied`

**解決策**:

```bash
# Linuxの場合、ボリュームの所有権を変更
sudo chown -R $USER:$USER .

# または、Dockerfileのユーザー設定を確認
```

---

## 🔒 セキュリティベストプラクティス

### 1. 環境変数の管理

- `.env`ファイルをGitにコミットしない（`.gitignore`に追加済み）
- 本番環境では環境変数を直接設定（AWS Secrets Manager、Azure Key Vault等を使用）
- デフォルトパスワードを変更する

### 2. ネットワーク分離

```yaml
# docker-compose.ymlではネットワークが分離されている
networks:
  cemetery-crm-network:
    driver: bridge
```

### 3. 非rootユーザーでの実行

Dockerfileで非rootユーザー（nodejs:1001）で実行するように設定済み

### 4. ヘルスチェック

コンテナのヘルスチェックが設定されており、異常時に自動再起動

### 5. セキュリティスキャン

```bash
# Dockerイメージの脆弱性スキャン
docker scout cves cemetery-crm-backend

# または Trivy を使用
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy image cemetery-crm-backend
```

---

## ⚡ パフォーマンスチューニング

### 1. マルチステージビルドの活用

Dockerfileで既に実装済み：
- **Stage 1 (deps)**: 本番依存関係のみインストール
- **Stage 2 (builder)**: TypeScriptビルド
- **Stage 3 (production)**: 最終イメージ（最小サイズ）

### 2. イメージサイズの確認

```bash
# イメージサイズ確認
docker images | grep cemetery-crm

# レイヤー詳細確認
docker history cemetery-crm-backend
```

### 3. キャッシュの活用

```bash
# ビルドキャッシュを使用
docker compose build

# キャッシュを使わずにクリーンビルド
docker compose build --no-cache
```

### 4. データベース接続プール

`prisma/schema.prisma`で接続プール設定を調整：

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// 本番環境では接続プールを設定
// DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=20&pool_timeout=20"
```

### 5. リソース制限

```yaml
# docker-compose.ymlでリソース制限を追加（任意）
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

---

## 📖 関連ドキュメント

- [README.md](./README.md) - プロジェクト概要
- [PRODUCTION_SETUP.md](./PRODUCTION_SETUP.md) - 本番環境設定ガイド
- [CI_CD_SETUP.md](./CI_CD_SETUP.md) - CI/CDセットアップガイド
- [CLAUDE.md](./CLAUDE.md) - 開発ガイドライン

---

## 🆘 サポート

問題が解決しない場合は、以下を確認してください：

1. [GitHub Issues](https://github.com/your-org/cemetery-crm-backend/issues)
2. Docker公式ドキュメント: https://docs.docker.com/
3. Prisma公式ドキュメント: https://www.prisma.io/docs/

---

**最終更新**: 2025-11-19
