/**
 * Railway start: run Prisma migrations, then boot the API.
 * Failures print a clear reason so deploy logs are actionable.
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, '..');

if (!process.env.DATABASE_URL?.trim()) {
  console.error(
    '[railway] DATABASE_URL is missing. In Railway: add a PostgreSQL service, open this API service → Variables → add a reference to Postgres DATABASE_URL.'
  );
  process.exit(1);
}

console.log('[railway] Running prisma migrate deploy…');
const migrate = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
  cwd: serverRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: process.env
});

if (migrate.status !== 0) {
  console.error('[railway] prisma migrate deploy failed — check DATABASE_URL and migration files.');
  process.exit(migrate.status || 1);
}

console.log('[railway] Starting API…');
const start = spawnSync('node', ['src/index.js'], {
  cwd: serverRoot,
  stdio: 'inherit',
  env: process.env
});

process.exit(start.status ?? 1);
