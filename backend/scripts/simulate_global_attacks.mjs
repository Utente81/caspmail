import path from 'path';
import { fileURLToPath } from 'url';
import pool from './src/db/pool.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// A list of IP prefixes simulating different global regions
const REGIONS = [
  { name: 'China', prefixes: ['114.114', '1.2', '14.1', '27.115', '42.120', '58.14', '60.10', '101.224', '112.64', '183.128'] },
  { name: 'Russia', prefixes: ['46.17', '62.76', '77.82', '85.26', '95.105', '109.184', '178.64', '188.162', '212.112', '213.87'] },
  { name: 'USA', prefixes: ['104.16', '142.250', '13.107', '52.11', '192.0', '198.51', '23.45', '71.12', '98.138', '199.16'] },
  { name: 'Brazil', prefixes: ['177.1', '187.12', '200.20', '189.15', '191.240'] },
  { name: 'Nigeria', prefixes: ['41.190', '102.132', '197.210'] },
  { name: 'Germany', prefixes: ['46.163', '78.46', '85.214', '144.76'] }
];

const EVENT_TYPES = ['login_failed', 'ssh_auth_failed', 'port_scan', 'brute_force', 'api_abuse', 'malware_signature'];
const USERS = ['admin@cyber.com', 'soc@cyber.com', 'root', 'service_account', 'john.doe@cyber.com'];

function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomIP() {
  const region = randomElement(REGIONS);
  const prefix = randomElement(region.prefixes);
  const suffix = `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  return `${prefix}.${suffix}`;
}

async function simulateAttack(tenantId) {
  const type = randomElement(EVENT_TYPES);
  // Port scan is usually high, brute force critical, login failed medium/low
  let severity = 'low';
  if (['brute_force', 'malware_signature'].includes(type)) severity = 'critical';
  else if (['ssh_auth_failed', 'api_abuse'].includes(type)) severity = 'high';
  else if (type === 'port_scan') severity = 'medium';
  else severity = randomElement(['low', 'medium']);

  const ip = randomIP();
  const user = randomElement(USERS);
  
  const message = `Detected ${type.replace('_', ' ')} originating from ${ip}`;
  
  const raw = {
    method: 'SIMULATOR',
    headers: { 'user-agent': 'nmap/7.92', 'x-forwarded-for': ip },
    payload: { user, target: '/api/v1/auth' }
  };

  try {
    await pool.query(
      `INSERT INTO soc_events (tenant_id, type, severity, source_ip, user_email, message, raw)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [tenantId, type, severity, ip, user, message, JSON.stringify(raw)]
    );
    console.log(`[${new Date().toISOString()}] [${severity.toUpperCase()}] ${type} from ${ip} (Tenant: ${tenantId})`);
  } catch (err) {
    console.error('Error inserting event:', err);
  }
}

async function startSimulation() {
  console.log('--- SOC Threat Map Demo Simulator ---');
  console.log('Fetching active tenants...');
  const { rows } = await pool.query('SELECT id, name FROM tenants LIMIT 10');
  if (rows.length === 0) {
    console.error('No tenants found in database! Exiting.');
    process.exit(1);
  }

  const tenantIds = rows.map(r => r.id);
  console.log(`Found ${tenantIds.length} tenants. Starting attack simulation... Press Ctrl+C to stop.\n`);

  // Random intervals between 500ms and 3000ms
  const loop = () => {
    const tenantId = randomElement(tenantIds);
    simulateAttack(tenantId);
    
    const nextTimeout = Math.floor(Math.random() * 2500) + 500;
    setTimeout(loop, nextTimeout);
  };

  loop();
}

startSimulation();
