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

if (!process.env.DATABASE_URL) {
  console.warn(
    `Warning: DATABASE_URL not found. Expected it from the host environment or .env at: ${candidates.join(' or ')}`
  );
}
