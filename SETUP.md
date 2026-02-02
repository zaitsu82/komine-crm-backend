# セットアップガイド

Cemetery CRM Backend の環境構築・設定ガイド

## 目次

1. [環境変数の設定](#環境変数の設定)
2. [Dockerセットアップ](#dockerセットアップ)
3. [Supabase認証](#supabase認証)
4. [CI/CDセットアップ](#cicdセットアップ)
5. [本番環境デプロイ](#本番環境デプロイ)

---

## 環境変数の設定

### 初期設定

```bash
cp .env.example .env
```

### 必須項目

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `DATABASE_URL` | PostgreSQL接続文字列 | `postgresql://user:pass@localhost:5432/db` |
| `NODE_ENV` | 環境モード | `development` / `production` |
| `PORT` | サーバーポート | `4000` |
| `ALLOWED_ORIGINS` | CORS許可オリジン（カンマ区切り） | `https://app.example.com` |
| `SUPABASE_URL` | SupabaseプロジェクトURL | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabaseサービスキー | `eyJ...` |

### CORS設定

- **開発環境**: `ALLOWED_ORIGINS`未設定で全オリジン許可
- **本番環境**: 明示的に指定したオリジンのみ許可
- プロトコル（https://）を必ず含める
- 末尾スラッシュは不要

---

## Dockerセットアップ

### クイックスタート

```bash
# 本番環境
docker compose up -d

# 開発環境（ホットリロード有効）
docker compose -f docker-compose.dev.yml up -d
```

### 基本コマンド

```bash
# 停止
docker compose down

# ログ確認
docker compose logs -f app

# コンテナ内でコマンド実行
docker compose exec app sh

# DB接続
docker compose exec db psql -U cemetery_user -d komine_cemetery_crm
```

### Prismaマイグレーション

```bash
# 本番環境
docker compose exec app npx prisma migrate deploy

# 開発環境
docker compose -f docker-compose.dev.yml exec app npx prisma migrate dev
```

### トラブルシューティング

| 症状 | 解決策 |
|------|--------|
| DB接続エラー | `docker compose logs db` で確認、`docker compose restart db` |
| ポート使用中 | `.env`で`PORT`を変更 |
| Prismaエラー | `docker compose exec app npx prisma generate` |

---

## Supabase認証

### セットアップ手順

1. [Supabase](https://supabase.com/)でプロジェクト作成
2. **Settings** → **API** から以下を取得:
   - Project URL → `SUPABASE_URL`
   - service_role key → `SUPABASE_SERVICE_ROLE_KEY`

### ユーザー作成

1. Supabaseダッシュボード → **Authentication** → **Users**
2. **Add user** でユーザー作成（Auto Confirm: ON）
3. User UIDをコピーし、Staffテーブルに登録:

```sql
UPDATE staff SET supabase_uid = 'User UID' WHERE email = 'user@example.com';
```

### フロントエンド連携

```typescript
const { data } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password'
});

// APIリクエスト
fetch('/api/v1/plots', {
  headers: { 'Authorization': `Bearer ${data.session.access_token}` }
});
```

---

## CI/CDセットアップ

### GitHub Actions

`.github/workflows/ci.yml` が設定済み。以下が自動実行されます:

- Build（TypeScriptコンパイル）
- Lint & Format Check
- Swagger Validation
- Test（Node.js 18.x, 20.x, 22.x）
- Coverage Report

### Codecov連携（オプション）

1. https://codecov.io/ でリポジトリ追加
2. Repository Upload Tokenを取得
3. GitHub Secrets に `CODECOV_TOKEN` を追加

### ブランチ保護ルール（推奨）

Settings → Branches → Add rule:

- **Require status checks**: Build, Lint, Test, All Checks Passed
- **Require pull request**: 1 approval
- **Require conversation resolution**

---

## 本番環境デプロイ

### セキュリティチェックリスト

- [ ] `NODE_ENV=production`
- [ ] `ALLOWED_ORIGINS` に正しいフロントエンドURL
- [ ] 強固なDBパスワード
- [ ] HTTPS使用
- [ ] `.env`がGitにコミットされていない

### デプロイ後の確認

```bash
# ヘルスチェック
curl https://yourdomain.com/health

# 期待されるレスポンス
{
  "success": true,
  "data": {
    "status": "ok",
    "environment": "production"
  }
}
```

### 環境変数の管理（推奨）

- AWS: Secrets Manager / Parameter Store
- GCP: Secret Manager
- Kubernetes: Secrets

---

## 参考リンク

- [Supabase Documentation](https://supabase.com/docs)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [Docker Documentation](https://docs.docker.com/)
- [GitHub Actions](https://docs.github.com/en/actions)
