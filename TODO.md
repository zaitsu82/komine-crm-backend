# TODO - Cemetery CRM Backend

最終更新: 2025-11-24

## 📊 現在の状況

- **バージョン**: v1.3.0
- **テスト**: 445テスト、全て成功
- **カバレッジ**: Functions 100%, Lines 99.16%, Statements 97.87%, Branches 81.72%
- **TypeScript**: 厳格モード有効、コンパイルエラー0件
- **コード品質**: ESLint + Prettier + Husky設定完了
- **API仕様**: OpenAPI 3.0 (swagger.yaml, swagger.json) + Swagger UI (/api-docs)
- **エラー監視**: Sentry統合（リアルタイムエラートラッキング）
- **インフラ**: Docker完全対応、CI/CD構築済み

---

## 🔴 優先度: 高

現在、優先度が高い未完了タスクはありません。

---

## 🟡 優先度: 中

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
ユーザー管理機能（必要に応じて実装）
- `GET /api/v1/staff` - スタッフ一覧
- `POST /api/v1/staff` - スタッフ登録
- `PUT /api/v1/staff/:id` - スタッフ更新

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
