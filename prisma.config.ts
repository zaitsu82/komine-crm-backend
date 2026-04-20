import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),
  datasource: {
    url: process.env['DATABASE_URL'] ?? 'postgresql://',
    directUrl: process.env['DIRECT_URL'],
  },
  migrations: {
    seed: 'ts-node --transpile-only prisma/seed.ts',
  },
});
