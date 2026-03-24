import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

const databaseUrl = process.env['DATABASE_URL'] ?? 'postgresql://';
const directUrl = process.env['DIRECT_URL'];

// Debug: マイグレーション時の接続先を確認
console.log(`[Prisma Config] DATABASE_URL host: ${databaseUrl.replace(/\/\/.*@/, '//***@')}`);
console.log(
  `[Prisma Config] DIRECT_URL: ${directUrl ? directUrl.replace(/\/\/.*@/, '//***@') : 'NOT SET'}`
);

export default defineConfig({
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),
  datasource: {
    url: databaseUrl,
    directUrl: directUrl,
  },
});
