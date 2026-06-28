import pool from './src/db/pool.mjs';

async function test() {
  const email = 'pietro@example.com';
  const name = 'Pietro';
  const tenant = 'caspmail';
  
  try {
    const res = await pool.query(
      \INSERT INTO users (tenant_id, email, name) VALUES (\, \, \) RETURNING *\,
      [tenant, email, name]
    );
    console.log('Inserted:', res.rows[0]);
  } catch (e) {
    console.error('Insert failed:', e);
  }
  process.exit(0);
}
test();
