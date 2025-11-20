# CI/CD セットアップガイド

このドキュメントは、GitHub ActionsによるCI/CDパイプラインの初期セットアップ手順を説明します。

## 📋 前提条件

- GitHubリポジトリが作成されていること
- ローカルのコードがリポジトリにpushされていること
- GitHub Actionsが有効になっていること（デフォルトで有効）

## 🚀 セットアップ手順

### ステップ1: ワークフローファイルの確認

以下のファイルが作成されていることを確認してください:

```
.github/
└── workflows/
    ├── ci.yml          # CI/CDワークフロー
    └── README.md       # ワークフロー説明書
codecov.yml             # Codecov設定
```

これらのファイルは既にリポジトリに含まれています。

### ステップ2: Codecov連携（オプション・推奨）

カバレッジレポートをオンラインで確認するために、Codecovを設定します。

#### 2-1. Codecovアカウント作成
1. https://codecov.io/ にアクセス
2. 「Sign up with GitHub」をクリック
3. GitHubアカウントでログイン

#### 2-2. リポジトリの追加
1. Codecovダッシュボードで「Add new repository」をクリック
2. 対象のリポジトリを選択
3. 「Setup repo」をクリック

#### 2-3. トークンの取得
1. リポジトリの設定ページで「Settings」タブをクリック
2. 「Repository Upload Token」をコピー

#### 2-4. GitHubシークレットの設定
1. GitHubリポジトリページを開く
2. 「Settings」タブをクリック
3. 左サイドバーの「Secrets and variables」→「Actions」をクリック
4. 「New repository secret」をクリック
5. 以下の情報を入力:
   - Name: `CODECOV_TOKEN`
   - Secret: 先ほどコピーしたトークン
6. 「Add secret」をクリック

**注意**: CodecovトークンがなくてもCIは動作します（`fail_ci_if_error: false`設定のため）。

### ステップ3: GitHub Code Scanning有効化（オプション・推奨）

Trivyのセキュリティスキャン結果をGitHub Security タブで管理するために、Code Scanningを有効化します。

#### Code Scanningの要件

- **パブリックリポジトリ**: Code Scanning無料で利用可能 ✅
- **プライベートリポジトリ**: GitHub Advanced Security（有料）が必要 ❌

#### 有効化手順

1. GitHubリポジトリページで「Settings」タブをクリック
2. 左サイドバーの「Security」→「Code security and analysis」をクリック
3. 「Code scanning」セクションで「Set up」または「Enable」をクリック

**注意**: Code Scanningが有効化されていない場合でも、CI/CDワークフローは正常に動作します。Trivyスキャン結果はワークフローログに表示されます。

### ステップ4: ブランチ保護ルールの設定（推奨）

`main`ブランチを保護して、テストが成功したコードのみマージできるようにします。

1. GitHubリポジトリページで「Settings」タブをクリック
2. 左サイドバーの「Branches」をクリック
3. 「Add branch protection rule」をクリック
4. 以下を設定:

   **Branch name pattern**:
   ```
   main
   ```

   **Protect matching branches**:
   - ☑ **Require status checks to pass before merging**
     - ☑ Require branches to be up to date before merging
     - 必須ステータスチェックを選択:
       - `Build`
       - `Lint & Format Check`
       - `Swagger Validation`
       - `Test (Node 18.x)`
       - `Test (Node 20.x)`
       - `Test (Node 22.x)`
       - `All Checks Passed`

   - ☑ **Require a pull request before merging**
     - Required approvals: `1`

   - ☑ **Require conversation resolution before merging**

5. 「Create」をクリック

### ステップ5: 動作確認

#### 5-1. テストPull Requestの作成

```bash
# 新しいブランチを作成
git checkout -b test/ci-setup

# 軽微な変更を加える（例: README.mdに空行追加）
echo "" >> README.md

# コミット & プッシュ
git add README.md
git commit -m "test: Verify CI/CD pipeline"
git push origin test/ci-setup
```

#### 5-2. Pull Requestの作成
1. GitHubリポジトリページを開く
2. 「Pull requests」タブをクリック
3. 「New pull request」をクリック
4. base: `main` ← compare: `test/ci-setup` を選択
5. 「Create pull request」をクリック

#### 5-3. CI実行の確認
Pull Requestページで以下を確認:

- ✅ Build - TypeScriptコンパイル成功
- ✅ Lint & Format Check - コード品質チェック成功
- ✅ Swagger Validation - API仕様書検証成功
- ✅ Test (Node 18.x) - テスト成功
- ✅ Test (Node 20.x) - テスト成功
- ✅ Test (Node 22.x) - テスト成功
- ✅ All Checks Passed - すべてのチェック成功

すべてのチェックが緑色になれば、CI/CDパイプラインが正常に動作しています。

