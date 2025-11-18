# GitHub Actions ワークフロー

このディレクトリには、CI/CDパイプラインの設定ファイルが含まれています。

## ワークフロー一覧

### `ci.yml` - 継続的インテグレーション

**トリガー**:
- `main` または `develop` ブランチへのpush
- `main` または `develop` ブランチへのPull Request

**実行内容**:

#### 1. Build（ビルド）
- TypeScriptのコンパイルチェック
- ビルド成果物（`dist/`）をアーティファクトとして保存（7日間保持）

#### 2. Lint & Format Check（コード品質チェック）
- ESLintによる静的解析
- Prettierによるフォーマットチェック

#### 3. Swagger Validation（API仕様書検証）
- OpenAPI仕様書の構文チェック
- Swagger JSON形式への変換

#### 4. Test（テスト実行）
- 複数のNode.jsバージョンでテスト実行（18.x, 20.x, 22.x）
- 424個のテストケースを実行
- Node.js 20.xでカバレッジレポート生成
- Codecovへカバレッジデータをアップロード
- カバレッジレポートをアーティファクトとして保存（30日間保持）

#### 5. All Checks Passed（総合判定）
- すべてのジョブが成功したことを確認
- 1つでも失敗した場合はエラー

## 必要な設定

### GitHub Secrets

以下のシークレットをGitHub Repository Settings > Secrets and variables > Actionsに設定してください:

#### Codecov連携（オプション）
```
CODECOV_TOKEN=<Codecovから取得したトークン>
```

**取得方法**:
1. https://codecov.io/ にGitHubアカウントでログイン
2. リポジトリを追加
3. トークンをコピー
4. GitHubのSecretsに追加

### ブランチ保護ルール（推奨）

`main`ブランチを保護するために、以下の設定を推奨します:

**Settings > Branches > Add rule**:
```
Branch name pattern: main

☑ Require status checks to pass before merging
  必須チェック:
  - Build
  - Lint & Format Check
  - Swagger Validation
  - Test (Node 18.x)
  - Test (Node 20.x)
  - Test (Node 22.x)
  - All Checks Passed

☑ Require pull request reviews before merging
  Required approvals: 1

☑ Require conversation resolution before merging
```

## ワークフロー実行結果の確認

### GitHub上での確認
1. リポジトリページの「Actions」タブをクリック
2. 実行されたワークフローの一覧が表示されます
3. 各ワークフローをクリックすると詳細が確認できます

### バッジの追加（README.md）

以下のバッジをREADME.mdに追加できます:

```markdown
![CI](https://github.com/{owner}/{repo}/workflows/CI/badge.svg)
[![codecov](https://codecov.io/gh/{owner}/{repo}/branch/main/graph/badge.svg)](https://codecov.io/gh/{owner}/{repo})
```

`{owner}`と`{repo}`は実際のリポジトリ情報に置き換えてください。

## カバレッジレポートの確認

### Codecov（オンライン）
https://codecov.io/gh/{owner}/{repo}

### GitHub Artifacts（ダウンロード）
1. Actions > 該当のワークフロー実行
2. 下部の「Artifacts」セクション
3. `coverage-report`をダウンロード
4. `coverage/lcov-report/index.html`をブラウザで開く

## トラブルシューティング

### テストが失敗する場合
1. ローカルで`npm test`を実行して確認
2. すべてのテストがパスすることを確認してからpush

### ビルドが失敗する場合
1. ローカルで`npm run build`を実行して確認
2. TypeScriptのコンパイルエラーを修正

### Lintエラーが発生する場合
1. ローカルで`npm run lint`を実行
2. `npm run lint:fix`で自動修正可能なエラーを修正
3. 残ったエラーを手動で修正

### Codecovへのアップロードが失敗する場合
- `CODECOV_TOKEN`が正しく設定されているか確認
- Codecovのトークンは必須ではありません（`fail_ci_if_error: false`のため）
- トークンがなくてもCIは成功します

## 参考リンク

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Codecov Documentation](https://docs.codecov.com/)
- [Node.js GitHub Actions Guide](https://docs.github.com/en/actions/automating-builds-and-tests/building-and-testing-nodejs)
