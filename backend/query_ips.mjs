import { default as pool } from './src/db/pool.mjs';

async function main() {
  const res = await pool.query('SELECT source_ip as ip FROM soc_events LIMIT 10;');
  console.log(res.rows);
  process.exit(0);
}

main();
