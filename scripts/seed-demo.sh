#!/usr/bin/env bash
# seed-demo.sh — Popola il database con dati demo per CaspMail
# Uso: bash seed-demo.sh [POSTGRES_HOST] [POSTGRES_PORT]
# Richiede: psql, le secrets in /opt/caspermail/runtime-secrets/ (o env DATABASE_URL)

set -euo pipefail

PG_HOST="${1:-localhost}"
PG_PORT="${2:-5432}"
PG_USER="${PG_USER:-caspermail}"
PG_DB="${PG_DB:-caspermail}"

# Read password from secrets file or env
if [ -n "${DATABASE_URL:-}" ]; then
  PSQL_CMD="psql $DATABASE_URL"
elif [ -f /opt/caspermail/runtime-secrets/postgres_password ]; then
  export PGPASSWORD="$(cat /opt/caspermail/runtime-secrets/postgres_password)"
  PSQL_CMD="psql -h $PG_HOST -p $PG_PORT -U $PG_USER -d $PG_DB"
elif [ -f /run/secrets/postgres_password ]; then
  export PGPASSWORD="$(cat /run/secrets/postgres_password)"
  PSQL_CMD="psql -h $PG_HOST -p $PG_PORT -U $PG_USER -d $PG_DB"
else
  echo "[seed] ERROR: no postgres password found"
  exit 1
fi

echo "[seed] Connessione a PostgreSQL $PG_HOST:$PG_PORT/$PG_DB..."

$PSQL_CMD <<'SQL'

-- ─── Tenants ─────────────────────────────────────────────────────────────────

INSERT INTO tenants (id, name, plan, region, status) VALUES
  ('acme-corp',    'Acme Corporation',    'enterprise', 'eu-west-1',   'active'),
  ('globex-inc',   'Globex Inc.',         'business',   'eu-central-1','active'),
  ('initech-ltd',  'Initech Ltd.',        'starter',    'eu-west-1',   'active')
ON CONFLICT (id) DO NOTHING;

-- ─── Users ───────────────────────────────────────────────────────────────────

INSERT INTO users (tenant_id, email, name, role, quota_mb, status) VALUES
  -- Acme
  ('acme-corp',   'admin@acme.corp',       'Alice Admin',   'admin',        500, 'active'),
  ('acme-corp',   'soc@acme.corp',         'Bob Analyst',   'soc_analyst',  200, 'active'),
  ('acme-corp',   'socmgr@acme.corp',      'Carol Manager', 'soc_manager',  200, 'active'),
  ('acme-corp',   'alice@acme.corp',       'Alice User',    'user',         100, 'active'),
  ('acme-corp',   'dave@acme.corp',        'Dave User',     'user',         100, 'active'),
  -- Globex
  ('globex-inc',  'admin@globex.corp',     'Greg Admin',    'admin',        300, 'active'),
  ('globex-inc',  'henry@globex.corp',     'Henry User',    'user',         100, 'active'),
  -- Initech
  ('initech-ltd', 'peter@initech.corp',    'Peter Gibbons', 'user',          50, 'active')
ON CONFLICT (email) DO NOTHING;

-- ─── Domains ─────────────────────────────────────────────────────────────────

INSERT INTO domains (tenant_id, domain, is_primary, verified) VALUES
  ('acme-corp',  'acme.corp',   TRUE,  TRUE),
  ('acme-corp',  'mail.acme.corp', FALSE, FALSE),
  ('globex-inc', 'globex.corp', TRUE,  TRUE),
  ('initech-ltd','initech.corp',TRUE,  FALSE)
ON CONFLICT DO NOTHING;

-- ─── SOC Events ──────────────────────────────────────────────────────────────

INSERT INTO soc_events (tenant_id, type, severity, source_ip, user_email, message, raw) VALUES
  ('acme-corp','auth_failure',   'critical','185.220.101.45','alice@acme.corp',  'Brute-force: 50 failed logins in 2 minutes',  '{"attempts":50,"window":"120s"}'),
  ('acme-corp','malware',        'critical','10.0.1.5',      NULL,               'Ransomware file pattern detected on file server', '{"file":"/data/important.docx.enc"}'),
  ('acme-corp','c2_beacon',      'critical','10.0.4.88',     NULL,               'C2 beacon pattern in DNS queries',               '{"query":"evil.c2.example.com","count":12}'),
  ('acme-corp','data_exfil',     'high',    '10.0.1.14',     'dave@acme.corp',   'Unusual outbound data transfer: 4.2 GB in 10 min','{"bytes":4509715456,"dest":"203.0.113.99"}'),
  ('acme-corp','priv_escalation','high',    '10.0.3.17',     'dave@acme.corp',   'Privilege escalation attempt via sudo',          '{"command":"sudo su -"}'),
  ('acme-corp','auth_failure',   'high',    '172.16.0.5',    'alice@acme.corp',  'Multiple failed MFA attempts',                   '{"attempts":8}'),
  ('acme-corp','lateral_movement','high',   '10.0.2.11',     NULL,               'Unusual SMB traffic to multiple hosts',           '{"targets":["10.0.1.1","10.0.1.2","10.0.1.3"]}'),
  ('acme-corp','auth_failure',   'medium',  '192.168.1.20',  'soc@acme.corp',    'Login outside business hours',                   '{"time":"02:15 UTC"}'),
  ('acme-corp','recon',          'medium',  '10.0.3.22',     NULL,               'Port scan detected from internal host',           '{"ports_scanned":1024}'),
  ('acme-corp','tls_anomaly',    'low',     '203.0.113.55',  NULL,               'Self-signed certificate from external server',    '{"cn":"evil.example.com"}'),
  ('acme-corp','auth_success',   'info',    '10.0.0.1',      'admin@acme.corp',  'Admin login successful',                         '{}'),
  ('acme-corp','auth_failure',   'medium',  '185.220.101.99','bob@external.com', 'Failed login for unknown user',                  '{"user":"bob@external.com"}'),
  ('globex-inc','auth_failure',  'high',    '91.108.4.100',  'henry@globex.corp','Credential stuffing attack detected',            '{"attempts":200}'),
  ('globex-inc','malware',       'medium',  '10.1.0.5',      NULL,               'Suspicious process injection detected',           '{"pid":4521,"process":"svchost.exe"}')
