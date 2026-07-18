import pkg from 'pg';
const { Client } = pkg;

async function fixCors() {
  const client = new Client({
    host: '10.43.0.1', // We can port forward or just run it inside a pod
    port: 5432,
    user: 'caspermail',
    password: 'casper_db_password',
    database: 'caspermail'
  });

  try {
    await client.connect();
    console.log("Connected to DB");
    
    // Find client ID for casper-frontend in caspermail realm
    const res = await client.query(`
      SELECT id FROM client WHERE client_id='casper-frontend';
    `);
    
    if (res.rows.length === 0) {
      console.log("Client not found!");
      return;
    }
    
    const id = res.rows[0].id;
    console.log("Found client id:", id);
    
    // Insert web origin '+'
    await client.query(`
      INSERT INTO web_origins (client_id, value) VALUES ($1, '+') ON CONFLICT DO NOTHING;
    `, [id]);
    
    console.log("Inserted web origin +");
  } catch(e) {
    console.error("Error:", e);
  } finally {
    await client.end();
  }
}

fixCors();
