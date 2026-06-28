import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  user: 'caspermail',
  host: 'localhost',
  database: 'caspermail',
  password: 'password',
  port: 5432,
});

async function main() {
  const tenantId = 'caspmail';
  const { rows: topIps } = await pool.query(`
    SELECT
      source_ip::text AS ip,
      COUNT(*)                                       AS total,
      COUNT(*) FILTER (WHERE severity='critical')   AS critical,
      COUNT(*) FILTER (WHERE severity='high')       AS high,
      MAX(severity)                                  AS max_severity,
      MAX(created_at)                                AS last_seen,
      array_agg(DISTINCT type)                      AS event_types
    FROM soc_events
    WHERE tenant_id=$1 AND source_ip IS NOT NULL
      AND created_at > NOW() - INTERVAL '24 hours'
    GROUP BY source_ip
    ORDER BY (
      SUM(CASE WHEN severity='critical' THEN 1 ELSE 0 END)*10 + 
      SUM(CASE WHEN severity='high' THEN 1 ELSE 0 END)*5 + 
      COUNT(*)
    ) DESC
    LIMIT 15
  `, [tenantId]);

  console.log('topIps:', topIps.length);
  if (topIps.length > 0) {
    console.log(topIps[0]);
  }
  process.exit(0);
}

main();
