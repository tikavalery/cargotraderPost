/**
 * Ensure schema exists on Railway, then start the API.
 * Tries migrate deploy first; falls back to db push if needed.
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function run(cmd, args) {
  console.log(`[railway] $ ${cmd} ${args.join(' ')}`);
  return spawnSync(cmd, args, {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
    shell: true
  });
}

if (!process.env.DATABASE_URL?.trim()) {
  console.error('[railway] DATABASE_URL is missing');
  process.exit(1);
}

let result = run('npx', ['prisma', 'migrate', 'deploy']);
if (result.status !== 0) {
  console.warn('[railway] migrate deploy failed — trying prisma db push…');
  result = run('npx', ['prisma', 'db', 'push', '--skip-generate', '--accept-data-loss']);
  if (result.status !== 0) {
    console.error('[railway] Could not apply database schema');
    process.exit(result.status || 1);
  }
}

console.log('[railway] Starting API…');
result = run('node', ['src/index.js']);
process.exit(result.status ?? 1);
