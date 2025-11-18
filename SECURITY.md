# Security Policy

Cemetery CRM Backendのセキュリティポリシー

## 📋 目次

- [サポートされるバージョン](#サポートされるバージョン)
- [脆弱性の報告](#脆弱性の報告)
- [セキュリティアップデート](#セキュリティアップデート)
- [セキュリティ対策](#セキュリティ対策)
- [既知の脆弱性](#既知の脆弱性)
- [セキュリティベストプラクティス](#セキュリティベストプラクティス)

---

## 🔰 サポートされるバージョン

現在セキュリティアップデートを提供しているバージョン：

| バージョン | サポート状況 |
| ------- | ------------ |
| 1.0.x   | ✅ サポート中 |
| < 1.0   | ❌ 未サポート |

---

## 🐛 脆弱性の報告

### 報告方法

セキュリティ上の脆弱性を発見した場合は、**公開のIssueではなく**、以下の方法で報告してください：

1. **GitHub Security Advisories**（推奨）
   - リポジトリの「Security」タブから「Report a vulnerability」をクリック
   - プライベートに脆弱性を報告できます

2. **メール**
   - セキュリティチームへメールで報告: `security@your-organization.com`
   - メール件名: `[SECURITY] Cemetery CRM Backend - 脆弱性報告`

### 報告に含めるべき情報

脆弱性報告には以下の情報を含めてください：

- **脆弱性の種類**: XSS, SQL Injection, CSRF, etc.
- **影響範囲**: どのバージョン、どの機能が影響を受けるか
- **再現手順**: 詳細なステップ（可能であればPoCコード）
- **影響**: 攻撃者が何を達成できるか
- **推奨される修正方法**（任意）
- **連絡先情報**: 追加情報を求める際の連絡先

### 報告後の流れ

1. **受領確認**: 48時間以内に受領確認メールを送信
2. **初期評価**: 7日以内に脆弱性の深刻度を評価
3. **修正開発**: 深刻度に応じて修正を開発
   - Critical: 24時間以内
   - High: 1週間以内
   - Medium: 2週間以内
   - Low: 次回リリースに含める
4. **パッチリリース**: 修正版をリリース
5. **公開**: 修正版リリース後、脆弱性情報を公開

### 報告者へのクレジット

脆弱性を責任を持って報告していただいた方には、以下を提供します：

- セキュリティアドバイザリーでの謝辞
- CHANGELOG.mdへの記載（希望者のみ）
- GitHubのセキュリティクレジット

---

## 🔄 セキュリティアップデート

### 自動セキュリティスキャン

以下のツールで自動的にセキュリティスキャンを実施しています：

1. **Dependabot**
   - npm依存関係の脆弱性を自動検出
   - 週次で自動PR作成
   - セキュリティアップデートは即座に適用

2. **npm audit**
   - CI/CDパイプラインで自動実行
   - `moderate`以上の脆弱性を検出

3. **Trivy**
   - Dockerイメージの脆弱性スキャン
   - CRITICAL/HIGHの脆弱性を検出
   - GitHub Security タブで結果確認可能

### 手動セキュリティチェック

開発者は以下のコマンドで手動チェックを実行できます：

```bash
# npm依存関係の脆弱性チェック
npm audit

# 本番環境依存関係のみチェック
npm audit --production

# 高レベル以上の脆弱性のみ表示
npm audit --audit-level=high

# Dockerイメージの脆弱性スキャン
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image cemetery-crm-backend:latest
```

### セキュリティアップデートの適用

セキュリティアップデートは以下の優先度で適用されます：

| 深刻度 | 対応時間 | 適用方法 |
| --- | --- | --- |
| **Critical** | 24時間以内 | 緊急パッチリリース |
| **High** | 1週間以内 | パッチリリース |
| **Medium** | 2週間以内 | 次回マイナーリリース |
| **Low** | 次回リリース | 通常のリリースサイクル |

---

## 🛡️ セキュリティ対策

このプロジェクトで実装されているセキュリティ対策：

### アプリケーションレベル

- ✅ **JWT認証** - Supabaseベースのトークン認証
- ✅ **ロールベースアクセス制御** - viewer, operator, manager, admin
- ✅ **入力検証** - すべてのユーザー入力を検証
- ✅ **XSS対策** - 入力サニタイゼーション実装
- ✅ **CSRF対策** - トークンベース認証
- ✅ **SQL注入対策** - Prisma ORMを使用（パラメータ化クエリ）
- ✅ **Rate Limiting** - DDoS攻撃対策（100 req/15min）
- ✅ **HPP対策** - HTTP Parameter Pollution防止
- ✅ **CORS設定** - オリジンホワイトリスト

### インフラレベル

- ✅ **Helmet** - セキュリティヘッダー設定
  - Content-Security-Policy
  - X-Frame-Options
  - X-Content-Type-Options
  - Strict-Transport-Security
- ✅ **HTTPS強制** - 本番環境ではHTTPS必須
- ✅ **環境変数管理** - 機密情報を環境変数で管理
- ✅ **Dockerセキュリティ** - 非rootユーザーで実行

### コードレベル

- ✅ **TypeScript strict mode** - 型安全性の向上
- ✅ **ESLint** - コード品質とセキュリティルール
- ✅ **Pre-commit hooks** - コミット前の自動チェック
- ✅ **依存関係の定期更新** - Dependabotによる自動PR

---

## ⚠️ 既知の脆弱性

現在、報告されている脆弱性はありません。

過去の脆弱性については、[GitHub Security Advisories](https://github.com/your-org/cemetery-crm-backend/security/advisories)を参照してください。

---

## 📚 セキュリティベストプラクティス

### 開発者向け

#### 1. 環境変数の管理

```bash
# ❌ 悪い例 - 機密情報をコードに直接記述
const apiKey = "sk-1234567890abcdef";

# ✅ 良い例 - 環境変数を使用
const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
```

#### 2. 入力検証

```typescript
// ❌ 悪い例 - 検証なし
app.post('/api/v1/plots', (req, res) => {
  const data = req.body;
  await prisma.plot.create({ data });
});

// ✅ 良い例 - 入力検証
app.post('/api/v1/plots', async (req, res) => {
  if (!req.body.plot_number) {
    throw new ValidationError('plot_number is required');
  }
  // さらなる検証...
});
```

#### 3. エラーハンドリング

```typescript
// ❌ 悪い例 - 詳細なエラーを露出
catch (error) {
  res.status(500).json({ error: error.stack });
}

// ✅ 良い例 - 一般的なエラーメッセージ
catch (error) {
  logger.error(error); // サーバー側でログ
  res.status(500).json({ error: 'Internal server error' });
}
```

#### 4. 認証・認可

```typescript
// ❌ 悪い例 - 権限チェックなし
app.delete('/api/v1/plots/:id', async (req, res) => {
  await prisma.plot.delete({ where: { id: req.params.id } });
});

// ✅ 良い例 - 権限チェック
app.delete('/api/v1/plots/:id',
  authenticate,
  requirePermission('manager'),
  async (req, res) => {
    await prisma.plot.delete({ where: { id: req.params.id } });
  }
);
```

### デプロイ時のチェックリスト

- [ ] 環境変数が正しく設定されている
- [ ] HTTPS が有効になっている
- [ ] `ALLOWED_ORIGINS` が本番ドメインに設定されている
- [ ] データベース接続が暗号化されている
- [ ] ログに機密情報が含まれていない
- [ ] Rate Limitingが有効になっている
- [ ] セキュリティヘッダーが設定されている
- [ ] 最新のセキュリティパッチが適用されている
- [ ] バックアップが設定されている
- [ ] モニタリング・アラートが設定されている

### 定期的なセキュリティレビュー

以下を定期的に実施してください：

- **月次**: 依存関係の脆弱性スキャン (`npm audit`)
- **月次**: Docker イメージのスキャン (Trivy)
- **四半期**: コードセキュリティレビュー
- **四半期**: 権限設定の見直し
- **半年**: ペネトレーションテスト（任意）
- **年次**: セキュリティポリシーの見直し

---

## 🔗 参考資料

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [npm Security Best Practices](https://docs.npmjs.com/packages-and-modules/securing-your-code)
- [Docker Security Best Practices](https://docs.docker.com/engine/security/)
- [Prisma Security](https://www.prisma.io/docs/concepts/components/prisma-client/deployment#security)

---

## 📧 連絡先

セキュリティに関する質問や懸念事項がある場合：

- **Email**: security@your-organization.com
- **GitHub**: [Security Advisories](https://github.com/your-org/cemetery-crm-backend/security/advisories)

---

**最終更新**: 2025-11-19
