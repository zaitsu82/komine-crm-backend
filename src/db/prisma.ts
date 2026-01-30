import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const nodeEnv = process.env['NODE_ENV'];

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: nodeEnv === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (nodeEnv !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
