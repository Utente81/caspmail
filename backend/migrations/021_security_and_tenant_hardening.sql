-- Incremental hardening for databases where 020_missing_tables.sql is already recorded.
-- This migration is deliberately additive and does not drop/recreate production data.
BEGIN;
ALTER TABLE tenant_mobile_policies
  ADD COLUMN IF NOT EXISTS require_biometrics BOOLEAN DEFAULT false;
ALTER TABLE tenant_mobile_policies
  ADD COLUMN IF NOT EXISTS prevent_screenshots BOOLEAN DEFAULT false;
-- Preserve positive values from the short-lived legacy column names when they exist.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_mobile_policies' AND column_name = 'require_pin'
  ) THEN
    UPDATE tenant_mobile_policies
       SET require_biometrics = TRUE
     WHERE require_pin IS TRUE AND require_biometrics IS NOT TRUE;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_mobile_policies' AND column_name = 'disable_screenshots'
  ) THEN
    UPDATE tenant_mobile_policies
       SET prevent_screenshots = TRUE
     WHERE disable_screenshots IS TRUE AND prevent_screenshots IS NOT TRUE;
  END IF;
END $$;
ALTER TABLE phishing_targets
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE phishing_targets
  ADD COLUMN IF NOT EXISTS tenant_id TEXT;
UPDATE phishing_targets t
   SET tenant_id = c.tenant_id
  FROM phishing_campaigns c
 WHERE t.campaign_id = c.id
   AND t.tenant_id IS NULL;
ALTER TABLE soc_cases
  ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE vulnerabilities
  ADD COLUMN IF NOT EXISTS tenant_id TEXT;
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_tenant
  ON vulnerabilities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_phishing_targets_message_tenant
  ON phishing_targets(message_id, tenant_id);
COMMIT;
