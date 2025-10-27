# Supabase認証セットアップガイド

このバックエンドはSupabase認証を使用しています。以下の手順に従ってセットアップしてください。

## 1. Supabaseプロジェクトの作成

1. [Supabase](https://supabase.com/)にアクセスしてアカウントを作成
2. 新しいプロジェクトを作成
3. データベースパスワードを設定（控えておく）

## 2. 環境変数の設定

`.env.example`をコピーして`.env`ファイルを作成してください：

```bash
cp .env.example .env
```

`.env`ファイルを編集し、以下の値を設定：

```env
# Supabaseプロジェクトの設定ページから取得
# https://app.supabase.com/project/{your-project-id}/settings/api

SUPABASE_URL="https://xxxxxxxxxxxxx.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 取得方法
1. Supabaseダッシュボードで該当プロジェクトを開く
2. **Settings** → **API** に移動
3. 以下をコピー：
   - **Project URL** → `SUPABASE_URL`
   - **Project API keys** の **service_role** → `SUPABASE_SERVICE_ROLE_KEY`

⚠️ **重要**: `service_role`キーは絶対に公開しないでください！

## 3. Supabaseユーザーの作成

### 方法1: Supabase Dashboardから作成（推奨）

1. Supabaseダッシュボードで **Authentication** → **Users** に移動
2. **Add user** をクリック
3. Email/Passwordでユーザーを作成：
   - Email: `admin@example.com`
   - Password: `admin123`
   - Auto Confirm User: **ON**（確認メールをスキップ）

4. 作成されたユーザーの **User UID**をコピー

5. バックエンドのStaffテーブルにsupabase_uidを登録：

```sql
-- PostgreSQLに接続して実行
UPDATE staff
SET supabase_uid = 'コピーしたUser UID'
WHERE email = 'admin@example.com';
```

または、Prisma Studioで編集：
```bash
npx prisma studio
```

### 方法2: フロントエンドから登録（サインアップAPI実装後）

フロントエンドでSupabase Auth APIを使用してユーザー登録：

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ユーザー登録
const { data, error } = await supabase.auth.signUp({
  email: 'admin@example.com',
  password: 'admin123',
});

// 登録後、バックエンドのStaffテーブルに紐付け
```

## 4. フロントエンド側の設定

フロントエンドには`anon key`を使用してください（service roleは使用しないこと）：

```typescript
// フロントエンド .env
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### ログインフロー例

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ログイン
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'admin@example.com',
  password: 'admin123'
});

if (data.session) {
  const token = data.session.access_token;

  // バックエンドAPIを呼び出し
  const response = await fetch('http://localhost:4000/api/v1/plots', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
}
```

## 5. 動作確認

### ステップ1: サーバー起動
```bash
npm run dev
```

### ステップ2: ログイン（フロントエンド）
```typescript
const { data } = await supabase.auth.signInWithPassword({
  email: 'admin@example.com',
  password: 'admin123'
});
```

### ステップ3: API呼び出し
```bash
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" \
     http://localhost:4000/api/v1/plots
```

## トラブルシューティング

### エラー: "ユーザーが登録されていません"
- Staffテーブルに`supabase_uid`が正しく設定されているか確認
- SupabaseとStaffテーブルのemailが一致しているか確認

### エラー: "無効なトークンです"
- トークンの有効期限が切れている可能性（再ログインしてください）
- SUPABASE_URLとSUPABASE_SERVICE_ROLE_KEYが正しいか確認

### エラー: "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set"
- `.env`ファイルが存在し、正しく設定されているか確認
- サーバーを再起動してください

## セキュリティ注意事項

1. **service_role key は絶対に公開しないこと**
   - Gitにコミットしない
   - フロントエンドで使用しない
   - ログに出力しない

2. **anon key のみフロントエンドで使用**
   - Row Level Security (RLS) と併用する
   - バックエンドAPIで権限チェックを実装済み

3. **本番環境では環境変数を安全に管理**
   - Vercel/Netlify/AWSなどの環境変数機能を使用
   - `.env`ファイルは`.gitignore`に含める

## 参考リンク

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
