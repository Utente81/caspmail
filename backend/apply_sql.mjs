import pg from 'pg';
import fs from 'fs';
const { Client } = pg;
const client = new Client({
  connectionString: 'postgresql://app:secure_password_123@127.0.0.1:5432/caspermail'
});
async function run() {
  await client.connect();
  const sql = fs.readFileSync('/home/ubuntu/caspmail-enterprise/backend/migrations/018_key_escrow.sql', 'utf8');
  await client.query(sql);
  console.log('Success');
  await client.end();
}
run();
