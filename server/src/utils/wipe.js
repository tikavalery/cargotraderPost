import '../config/env.js';
import { connectDB, disconnectDB, prisma } from '../config/db.js';
import { assertDestructiveOpsAllowed } from './productionChecks.js';

async function wipe() {
  assertDestructiveOpsAllowed('Database wipe');
  await connectDB();
  console.log('Truncating all PostgreSQL tables…');
  const tables = await prisma.$queryRaw`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `;
  for (const row of tables) {
    const name = row.tablename;
    if (name === '_prisma_migrations') continue;
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${name}" CASCADE`);
  }
  console.log('All tables truncated. Database is empty.');
  await disconnectDB();
  process.exit(0);
}

wipe().catch((err) => {
  console.error('Wipe failed:', err.message);
  process.exit(1);
});
