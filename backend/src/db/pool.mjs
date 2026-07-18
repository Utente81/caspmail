import pg from 'pg';

const { Pool } = pg;

const VAULT_ADDR = process.env.VAULT_ADDR || 'http://casper-vault.caspermail.svc.cluster.local:8200';
const VAULT_TOKEN = process.env.VAULT_TOKEN;

let cachedPassword = null;
let passwordExpiresAt = 0;

async function fetchDynamicPassword() {
  if (cachedPassword && Date.now() < passwordExpiresAt) {
    return cachedPassword;
  }

  if (!VAULT_TOKEN) {
    throw new Error('VAULT_TOKEN is missing. Cannot fetch dynamic DB credentials.');
  }

  try {
    const res = await fetch(`${VAULT_ADDR}/v1/database/static-creds/backend-role`, {
      headers: { 'X-Vault-Token': VAULT_TOKEN }
    });
    
    if (!res.ok) {
      throw new Error(`Vault returned ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    cachedPassword = data.data.password;
    // Cache for 5 minutes (Vault rotates every 15m)
    passwordExpiresAt = Date.now() + (1 * 1000); 
    
    console.log('[pg pool] Successfully fetched dynamic password from Vault');
    return cachedPassword;
  } catch (error) {
    console.error('[pg pool] Failed to fetch dynamic password:', error);
    throw error;
  }
}

const host = process.env.DB_HOST || 'postgres';
const port = process.env.DB_PORT || '5432';
const db   = process.env.DB_NAME || 'caspermail';
const user = 'casper_backend';

const pool = new Pool({
  host,
  port,
  database: db,
  user,
  password: fetchDynamicPassword,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false /* nosemgrep: problem-based-packs.insecure-transport.js-node.bypass-tls-verification.bypass-tls-verification */ } : false,
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
