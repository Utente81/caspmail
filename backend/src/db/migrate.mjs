import fs from 'node:fs/promises';
import path from 'node:path';
import pool from './pool.mjs';

const MIGRATIONS_DIR = process.env.MIGRATIONS_DIR || path.resolve('migrations');

/**
 * Ensure the migrations tracking table exists.
 */
async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS migrations_applied (
      id          SERIAL PRIMARY KEY,
      filename    TEXT NOT NULL UNIQUE,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

/**
 * Return the set of already-applied migration filenames.
 */
async function getApplied(client) {
  const { rows } = await client.query(
    'SELECT filename FROM migrations_applied ORDER BY id'
  );
  return new Set(rows.map((r) => r.filename));
}

/**
 * Run all pending *.sql files in MIGRATIONS_DIR, in lexicographic order.
 * Each migration runs inside its own transaction; applied filenames are recorded.
 */
export async function runMigrations() {
  let files;
  try {
    files = await fs.readdir(MIGRATIONS_DIR);
  } catch (err) {
    throw new Error(
      `Cannot read migrations directory "${MIGRATIONS_DIR}": ${err.message}`
    );
  }

  const sqlFiles = files
    .filter((f) => f.endsWith('.sql'))
    .sort(); // lexicographic — filenames like 001_initial.sql guarantee order

  if (sqlFiles.length === 0) {
    console.log('[migrate] No migration files found.');
    return;
  }

  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = await getApplied(client);

    for (const filename of sqlFiles) {
      if (applied.has(filename)) {
        console.log(`[migrate] Already applied: ${filename}`);
        continue;
      }

      console.log(`[migrate] Applying: ${filename}`);
      const filepath = path.join(MIGRATIONS_DIR, filename);
      const sql = await fs.readFile(filepath, 'utf8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO migrations_applied (filename) VALUES ($1)',
          [filename]
        );
        await client.query('COMMIT');
        console.log(`[migrate] Applied: ${filename}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration "${filename}" failed: ${err.message}`);
      }
    }

    console.log('[migrate] All migrations up to date.');
  } finally {
    client.release();
  }
}
