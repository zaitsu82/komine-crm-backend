# ============================================
# Stage 1: Dependencies
# ============================================
FROM node:25-alpine AS deps

# git: GitHub URL依存パッケージのインストールに必要
RUN apk add --no-cache git

# 作業ディレクトリの設定
WORKDIR /app

# 依存関係のインストールに必要なファイルをコピー
COPY package*.json ./
COPY prisma ./prisma/

# 本番用依存関係のみインストール
# OpenSSL 3.0対応のため、Prisma binaryTargets に "linux-musl-openssl-3.0.x" が必要
# --ignore-scriptsでprepareスクリプト(husky)をスキップ（本番環境では不要）
RUN npm ci --omit=dev --ignore-scripts && \
    npx prisma generate && \
    npm cache clean --force

# ============================================
# Stage 2: Build
# ============================================
FROM node:25-alpine AS builder

# git: GitHub URL依存パッケージのインストールに必要
RUN apk add --no-cache git

WORKDIR /app

# 依存関係のインストール（devDependenciesを含む）
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci && \
    npx prisma generate

# ソースコードをコピー
COPY . .

# TypeScriptのビルド
RUN npm run build

# ============================================
# Stage 3: Production
# ============================================
FROM node:25-alpine AS production

# セキュリティ: non-rootユーザーで実行
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# 本番用依存関係とPrismaクライアントをコピー
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=nodejs:nodejs /app/package*.json ./

# ビルド成果物をコピー
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma

# 環境変数の設定
ENV NODE_ENV=production
ENV PORT=4000

# non-rootユーザーに切り替え
USER nodejs

# ポートを公開
EXPOSE 4000

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:4000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# アプリケーション起動
CMD ["node", "dist/index.js"]
