# Contributing to Cemetery CRM Backend

Cemetery CRM Backendへの貢献に興味を持っていただき、ありがとうございます！

このドキュメントでは、プロジェクトへの貢献方法について説明します。

## 📋 目次

- [行動規範](#行動規範)
- [はじめに](#はじめに)
- [開発環境のセットアップ](#開発環境のセットアップ)
- [開発ワークフロー](#開発ワークフロー)
- [コーディング規約](#コーディング規約)
- [コミット規約](#コミット規約)
- [プルリクエスト](#プルリクエスト)
- [テスト要件](#テスト要件)
- [ドキュメント更新](#ドキュメント更新)
- [質問・サポート](#質問サポート)

---

## 📜 行動規範

### 基本原則

- **尊重**: すべての貢献者を尊重し、建設的なフィードバックを提供します
- **協力**: オープンで協力的な環境を維持します
- **包括性**: すべてのバックグラウンドを持つ人々を歓迎します
- **プロフェッショナリズム**: 技術的な議論では事実とデータに基づいて判断します

### 禁止事項

- ハラスメント、差別的発言
- 個人攻撃や侮辱的なコメント
- 不適切な言葉遣いや画像
- プライバシーの侵害

違反行為を発見した場合は、プロジェクトメンテナーに報告してください。

---

## 🚀 はじめに

### 貢献の方法

以下の方法でプロジェクトに貢献できます：

1. **バグ報告**: 問題を発見した場合はIssueを作成
2. **機能提案**: 新機能のアイデアをIssueで提案
3. **コード貢献**: バグ修正や新機能の実装
4. **ドキュメント改善**: ドキュメントの誤字修正や内容改善
5. **レビュー**: 他の貢献者のPRをレビュー

### 初めての貢献者向け

以下のラベルが付いたIssueから始めることをお勧めします：

- `good first issue` - 初心者向けのタスク
- `help wanted` - コミュニティの助けが必要なタスク
- `documentation` - ドキュメント関連のタスク

---

## ⚙️ 開発環境のセットアップ

### 前提条件

- **Node.js**: v18.x, v20.x, v22.xのいずれか
- **PostgreSQL**: v16以降（Dockerを使用する場合は不要）
- **Git**: 最新版
- **Docker**: v20.10以降（任意）

### セットアップ手順

#### 1. リポジトリのフォーク

GitHubでこのリポジトリをフォークします。

#### 2. クローン

```bash
git clone https://github.com/your-username/cemetery-crm-backend.git
cd cemetery-crm-backend
```

#### 3. 依存関係のインストール

```bash
npm install
```

#### 4. 環境変数の設定

```bash
cp .env.example .env
# .envファイルを編集して必要な値を設定
```

#### 5. データベースのセットアップ

**ローカル環境**:
```bash
npx prisma generate
npx prisma migrate dev
```

**Docker環境**:
```bash
docker compose -f docker-compose.dev.yml up -d
```

#### 6. 開発サーバー起動

```bash
npm run dev
```

#### 7. 動作確認

```bash
curl http://localhost:4000/health
```

詳細は[README.md](./README.md)を参照してください。

---

## 🔄 開発ワークフロー

### ブランチ戦略

このプロジェクトは以下のブランチ戦略を使用します：

- **`main`** - 本番環境用の安定版ブランチ
- **`develop`** - 開発用のメインブランチ
- **`feature/*`** - 新機能開発用ブランチ
- **`fix/*`** - バグ修正用ブランチ
- **`docs/*`** - ドキュメント更新用ブランチ
- **`refactor/*`** - リファクタリング用ブランチ

### 開発の流れ

#### 1. 最新のdevelopブランチを取得

```bash
git checkout develop
git pull origin develop
```

#### 2. 作業用ブランチを作成

```bash
# 新機能の場合
git checkout -b feature/your-feature-name

# バグ修正の場合
git checkout -b fix/issue-123

# ドキュメント更新の場合
git checkout -b docs/update-readme
```

#### 3. 変更を実装

コーディング規約に従ってコードを記述します。

#### 4. テストを実行

```bash
# 全テスト実行
npm test

# カバレッジ確認
npm run test:coverage

# Lint & Format
npm run lint
npm run format
```

#### 5. コミット

```bash
git add .
git commit -m "適切なコミットメッセージ"
```

コミットメッセージは[コミット規約](#コミット規約)に従ってください。

#### 6. リモートにプッシュ

```bash
git push origin feature/your-feature-name
```

#### 7. プルリクエスト作成

GitHubでプルリクエストを作成し、`develop`ブランチへマージを依頼します。

---

## 📝 コーディング規約

### TypeScript

- **厳格モード**: TypeScriptの`strict`モードを使用
- **型定義**: `any`型の使用を避け、適切な型を定義
- **命名規則**:
  - 変数・関数: `camelCase`
  - クラス・インターフェース: `PascalCase`
  - 定数: `UPPER_SNAKE_CASE`
  - ファイル名: `camelCase.ts`

### コードスタイル

- **ESLint**: コードの静的解析に使用
- **Prettier**: コードフォーマットに使用
- **インデント**: スペース2文字
- **セミコロン**: 必須
- **引用符**: シングルクォート（文字列）

### ファイル構成

```
src/
├── entity-name/
│   ├── entityController.ts    # ビジネスロジック
│   ├── entityRoutes.ts        # ルート定義
│   └── entityTypes.ts         # 型定義（必要に応じて）
├── middleware/                # ミドルウェア
├── utils/                     # ユーティリティ関数
└── types.ts                   # 共通型定義
```

### ベストプラクティス

#### 1. エラーハンドリング

```typescript
// 良い例
try {
  const result = await someOperation();
  return result;
} catch (error) {
  throw new ValidationError('Operation failed', [
    { message: error.message }
  ]);
}

// 悪い例
try {
  const result = await someOperation();
  return result;
} catch (error) {
  console.log(error); // エラーを適切に処理していない
}
```

#### 2. 非同期処理

```typescript
// 良い例
async function fetchData() {
  const data = await prisma.plot.findMany();
  return data;
}

// 悪い例
function fetchData() {
  return prisma.plot.findMany().then(data => data); // async/awaitを使う
}
```

#### 3. データベース操作

```typescript
// 良い例 - トランザクション使用
await prisma.$transaction(async (tx) => {
  const plot = await tx.plot.create({ data: plotData });
  await tx.history.create({ data: historyData });
});

// 悪い例 - トランザクション未使用
await prisma.plot.create({ data: plotData });
await prisma.history.create({ data: historyData });
```

#### 4. セキュリティ

- **入力検証**: すべてのユーザー入力を検証
- **SQL注入対策**: Prismaを使用（生SQLは避ける）
- **XSS対策**: 入力サニタイゼーション実施
- **認証・認可**: 適切な権限チェック

```typescript
// 良い例
if (!req.user || req.user.role !== 'admin') {
  throw new ForbiddenError('Admin access required');
}

// 悪い例
if (req.user?.role !== 'admin') {
  return res.status(403).json({ error: 'Forbidden' }); // エラーハンドラーを通すべき
}
```

---

## 💬 コミット規約

### フォーマット

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type（必須）

- **feat**: 新機能追加
- **fix**: バグ修正
- **docs**: ドキュメント変更
- **style**: コードフォーマット（機能変更なし）
- **refactor**: リファクタリング
- **test**: テスト追加・修正
- **chore**: ビルドプロセスやツール変更

### Scope（任意）

変更の範囲を示します：`plots`, `auth`, `middleware`, `database`, `ci`, etc.

### Subject（必須）

- 50文字以内
- 動詞の原形で始める（英語の場合）
- 末尾にピリオド不要

### 例

```
feat(plots): 区画情報の履歴追跡機能を追加

区画情報のCREATE/UPDATE時に自動的に履歴を記録する機能を実装。
変更フィールド、変更者、IPアドレスを記録。

Closes #123
```

```
fix(auth): パスワード変更時のトークン検証エラーを修正

Supabaseトークンの有効期限チェックが正しく動作していなかった問題を修正。

Fixes #456
```

```
docs(readme): Docker環境のセットアップ手順を追加
```

### コミット前の自動チェック

Huskyにより、コミット前に以下が自動実行されます：

- ESLintによる構文チェック
- Prettierによるフォーマット

エラーがある場合はコミットがブロックされます。

---

## 🔀 プルリクエスト

### PRを作成する前に

- [ ] すべてのテストがパスすることを確認
- [ ] Lint/Formatエラーがないことを確認
- [ ] カバレッジが低下していないことを確認
- [ ] 関連するドキュメントを更新
- [ ] コミットメッセージが規約に従っていることを確認

### PRテンプレート

PRを作成する際は、以下の情報を含めてください：

```markdown
## 概要
この変更の目的と背景を簡潔に説明

## 変更内容
- 変更点1
- 変更点2
- 変更点3

## 関連Issue
Closes #issue-number

## テスト
- [ ] 既存のテストがすべてパス
- [ ] 新しいテストを追加（該当する場合）
- [ ] 手動テストを実施

## スクリーンショット（該当する場合）
変更の視覚的な確認

## チェックリスト
- [ ] コードがコーディング規約に従っている
- [ ] 自分でコードレビューを実施
- [ ] ドキュメントを更新
- [ ] テストを追加・更新
- [ ] カバレッジが維持されている
```

### レビュープロセス

1. **CI/CDチェック**: GitHub Actionsによる自動チェック
   - ビルド成功
   - テスト成功
   - Lint/Formatチェック成功
   - Swagger検証成功

2. **コードレビュー**: 最低1名のメンテナーによるレビュー
   - コードの品質
   - テストの妥当性
   - ドキュメントの正確性
   - セキュリティの考慮

3. **フィードバック対応**: レビューコメントに対応

4. **マージ**: メンテナーが承認後、`develop`ブランチにマージ

### レビュー時の注意点

#### レビュアー

- 建設的なフィードバックを提供
- 代替案を提示
- 質問形式で改善を促す
- 良い点も指摘する

#### 作成者

- フィードバックを前向きに受け止める
- 質問には丁寧に回答
- 必要に応じて変更を加える
- 理由がある場合は説明

---

## ✅ テスト要件

### カバレッジ目標

新しいコードには以下のカバレッジを維持してください：

- **Functions**: 100%
- **Lines**: 99%以上
- **Statements**: 97%以上
- **Branches**: 80%以上

### テストの種類

#### 1. ユニットテスト

コントローラー、ユーティリティ関数のテスト：

```typescript
describe('createPlot', () => {
  it('should create a new plot successfully', async () => {
    // テストコード
  });

  it('should throw ValidationError for invalid input', async () => {
    // テストコード
  });
});
```

#### 2. 統合テスト

ルートのエンドツーエンドテスト：

```typescript
describe('POST /api/v1/plots', () => {
  it('should return 201 and create plot', async () => {
    const response = await request(app)
      .post('/api/v1/plots')
      .send(plotData);

    expect(response.status).toBe(201);
  });
});
```

#### 3. E2Eテスト（Playwright）

実際のブラウザを使用したテスト：

```typescript
test('plot creation flow', async ({ page }) => {
  await page.goto('http://localhost:4000');
  // テストコード
});
```

### テスト実行

```bash
# 全テスト実行
npm test

# ウォッチモード
npm run test:watch

# カバレッジレポート
npm run test:coverage

# E2Eテスト
npm run test:e2e
```

### モックの使用

Prismaクライアントは`__mocks__/@prisma/client.ts`でモック化されています：

```typescript
import { prismaMock } from '../__mocks__/@prisma/client';

prismaMock.plot.create.mockResolvedValue(mockPlot);
```

---

## 📚 ドキュメント更新

### ドキュメントの種類

コード変更に伴い、以下のドキュメントを更新してください：

1. **README.md** - プロジェクト概要、セットアップ手順
2. **CLAUDE.md** - 開発ガイドライン、アーキテクチャ
3. **swagger.yaml** - API仕様書
4. **CHANGELOG.md** - 変更履歴
5. **関連ドキュメント** - DOCKER_SETUP.md, PRODUCTION_SETUP.md等

### API仕様書の更新

新しいエンドポイントを追加する場合：

1. `swagger.yaml`にエンドポイント定義を追加
2. リクエスト/レスポンススキーマを定義
3. 検証を実行: `npm run swagger:validate`
4. JSON生成: `npm run swagger:build`

### ドキュメント作成のベストプラクティス

- **明確性**: 技術的でも分かりやすく説明
- **具体例**: コード例を豊富に含める
- **最新性**: コード変更時は必ず同期
- **構造化**: 目次、セクション分けで読みやすく

---

## 🆘 質問・サポート

### 質問方法

1. **既存のIssue/PRを検索**: 同じ質問がないか確認
2. **ドキュメントを確認**: README.md, CLAUDE.md等
3. **新しいIssueを作成**: 上記で解決しない場合

### Issue作成時のテンプレート

#### バグ報告

```markdown
## バグの説明
バグの内容を簡潔に説明

## 再現手順
1. ステップ1
2. ステップ2
3. エラー発生

## 期待される動作
正常時の動作

## 実際の動作
実際に起きた動作

## 環境
- OS: [例: Windows 11]
- Node.js: [例: v20.11.0]
- ブラウザ: [例: Chrome 120]

## 追加情報
スクリーンショット、ログ等
```

#### 機能提案

```markdown
## 機能の説明
提案する機能の概要

## 動機・背景
なぜこの機能が必要か

## 提案内容
具体的な実装イメージ

## 代替案
他に検討した方法

## 追加情報
参考資料、類似機能の例等
```

---

## 🎉 貢献者へのお礼

Cemetery CRM Backendへの貢献、誠にありがとうございます！

皆様の貢献がこのプロジェクトをより良いものにしています。

---

## 📄 ライセンス

貢献したコードは、プロジェクトのライセンス（LICENSEファイル参照）の下で公開されることに同意したものとみなされます。

---

**最終更新**: 2025-11-19
