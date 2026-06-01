import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { resolveDatabaseUrl } from './databaseUrl';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const nodeEnv = process.env['NODE_ENV'];

function createPrismaClient(): PrismaClient {
  // ECS では DB 認証情報が DB_* として個別注入されるため、DATABASE_URL が無ければ
  // それらから接続文字列を組み立てる（詳細は resolveDatabaseUrl 参照）。
  const adapter = new PrismaPg({
    connectionString: resolveDatabaseUrl(),
  });
  return new PrismaClient({
    adapter,
    log: nodeEnv === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (nodeEnv !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
