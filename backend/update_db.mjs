import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  host: process.env.DB_HOST || 'casper-cnpg-rw.caspermail.svc.cluster.local',
  user: process.env.DB_USER || 'caspermail',
  database: process.env.DB_NAME || 'caspermail',
  password: process.env.DB_PASSWORD || 'O+y0/V9eZJ35p6N/O5hZfA==',
  port: 5432
});

async function run() {
  try {
    await pool.query('ALTER TABLE e2ee_messages ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT \'[]\'::jsonb;');
    await pool.query('ALTER TABLE e2ee_messages ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;');
    console.log('Migration successful');
  } catch(e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}
run();
