# 本番環境設定ガイド

このドキュメントは、Cemetery CRM Backendを本番環境にデプロイする際に必要な設定について説明します。

## 環境変数の設定

### 必須の環境変数

#### 1. データベース設定
```bash
DATABASE_URL="postgresql://username:password@host:port/database"
```
- PostgreSQLの接続文字列を設定してください
- **セキュリティ**: パスワードは強固なものを使用してください

#### 2. サーバー設定
```bash
NODE_ENV=production
PORT=4000
```
- `NODE_ENV`は必ず`production`に設定してください
- `PORT`は使用するポート番号を指定してください（デフォルト: 4000）

#### 3. CORS設定 ⭐ 重要
```bash
ALLOWED_ORIGINS="https://yourdomain.com,https://app.yourdomain.com"
```

**ALLOWED_ORIGINS環境変数の設定は必須です！**

- フロントエンドアプリケーションのURLを指定してください
- 複数のオリジンを許可する場合は**カンマ区切り**で指定してください
- プロトコル（https://）を必ず含めてください
- **例**:
  - 単一オリジン: `ALLOWED_ORIGINS="https://example.com"`
  - 複数オリジン: `ALLOWED_ORIGINS="https://example.com,https://app.example.com,https://admin.example.com"`

**注意事項**:
- ⚠️ 本番環境では`ALLOWED_ORIGINS`を設定しないと、すべてのオリジンからのリクエストが拒否されます
- ⚠️ `http://`（非SSL）のオリジンは本番環境では推奨されません
- ⚠️ ワイルドカード（`*`）は使用できません。明示的にオリジンを指定してください

#### 4. Supabase設定（認証機能を使用する場合）
```bash
SUPABASE_URL="https://your-project-id.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"
```

- Supabaseプロジェクトの設定から取得してください
- **セキュリティ**: `SUPABASE_SERVICE_ROLE_KEY`は絶対に公開しないでください
- この環境変数が設定されていない場合、認証エンドポイントは503エラーを返します

## CORS設定の動作

### 開発環境（NODE_ENV=development）
- `ALLOWED_ORIGINS`が設定されていない場合、すべてのオリジンを許可します
- これにより、ローカル開発時にCORSエラーが発生しません
- `http://localhost:3000`など、任意のローカルURLからアクセス可能です

### 本番環境（NODE_ENV=production）
- `ALLOWED_ORIGINS`に明示的に指定されたオリジンのみを許可します
- 許可されていないオリジンからのリクエストは以下のエラーで拒否されます:
  ```
  CORS policy violation: Origin not allowed
  ```
- サーバーログに警告が記録されます:
  ```
  CORS blocked: https://unauthorized-domain.com is not in the allowed origins list
  ```

### サーバー間通信
- オリジンヘッダーが存在しない場合（サーバー間通信など）は常に許可されます
- これにより、APIからAPIへの通信が可能になります

## CORS設定の詳細

### 許可されるHTTPメソッド
- GET
- POST
- PUT
- DELETE
- PATCH
- OPTIONS

### 許可されるヘッダー
- Content-Type
- Authorization

### クレデンシャル（Cookie/認証ヘッダー）
- `credentials: true` - Cookie や Authorization ヘッダーを含むリクエストを許可

### プリフライトキャッシュ
- `maxAge: 86400` - プリフライトリクエストの結果を24時間キャッシュ

## セキュリティチェックリスト

本番環境にデプロイする前に、以下を確認してください:

- [ ] `NODE_ENV=production` が設定されている
- [ ] `ALLOWED_ORIGINS` に正しいフロントエンドURLが設定されている
- [ ] データベース接続文字列が正しく設定されている
- [ ] データベースのパスワードが強固である
- [ ] Supabase認証キーが正しく設定されている（認証機能を使用する場合）
- [ ] `.env`ファイルがGitにコミットされていない（`.gitignore`で除外）
- [ ] HTTPSを使用している（本番環境では必須）
- [ ] ファイアウォール設定が適切である
- [ ] データベースへのアクセスが制限されている

## デプロイ後の確認

### 1. ヘルスチェック
```bash
curl https://yourdomain.com/health
```

期待されるレスポンス:
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2025-11-18T12:00:00.000Z",
    "uptime": 123.456,
    "environment": "production"
  }
}
```

### 2. CORS設定の確認
フロントエンドアプリケーションから以下をテストしてください:
- ログインリクエストが成功すること
- APIリクエストがCORSエラーなく実行されること
- 認証トークンが正しく送信・受信されること

### 3. ログの確認
サーバーログをモニタリングして、以下を確認してください:
- `CORS blocked:` の警告が不正なアクセスのみに表示されること
- 正当なフロントエンドからのリクエストがブロックされていないこと

## トラブルシューティング

### CORSエラーが発生する場合

**症状**: ブラウザのコンソールに以下のようなエラーが表示される
```
Access to fetch at 'https://api.yourdomain.com/api/v1/...' from origin 'https://yourdomain.com'
has been blocked by CORS policy
```

**原因と解決策**:

1. **ALLOWED_ORIGINSが設定されていない**
   - 環境変数を確認: `echo $ALLOWED_ORIGINS`
   - 設定して再起動してください

2. **プロトコルの不一致**
   - フロントエンド: `https://example.com`
   - 設定: `http://example.com` ❌
   - 正しい設定: `https://example.com` ✅

3. **サブドメインの違い**
   - フロントエンド: `https://app.example.com`
   - 設定: `https://example.com` ❌
   - 正しい設定: `https://app.example.com` または両方を追加 ✅

4. **末尾のスラッシュ**
   - 設定は**スラッシュなし**で指定してください
   - 正しい: `https://example.com` ✅
   - 誤り: `https://example.com/` ❌

5. **ポート番号**
   - 標準ポート（443/HTTPS、80/HTTP）以外を使用する場合はポート番号を含めてください
   - 例: `https://example.com:8443`

### サーバーログの確認方法

不正なオリジンからのアクセスは以下のように記録されます:
```
CORS blocked: https://malicious-site.com is not in the allowed origins list
```

正当なアクセスはログに記録されず、正常に処理されます。

## 環境変数の管理方法

### 推奨される管理方法

1. **クラウドプロバイダーのシークレット管理**
   - AWS: Secrets Manager, Systems Manager Parameter Store
   - GCP: Secret Manager
   - Azure: Key Vault

2. **コンテナオーケストレーション**
   - Kubernetes: Secrets
   - Docker: Secrets

3. **PaaS環境**
   - Heroku: Config Vars
   - Vercel: Environment Variables
   - Render: Environment Variables

### 避けるべき方法
- ❌ `.env`ファイルをGitリポジトリにコミット
- ❌ 環境変数をコード内にハードコーディング
- ❌ 環境変数をログに出力

## 参考情報

### 関連ファイル
- `.env.example` - 環境変数のテンプレート
- `src/middleware/security.ts` - CORS設定の実装
- `src/index.ts` - サーバーのエントリーポイント
- `tests/middleware/security.test.ts` - CORS設定のテスト

### テストの実行
CORS設定のテストを実行して、正しく動作することを確認できます:
```bash
npm test -- tests/middleware/security.test.ts
```

すべてのテストがパスすることを確認してください。
