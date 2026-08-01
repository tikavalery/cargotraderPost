import prisma from '../db/prisma.js';

let connectionLabel = 'unknown';
let ready = false;

export function isDbReady() {
  return ready;
}

export function getDbStatus() {
  return {
    ready: isDbReady(),
    state: ready ? 'connected' : 'disconnected',
    host: connectionLabel,
    label: connectionLabel,
    engine: 'postgresql'
  };
}

export function isMongoError(err) {
  // Back-compat alias — treat Prisma / PG connectivity errors the same way
  return isDbError(err);
}

export function isDbError(err) {
  const name = err?.name || '';
  const code = err?.code || '';
  return (
    name.startsWith('Prisma') ||
    name === 'PrismaClientInitializationError' ||
    name === 'PrismaClientKnownRequestError' ||
    ['P1001', 'P1002', 'P1003', 'P1008', 'P1017', 'ECONNREFUSED', 'ETIMEDOUT'].includes(code) ||
    /Can't reach database|Connection refused|timeout|ECONNREFUSED/i.test(err?.message || '')
  );
}

export function mongoErrorMessage(err) {
  return dbErrorMessage(err);
}

export function dbErrorMessage(err) {
  const msg = err?.message || 'Database unavailable';
  if (/ECONNREFUSED|Can't reach database/i.test(msg)) {
    return 'Database unavailable — PostgreSQL is not running. Start the PostgreSQL service, then restart the server.';
  }
  return `Database unavailable — ${msg}`;
}

export async function connectDB() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set. Add it to server/.env (see server/.env.example).');
  }

  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    ready = true;
    try {
      const u = new URL(url);
      connectionLabel = `${u.hostname}:${u.port || 5432}/${u.pathname.replace(/^\//, '')}`;
    } catch {
      connectionLabel = 'postgresql';
    }
    console.log(`PostgreSQL connected: ${connectionLabel}`);
  } catch (err) {
    ready = false;
    throw new Error(
      `${err?.message || err}\n\nFix: ensure PostgreSQL is running and DATABASE_URL in server/.env is correct (e.g. postgresql://user:pass@127.0.0.1:5432/afritrade).`
    );
  }
}

export async function disconnectDB() {
  ready = false;
  await prisma.$disconnect().catch(() => {});
}

export { prisma };
