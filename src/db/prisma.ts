import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const nodeEnv = process.env['NODE_ENV'];

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: process.env['DATABASE_URL'],
  });
  return new PrismaClient({
    adapter,
    log: nodeEnv === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (nodeEnv !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
