const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testPrisma() {
  try {
    console.log('Available models:', Object.keys(prisma));
    console.log('Testing connection...');
    
    // 簡単なカウントクエリ
    const count = await prisma.gravestone.count();
    console.log('Gravestone count:', count);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPrisma();