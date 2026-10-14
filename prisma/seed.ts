import { PrismaClient } from '@prisma/client';

import {
  assertSeedAllowed,
  redactSecrets,
} from '../src/shared/test-data/init-guard';
import { formatTestDataReport, loadTestData } from './load-test-data';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  assertSeedAllowed(process.env);
  const report = await loadTestData(prisma, process.env);
  console.log(formatTestDataReport(report));
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(redactSecrets(message, process.env.DATABASE_URL));
    await prisma.$disconnect();
    process.exit(1);
  });
