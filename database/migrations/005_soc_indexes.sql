-- Index for SOC Events
CREATE INDEX IF NOT EXISTS idx_soc_events_tenant_time ON soc_events(tenant_id, created_at DESC);

-- Index for SOC Alerts
CREATE INDEX IF NOT EXISTS idx_soc_alerts_tenant_time ON soc_alerts(tenant_id, created_at DESC);
