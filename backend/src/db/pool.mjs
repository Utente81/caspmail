import pg from 'pg';
import { readFileSync } from 'node:fs';

const { Pool } = pg;

function buildConnectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  // Running inside Docker with secrets mounted at /run/secrets/
  let password;
  try {
    password = readFileSync('/run/secrets/postgres_password', 'utf8').trim();
  } catch {
    throw new Error('DATABASE_URL env var or /run/secrets/postgres_password secret is required');
  }

  const host = process.env.DB_HOST || 'postgres';
  const port = process.env.DB_PORT || '5432';
  const user = process.env.DB_USER || 'caspermail';
  const db   = process.env.DB_NAME || 'caspermail';
  return `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/${db}`;
}

const pool = new Pool({
  connectionString: buildConnectionString(),
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : false,
});

pool.on('error', (err) => {
  console.error('[pg pool] Unexpected client error', err);
});

export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export default pool;