ON CONFLICT DO NOTHING;

-- ─── SOC Alerts ──────────────────────────────────────────────────────────────

INSERT INTO soc_alerts (tenant_id, severity, message, status)
SELECT tenant_id, severity, message, 'open'
FROM soc_events
WHERE severity IN ('critical','high') AND tenant_id = 'acme-corp'
ON CONFLICT DO NOTHING;

-- ─── SOC Cases ───────────────────────────────────────────────────────────────

INSERT INTO soc_cases (tenant_id, title, type, severity, status, assigned_to) VALUES
  ('acme-corp','Ransomware Infection Investigation','malware','critical','open','soc@acme.corp'),
  ('acme-corp','Brute-Force Attack from TOR Exit Node','auth_attack','high','investigating','socmgr@acme.corp'),
  ('acme-corp','Insider Threat: Unusual Data Transfer','insider_threat','high','open',NULL),
  ('globex-inc','Credential Stuffing Campaign','auth_attack','high','open','admin@globex.corp')
ON CONFLICT DO NOTHING;

-- ─── Audit Log ───────────────────────────────────────────────────────────────

INSERT INTO audit_log (tenant_id, actor, action, resource, details, ip) VALUES
  ('acme-corp','admin@acme.corp','create','tenant','{"name":"Acme Corporation"}','10.0.0.1'),
  ('acme-corp','admin@acme.corp','create','user','{"email":"soc@acme.corp","role":"soc_analyst"}','10.0.0.1'),
  ('acme-corp','admin@acme.corp','create','domain','{"domain":"acme.corp"}','10.0.0.1'),
  ('acme-corp','admin@acme.corp','verify','domain','{"domain":"acme.corp","verified":true}','10.0.0.1'),
  ('acme-corp','soc@acme.corp', 'update_status','soc_alert','{"status":"acknowledged"}','10.0.0.5'),
  ('globex-inc','admin@globex.corp','create','tenant','{"name":"Globex Inc."}','192.168.0.1'),
  ('globex-inc','admin@globex.corp','create','user','{"email":"henry@globex.corp","role":"user"}','192.168.0.1')
ON CONFLICT DO NOTHING;

-- ─── SOAR Playbooks (demo) ────────────────────────────────────────────────────

INSERT INTO soar_playbooks (tenant_id, name, trigger_type, action_type, config, status, created_by) VALUES
  ('acme-corp','Auto-case on critical alert','alert_critical','create_case',
   '{"title":"Auto-created case from critical alert"}','active','admin@acme.corp'),
  ('acme-corp','Notify SOC manager on high severity','alert_high','send_email',
   '{"to":"socmgr@acme.corp","subject":"[SOC] High severity alert detected"}','inactive','admin@acme.corp'),
  ('acme-corp','Slack notify on critical','alert_critical','slack_notify',
   '{"webhook_url":"","message":"Critical alert in CaspMail SOC!"}','inactive','admin@acme.corp')
ON CONFLICT DO NOTHING;

-- ─── Compliance seed (NIS2 partial) ──────────────────────────────────────────

INSERT INTO soc_compliance (tenant_id, framework, control_id, status, updated_by) VALUES
  ('acme-corp','nis2','nis2-1','compliant',   'admin@acme.corp'),
  ('acme-corp','nis2','nis2-2','compliant',   'admin@acme.corp'),
  ('acme-corp','nis2','nis2-3','partial',     'admin@acme.corp'),
  ('acme-corp','nis2','nis2-4','not_assessed','admin@acme.corp'),
  ('acme-corp','nis2','nis2-8','compliant',   'admin@acme.corp'),
  ('acme-corp','nis2','nis2-10','partial',    'admin@acme.corp'),
  ('acme-corp','gdpr','gdpr-1','compliant',   'admin@acme.corp'),
  ('acme-corp','gdpr','gdpr-2','compliant',   'admin@acme.corp'),
  ('acme-corp','gdpr','gdpr-5','partial',     'admin@acme.corp'),
  ('acme-corp','gdpr','gdpr-8','compliant',   'admin@acme.corp')
ON CONFLICT (tenant_id, framework, control_id) DO NOTHING;

SELECT 'Seed completed!' AS result;
SQL

echo "[seed] ✓ Done. Dati demo inseriti."
echo ""
echo "Tenant disponibili:"
echo "  - acme-corp    (enterprise, EU)"
echo "  - globex-inc   (business, EU)"
echo "  - initech-ltd  (starter, EU)"
echo ""
echo "Utenti demo:"
echo "  admin@acme.corp       / ruolo: admin"
echo "  soc@acme.corp         / ruolo: soc_analyst"
echo "  socmgr@acme.corp      / ruolo: soc_manager"
echo "  alice@acme.corp       / ruolo: user"
echo "  admin@globex.corp     / ruolo: admin"
echo "  henry@globex.corp     / ruolo: user"
echo ""
echo "NOTA: Le password utente vanno configurate in Keycloak tramite setup-keycloak.sh"