#### 5-4. カバレッジレポートの確認

**Codecov（オンライン）**:
1. Pull Requestページの下部に「codecov/project」のコメントが表示されます
2. リンクをクリックしてCodecovページでカバレッジを確認

**GitHub Artifacts（ダウンロード）**:
1. Pull Requestページの「Checks」タブをクリック
2. 「Test (Node 20.x)」をクリック
3. 下部の「Artifacts」セクションで「coverage-report」をダウンロード
4. 解凍して`lcov-report/index.html`をブラウザで開く

## 📊 CIバッジの追加

README.mdにCIステータスバッジを追加できます:

```markdown
# Cemetery CRM Backend

![CI](https://github.com/{owner}/{repo}/workflows/CI/badge.svg)
[![codecov](https://codecov.io/gh/{owner}/{repo}/branch/main/graph/badge.svg)](https://codecov.io/gh/{owner}/{repo})
```

`{owner}`と`{repo}`を実際の情報に置き換えてください。

例:
- owner: `komine-crm`
- repo: `cemetery-crm-backend`

## 🔧 CI/CDワークフローの詳細

### ジョブ一覧

#### 1. Build
- TypeScriptコンパイルチェック
- Prisma Clientの生成
- ビルド成果物（`dist/`）の保存

#### 2. Lint & Format Check
- ESLintによる静的解析
- Prettierによるコードフォーマットチェック

#### 3. Swagger Validation
- OpenAPI仕様書の構文検証
- Swagger JSON形式への変換

#### 4. Test
- 複数Node.jsバージョンでの実行（18.x, 20.x, 22.x）
- 424個のテストケースを実行
- カバレッジレポート生成（Node 20.xのみ）
- Codecovへのアップロード
- カバレッジレポートの保存

#### 5. All Checks Passed
- すべてのジョブが成功したことを確認
- 1つでも失敗した場合はエラー

### 実行トリガー

以下のイベントで自動実行されます:

- `main`ブランチへのpush
- `develop`ブランチへのpush
- `main`ブランチへのPull Request作成・更新
- `develop`ブランチへのPull Request作成・更新

## 🐛 トラブルシューティング

### CIが実行されない

**原因**: ワークフローファイルの構文エラー、またはGitHub Actionsが無効

**解決策**:
1. `.github/workflows/ci.yml`の構文を確認
2. リポジトリ設定でActionsが有効か確認（Settings > Actions）

### テストが失敗する

**原因**: ローカルでは成功するがCI環境で失敗する場合、環境差異が原因

**解決策**:
1. ローカルで`npm test`を実行して確認
2. Node.jsバージョンの違いを確認（ローカルとCIで同じバージョンを使用）
3. タイムゾーンや環境変数の違いを確認

### Codecovへのアップロードが失敗する

**原因**: `CODECOV_TOKEN`が設定されていない、またはトークンが無効

**解決策**:
1. GitHubシークレットで`CODECOV_TOKEN`が正しく設定されているか確認
2. Codecovのトークンを再取得して設定
3. トークンなしでもCIは成功します（`fail_ci_if_error: false`のため）

### ビルドが遅い

**原因**: 依存関係のキャッシュが効いていない

**解決策**:
- `actions/setup-node@v4`の`cache: 'npm'`が設定されているか確認
- 初回実行は遅いですが、2回目以降はキャッシュで高速化されます

### Node.js 18.xでのみテストが失敗する

**原因**: Node.jsバージョン固有の問題

**解決策**:
1. ローカルでNode.js 18.xをインストールして確認
2. 必要に応じてNode.js 18.xのサポートを終了（`matrix`から削除）

## 📚 参考資料

### GitHub Actions
- [公式ドキュメント](https://docs.github.com/en/actions)
- [Node.jsビルドガイド](https://docs.github.com/en/actions/automating-builds-and-tests/building-and-testing-nodejs)
- [ワークフロー構文](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)

### Codecov
- [公式ドキュメント](https://docs.codecov.com/)
- [GitHub Actions統合](https://docs.codecov.com/docs/github-actions)

### 関連ファイル
- `.github/workflows/ci.yml` - CIワークフロー
- `.github/workflows/README.md` - ワークフロー説明
- `codecov.yml` - Codecov設定
- `TODO.md` - タスク管理

## 🎯 次のステップ

CI/CDパイプラインが正常に動作したら、以下を検討してください:

1. **自動デプロイ** - AWS等への自動デプロイ設定（フェーズ2）
2. **セキュリティスキャン** - npm audit、Dependabot設定
3. **E2Eテスト** - Playwright E2Eテストの自動実行
4. **パフォーマンステスト** - 負荷テストの自動実行
5. **Docker化** - コンテナ環境でのCI実行

これらは`TODO.md`の「今後の拡張予定」に記載されています。
