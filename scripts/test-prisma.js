const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
require('dotenv').config();

// Prisma v7 では driver adapter が必須（#235、src/db/prisma.ts と同構成）
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function testPrisma() {
  try {
    console.log('Available models:', Object.keys(prisma));
    console.log('Testing connection...');

    // 簡単なカウントクエリ（v2.0 モデル: PhysicalPlot / ContractPlot）
    const physicalPlotCount = await prisma.physicalPlot.count();
    const contractPlotCount = await prisma.contractPlot.count();
    console.log('PhysicalPlot count:', physicalPlotCount);
    console.log('ContractPlot count:', contractPlotCount);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPrisma();