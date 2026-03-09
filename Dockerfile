# ============================================
# Stage 0: Build @komine/types
# ============================================
FROM node:20-alpine AS types

RUN apk add --no-cache git

WORKDIR /packages/types

RUN git clone --depth 1 https://github.com/zaitsu82/komine-types.git . && \
    npm ci && \
    npm run build

# ============================================
# Stage 1: Dependencies
# ============================================
FROM node:20-alpine AS deps

# git: GitHub URL依存パッケージのインストールに必要
RUN apk add --no-cache git

# 作業ディレクトリの設定
WORKDIR /app

# @komine/types パッケージを配置（file:../packages/types の解決用）
COPY --from=types /packages/types /packages/types

# 依存関係のインストールに必要なファイルをコピー
COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

# 本番用依存関係のみインストール
# Prisma v7: クライアントエンジンはJSベース（ネイティブバイナリ不要）
# --ignore-scriptsでprepareスクリプト(husky)をスキップ（本番環境では不要）
# --no-save prisma: preDeployCommand (prisma migrate deploy) 実行用にCLIを含める
RUN npm ci --omit=dev --ignore-scripts && \
    npm install --no-save prisma && \
    npx prisma generate && \
    npm cache clean --force

# ============================================
# Stage 2: Build
# ============================================
FROM node:20-alpine AS builder

# git: GitHub URL依存パッケージのインストールに必要
RUN apk add --no-cache git

WORKDIR /app

# @komine/types パッケージを配置（file:../packages/types の解決用）
COPY --from=types /packages/types /packages/types

# 依存関係のインストール（devDependenciesを含む）
COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./
RUN npm ci && \
    npx prisma generate

# ソースコードをコピー
COPY . .

# TypeScriptのビルド
RUN npm run build

# ============================================
# Stage 3: Production
# ============================================
FROM node:20-slim AS production

# Chromium + 日本語フォント（Puppeteer PDF生成に必要）
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-ipafont-gothic \
    fonts-ipafont-mincho \
    && rm -rf /var/lib/apt/lists/*

# Puppeteer: システムChromiumを使用し、バンドル版ダウンロードをスキップ
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# セキュリティ: non-rootユーザーで実行
RUN groupadd -g 1001 nodejs && \
    useradd -m -u 1001 -g nodejs nodejs

WORKDIR /app

# 本番用依存関係とPrismaクライアントをコピー
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=nodejs:nodejs /app/package*.json ./

# ビルド成果物をコピー
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nodejs:nodejs /app/prisma.config.ts ./

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
