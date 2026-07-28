import pool from './db/pool.mjs';

const SEVERITIES = ['info', 'low', 'medium', 'high', 'critical'];

function getRandomIP() {
  const a = Math.floor(Math.random() * 256);
  const b = Math.floor(Math.random() * 256);
  const c = Math.floor(Math.random() * 256);
  const d = Math.floor(Math.random() * 256);
  return `${a}.${b}.${c}.${d}`;
}

const SCENARIOS = [
  {
    type: 'auth_bruteforce',
    mitre_tactic: 'Credential Access',
    mitre_technique: 'T1110',
    messages: [
      'Failed login attempt for admin@secure.internal',
      'Multiple failed logins detected from single IP',
      'Keycloak Brute Force Attack detected'
    ],
    base_severity: 'high'
  },
  {
    type: 'vault_anomalous_access',
    mitre_tactic: 'Credential Access',
    mitre_technique: 'T1555',
    messages: [
      'Anomalous access to Vault KMS secrets',
      'Unusual volume of master keys requested',
      'Vault unseal attempt from unauthorized IP'
    ],
    base_severity: 'critical'
  },
  {
    type: 'data_exfiltration',
    mitre_tactic: 'Exfiltration',
    mitre_technique: 'T1041',
    messages: [
      'Large outbound data transfer to suspicious IP',
      'Anomalous volume of emails forwarded externally',
      'Data Exfiltration via alternative protocol detected'
    ],
    base_severity: 'critical'
  },
  {
    type: 'malicious_traffic',
    mitre_tactic: 'Initial Access',
    mitre_technique: 'T1190',
    messages: [
      'Exploit attempt against exposed web interface',
      'Suspicious payload detected by WAF',
      'SQL Injection attempt blocked'
    ],
    base_severity: 'medium'
  }
];

export function startSimulator(app) {
  app.log.info('Starting SOC Threat Simulator (Advanced Scenarios)...');
  
  setInterval(async () => {
    try {
      const tenantId = 'system';
      const scenario = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
      
      const type = scenario.type;
      const severity = Math.random() > 0.6 ? scenario.base_severity : SEVERITIES[Math.floor(Math.random() * SEVERITIES.length)];
      const source_ip = getRandomIP();
      
      const mitre_tactic = scenario.mitre_tactic;
      const mitre_technique = scenario.mitre_technique;
      const ueba_score = Math.floor(Math.random() * 50) + (severity === 'critical' || severity === 'high' ? 50 : 0);
      
      const message = scenario.messages[Math.floor(Math.random() * scenario.messages.length)];
      
      const raw = {
        mitre_tactic,
        mitre_technique,
        ueba_score,
        threat_intelligence: "Known Malicious Actor Profile",
        scenario_type: type
      };

      const { rows: evRows } = await pool.query(
        `INSERT INTO soc_events (tenant_id, type, severity, source_ip, message, raw)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [tenantId, type, severity, source_ip, message, JSON.stringify(raw)]
      );
      
      const event = evRows[0];
      
      if (severity === 'critical' || severity === 'high') {
        await pool.query(
          `INSERT INTO soc_alerts (tenant_id, event_id, severity, message, status)
           VALUES ($1, $2, $3, $4, 'open')`,
          [tenantId, event.id, severity, message]
        );
      }
      
      app.log.warn({
        SIEM_EVENT: true,
        type: type,
        severity: severity,
        source_ip: source_ip,
        mitre_tactic: mitre_tactic,
        mitre_technique: mitre_technique,
        message: message
      }, `[SIEM] Threat Simulator Event: ${message}`);
      
    } catch (err) {
      app.log.error({ err }, 'SOC Simulator error');
    }
  }, 4000);
}
