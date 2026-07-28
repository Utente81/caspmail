import fs from 'node:fs/promises';
import path from 'node:path';
import pool from '../src/db/pool.mjs';

const TENANT_DOMAIN = 'acmecorp.com'; // We'll try to find or create this tenant
const ADMIN_EMAIL = 'admin@acmecorp.com';

async function seed() {
  console.log('--- SOC Enterprise Seeder ---');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Find or create a tenant
    let { rows: tenants } = await client.query(`SELECT id FROM tenants WHERE domain = $1`, [TENANT_DOMAIN]);
    let tenantId;
    if (tenants.length === 0) {
      console.log(`Creating tenant ${TENANT_DOMAIN}...`);
      const res = await client.query(
        `INSERT INTO tenants (name, domain) VALUES ($1, $2) RETURNING id`,
        ['Acme Corp', TENANT_DOMAIN]
      );
      tenantId = res.rows[0].id;
    } else {
      tenantId = tenants[0].id;
      console.log(`Found tenant ${TENANT_DOMAIN} (id: ${tenantId})`);
    }

    // 2. Clear existing SOC/SOAR data for this tenant to ensure a clean slate
    console.log('Cleaning existing SOC/SOAR data...');
    await client.query('DELETE FROM soar_runs WHERE tenant_id = $1', [tenantId]);
    await client.query('DELETE FROM soar_playbooks WHERE tenant_id = $1', [tenantId]);
    await client.query('DELETE FROM soc_cases WHERE tenant_id = $1', [tenantId]);
    await client.query('DELETE FROM soc_alerts WHERE tenant_id = $1', [tenantId]);
    await client.query('DELETE FROM soc_events WHERE tenant_id = $1', [tenantId]);
    await client.query('DELETE FROM audit_log WHERE tenant_id = $1 AND action IN (''update_policy'', ''disable_user'', ''export_data'', ''login'', ''delete_user'')', [tenantId]);

    // 3. Seed SOAR Playbooks
    console.log('Seeding SOAR Playbooks...');
    const playbooks = [
      {
        name: 'Auto-block critical alerts (IP block)',
        trigger_type: 'alert_critical',
        action_type: 'block_ip',
        config: { note: 'Blocks source IP instantly' },
        status: 'active'
      },
      {
        name: 'Isolate host on malware beaconing',
        trigger_type: 'alert_critical',
        action_type: 'webhook',
        config: { url: 'https://api.edr.local/isolate', headers: { 'Authorization': 'Bearer xxx' } },
        status: 'active'
      },
      {
        name: 'Require MFA on anomalous login (UEBA)',
        trigger_type: 'ueba_risk_75',
        action_type: 'disable_user',
        config: { reason: 'Anomalous behavior detected' },
        status: 'active'
      },
      {
        name: 'Slack Notify on High Alerts',
        trigger_type: 'alert_high',
        action_type: 'slack_notify',
        config: { webhook_url: 'https://hooks.slack.com/services/T000/B000/XXX' },
        status: 'inactive'
      }
    ];

    const playbookIds = [];
    for (const pb of playbooks) {
      const { rows } = await client.query(
        `INSERT INTO soar_playbooks (tenant_id, name, trigger_type, action_type, config, status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [tenantId, pb.name, pb.trigger_type, pb.action_type, JSON.stringify(pb.config), pb.status, 'system']
      );
      playbookIds.push(rows[0].id);
    }

    // Insert some mock playbook runs
    console.log('Seeding SOAR Runs...');
    for (let i = 0; i < 15; i++) {
      const pbId = playbookIds[i % playbookIds.length];
      const isSuccess = Math.random() > 0.1;
      await client.query(
        `INSERT INTO soar_runs (playbook_id, tenant_id, trigger_type, status, result, created_at, completed_at)
         VALUES ($1, $2, 'alert_critical', $3, $4, NOW() - (random() * interval '7 days'), NOW() - (random() * interval '7 days'))`,
        [pbId, tenantId, isSuccess ? 'success' : 'failure', JSON.stringify({ executed: true, log: 'Action completed successfully.' })]
      );
    }

    // 4. Seed Audit Log
    console.log('Seeding Audit Log...');
    const auditActions = [
      { action: 'login', resource: 'user', details: 'Successful login via SAML' },
      { action: 'update_policy', resource: 'tenant', details: 'Updated password expiration policy to 90 days' },
      { action: 'delete_user', resource: 'user', details: 'Removed inactive user j.doe' },
      { action: 'export_data', resource: 'compliance', details: 'Exported GDPR compliance report' },
      { action: 'disable_user', resource: 'user', details: 'User account disabled manually by SOC analyst' }
    ];
    
    for (let i = 0; i < 50; i++) {
      const a = auditActions[Math.floor(Math.random() * auditActions.length)];
      await client.query(
        `INSERT INTO audit_log (tenant_id, actor, action, resource, details, ip, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW() - (random() * interval '14 days'))`,
        [tenantId, ADMIN_EMAIL, a.action, a.resource, JSON.stringify({ msg: a.details }), '192.168.1.' + Math.floor(Math.random() * 255)]
      );
    }

    // 5. Seed SOC Events & Alerts & UEBA
    console.log('Seeding SOC Events, Alerts, and UEBA data...');
    const users = ['ceo@acmecorp.com', 'cto@acmecorp.com', 'k.patel@acmecorp.com', 'j.martinez@acmecorp.com', 'r.chen@acmecorp.com'];
    const eventTypes = ['login_failed', 'malware_detected', 'phishing_link_clicked', 'unusual_data_access', 'smb_lateral_movement'];
    const severities = ['info', 'low', 'medium', 'high', 'critical'];

    // We want one user to have a very high risk score (k.patel)
    const riskyUser = 'k.patel@acmecorp.com';

    for (let i = 0; i < 300; i++) {
      const isRisky = Math.random() < 0.2;
      const user = isRisky ? riskyUser : users[Math.floor(Math.random() * users.length)];
      // Bias severity for risky user
      const sevIdx = isRisky ? Math.floor(Math.random() * 2) + 3 : Math.floor(Math.random() * 3); 
      const sev = severities[sevIdx];
      const eType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
      const ip = '10.0.0.' + Math.floor(Math.random() * 100);

      const { rows: evRows } = await client.query(
        `INSERT INTO soc_events (tenant_id, type, severity, source_ip, user_email, message, raw, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() - (random() * interval '7 days')) RETURNING id`,
        [
          tenantId, 
          eType, 
          sev, 
          ip, 
          user, 
          `Detected ${eType} from ${user}`, 
          JSON.stringify({ raw_ip: ip, action: 'blocked' })
        ]
      );

      // Create an alert for high/critical events
      if (sev === 'high' || sev === 'critical') {
        const isClosed = Math.random() < 0.4;
        await client.query(
          `INSERT INTO soc_alerts (tenant_id, event_id, severity, message, status, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW() - (random() * interval '2 days'))`,
          [tenantId, evRows[0].id, sev, `Critical Alert: ${eType}`, isClosed ? 'resolved' : 'open']
        );
      }
    }

    // 6. Seed SOC Cases
    console.log('Seeding SOC Cases...');
    const caseTitles = ['Suspected insider data access', 'Credential stuffing campaign', 'Malware C2 beaconing', 'Lateral movement via SMB'];
    for (let i = 0; i < 10; i++) {
      await client.query(
        `INSERT INTO soc_cases (tenant_id, title, type, severity, status, assigned_to, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW() - (random() * interval '3 days'))`,
        [
          tenantId,
          caseTitles[Math.floor(Math.random() * caseTitles.length)],
          'automated',
          severities[Math.floor(Math.random() * 2) + 3], // high/critical
          Math.random() > 0.5 ? 'open' : 'investigating',
          users[Math.floor(Math.random() * users.length)]
        ]
      );
    }

    await client.query('COMMIT');
    console.log('--- SOC Seeding Completed Successfully ---');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', e);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

seed();
