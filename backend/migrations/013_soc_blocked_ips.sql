CREATE TABLE IF NOT EXISTS soc_blocked_ips (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(50) NOT NULL,
  ip VARCHAR(45) NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ,
  UNIQUE(tenant_id, ip)
);

CREATE INDEX IF NOT EXISTS idx_soc_blocked_ips_ip ON soc_blocked_ips(ip);
