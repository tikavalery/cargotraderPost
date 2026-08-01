import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load local env files without overriding vars already set by the host (Railway/Vercel/etc).
const candidates = [
  path.resolve(__dirname, '../../.env'), // monorepo root
  path.resolve(__dirname, '../.env') // server/.env
];

for (const envPath of candidates) {
  dotenv.config({ path: envPath });
}

/** Railway Postgres often needs SSL when using the public proxy URL. */
function normalizeDatabaseUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return raw;
  if (!/railway\.app|rlwy\.net|railway\.internal/i.test(raw)) return raw;
  if (/([?&])sslmode=/i.test(raw)) return raw;
  return `${raw}${raw.includes('?') ? '&' : '?'}sslmode=require`;
}

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = normalizeDatabaseUrl(process.env.DATABASE_URL);
}

if (process.env.NODE_ENV === 'production' && /127\.0\.0\.1|localhost/i.test(process.env.DATABASE_URL || '')) {
  console.error(
    '[production] DATABASE_URL points to localhost. On Railway → web → Variables: delete DATABASE_URL, then Add Variable → Reference → Postgres → DATABASE_URL.'
  );
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.warn(
    `Warning: DATABASE_URL not found. Expected it from the host environment or .env at: ${candidates.join(' or ')}`
  );
}
