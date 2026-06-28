CREATE TABLE IF NOT EXISTS soc_compliance (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   TEXT NOT NULL,
  framework   TEXT NOT NULL,   -- 'nis2', 'gdpr', 'iso27001'
  control_id  TEXT NOT NULL,   -- e.g. 'nis2-1'
  status      TEXT NOT NULL DEFAULT 'not_assessed'
                CHECK (status IN ('compliant','partial','non_compliant','not_assessed')),
  updated_by  TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, framework, control_id)
);

CREATE INDEX IF NOT EXISTS soc_compliance_tenant_fw ON soc_compliance (tenant_id, framework);
