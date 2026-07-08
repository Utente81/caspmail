import pg from 'pg';
import fs from 'fs';
import yaml from 'yaml';

const k8sSecret = yaml.parse(fs.readFileSync('/home/ubuntu/caspmail/new/k8s/casper-secrets.yaml', 'utf8'));
const dbUrl = Buffer.from(k8sSecret.data.DATABASE_URL, 'base64').toString('utf8');

const pool = new pg.Pool({ connectionString: dbUrl });

async function run() {
  const query = `
    INSERT INTO soc_compliance (tenant_id, framework, control_id, status, updated_by) VALUES
    ('acme-corp', 'nis2', 'nis2-1', 'compliant', 'system'),
    ('acme-corp', 'nis2', 'nis2-2', 'compliant', 'system'),
    ('acme-corp', 'nis2', 'nis2-3', 'compliant', 'system'),
    ('acme-corp', 'nis2', 'nis2-4', 'compliant', 'system'),
    ('acme-corp', 'nis2', 'nis2-5', 'compliant', 'system'),
    ('acme-corp', 'nis2', 'nis2-6', 'compliant', 'system'),
    ('acme-corp', 'nis2', 'nis2-7', 'compliant', 'system'),
    ('acme-corp', 'nis2', 'nis2-8', 'compliant', 'system'),
    ('acme-corp', 'nis2', 'nis2-9', 'compliant', 'system'),
    ('acme-corp', 'nis2', 'nis2-10', 'compliant', 'system')
    ON CONFLICT (tenant_id, framework, control_id) DO UPDATE SET status = EXCLUDED.status, updated_at = NOW();
  `;
  await pool.query(query);
  console.log('NIS2 compliance updated successfully');
  process.exit(0);
}
run();
