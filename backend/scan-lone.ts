import { PrismaClient } from './src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

async function main() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/fyp',
  });
  const prisma = new PrismaClient({ adapter });

  const deleted = await prisma.repositoryArtifact.deleteMany({
    where: { githubNodeId: { startsWith: 'lone-test-' } },
  });
  console.log('deleted test artifacts:', deleted.count);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});