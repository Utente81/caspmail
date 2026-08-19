import pool from '../db/pool.mjs';

export async function processSoarPlaybooks(tenantId, triggerType, eventData) {
  try {
    // Find active playbooks for this trigger type
    const { rows: playbooks } = await pool.query(
      `SELECT * FROM soar_playbooks WHERE tenant_id = $1 AND trigger_type = $2 AND status = 'active'`,
      [tenantId, triggerType]
    );

    for (const playbook of playbooks) {
      // Create a pending run
      const { rows: runRows } = await pool.query(
        `INSERT INTO soar_runs (playbook_id, tenant_id, trigger_type, status)
         VALUES ($1, $2, $3, 'running') RETURNING id`,
        [playbook.id, tenantId, triggerType]
      );
      const runId = runRows[0].id;

      let result = { log: 'Playbook started' };
      let finalStatus = 'success';

      try {
        if (playbook.action_type === 'block_ip') {
          // Add IP to blocked list
          const ip = eventData.source_ip;
          if (ip) {
            await pool.query(
              `INSERT INTO soc_blocked_ips (tenant_id, ip_address, reason, expires_at)
               VALUES ($1, $2, $3, NOW() + INTERVAL '24 hours') ON CONFLICT DO NOTHING`,
              [tenantId, ip, `Automated block by SOAR Playbook: ${playbook.name}`]
            );
            result.log = `Successfully blocked IP ${ip}`;
          } else {
            result.log = 'No source IP provided in event data';
          }
        } else if (playbook.action_type === 'suspend_user') {
          const userEmail = eventData.user_email;
          if (userEmail) {
            await pool.query(
              `UPDATE users SET status = 'suspended' WHERE tenant_id = $1 AND email = $2`,
              [tenantId, userEmail]
            );
            result.log = `Successfully suspended user ${userEmail}`;
          } else {
            result.log = 'No user email provided in event data';
          }
        } else {
          result.log = `Unknown action type: ${playbook.action_type}`;
          finalStatus = 'failure';
        }
      } catch (err) {
        console.error(`[SOAR] Error executing playbook ${playbook.id}:`, err);
        result.log = `Error: ${err.message}`;
        finalStatus = 'failure';
      }

      // Update run status
      await pool.query(
        `UPDATE soar_runs SET status = $1, result = $2, completed_at = NOW() WHERE id = $3`,
        [finalStatus, JSON.stringify(result), runId]
      );

      // Update playbook last run
      await pool.query(
        `UPDATE soar_playbooks SET last_run_at = NOW(), last_run_status = $1 WHERE id = $2`,
        [finalStatus, playbook.id]
      );
    }
  } catch (err) {
    console.error(`[SOAR] Error processing playbooks for ${triggerType}:`, err);
  }
}
