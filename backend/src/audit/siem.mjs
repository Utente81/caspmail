import crypto from 'crypto';

if (process.env.NODE_ENV === 'production' && !process.env.SIEM_SECRET) {
  throw new Error('FATAL: SIEM_SECRET environment variable is required in production for immutable audit logs.');
}
const SIEM_SECRET = process.env.SIEM_SECRET || crypto.randomBytes(32).toString('hex');

/**
 * Logs a high-value security or compliance event to the SIEM via stdout.
 * The log is cryptographically signed to guarantee immutability.
 * 
 * @param {string} tenantId - The ID of the tenant.
 * @param {string} actor - The user (email or ID) performing the action.
 * @param {string} action - The action type (e.g. 'read_mail', 'export_data', 'click_threat').
 * @param {string} resource - The target resource (e.g. message ID, alert ID).
 * @param {object} details - Additional structured JSON details.
 * @param {string} ip - IP address of the actor.
 */
export function logSiemEvent({ tenantId, actor, action, resource, details, ip }) {
  const timestamp = new Date().toISOString();
  
  const payload = {
    tenant_id: tenantId,
    timestamp,
    actor,
    action,
    resource,
    details: details || {},
    ip: ip || 'unknown'
  };

  // Create HMAC signature to prove the log wasn't tampered with
  const signature = crypto.createHmac('sha256', SIEM_SECRET)
                          .update(JSON.stringify(payload))
                          .digest('hex');
  
  const logEntry = {
    ...payload,
    _signature: signature,
    _source: 'caspermail-backend'
  };

  // Emit to stdout in structured JSON format for log forwarders (e.g. Fluentd, Promtail, Filebeat)
  console.log(JSON.stringify({ SIEM_EVENT: logEntry }));
}
