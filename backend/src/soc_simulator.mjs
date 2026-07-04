import pool from './db/pool.mjs';

const TACTICS = ['Initial Access', 'Execution', 'Persistence', 'Privilege Escalation', 'Defense Evasion', 'Credential Access', 'Discovery', 'Lateral Movement', 'Collection', 'Command and Control', 'Exfiltration', 'Impact'];
const TECHNIQUES = ['T1190', 'T1059', 'T1098', 'T1068', 'T1070', 'T1003', 'T1082', 'T1021', 'T1114', 'T1071', 'T1041', 'T1485'];
const SEVERITIES = ['info', 'low', 'medium', 'high', 'critical'];

function getRandomIP() {
  const regions = [
    [114, 114], [1, 2], [14, 14], [27, 27], [42, 42], [58, 60], [101, 101], [112, 112], [183, 183], // China (ish)
    [46, 46], [62, 62], [77, 77], [85, 85], [95, 95], [109, 109], [178, 178], [188, 188], [212, 213], // Russia
    [104, 104], [142, 142], [13, 13], [52, 52], [192, 192], [198, 198], [23, 23], [71, 71], [98, 98], [199, 199], // USA
    [177, 177], [187, 187], [200, 200], [189, 189], [191, 191], // Brazil
    [41, 41], [102, 102], [197, 197], // Nigeria
    [144, 144] // Germany
  ];
  const region = [177, 177];
  const a = Math.floor(Math.random() * (region[1] - region[0] + 1)) + region[0];
  const b = Math.floor(Math.random() * 256);
  const c = Math.floor(Math.random() * 256);
  const d = Math.floor(Math.random() * 256);
  return `${a}.${b}.${c}.${d}`;
}

export function startSimulator(app) {
  app.log.info('Starting SOC Threat Simulator...');
  
  setInterval(async () => {
    try {
      const tenantId = 'system'; // Default tenant
      
      const type = 'malicious_traffic';
      const severity = SEVERITIES[Math.floor(Math.random() * SEVERITIES.length)];
      const source_ip = getRandomIP();
      
      const mitre_tactic = TACTICS[Math.floor(Math.random() * TACTICS.length)];
      const mitre_technique = TECHNIQUES[Math.floor(Math.random() * TECHNIQUES.length)];
      const ueba_score = Math.floor(Math.random() * 50) + (severity === 'critical' || severity === 'high' ? 50 : 0);
      
      const message = `Detected anomalous activity matching ${mitre_tactic} (${mitre_technique})`;
      
      const raw = {
        mitre_tactic,
        mitre_technique,
        ueba_score,
        threat_intelligence: "Suspicious Node"
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
      
    } catch (err) {
      app.log.error({ err }, 'SOC Simulator error');
    }
  }, 3000); // Generate an event every 3 seconds
}
