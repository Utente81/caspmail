BEGIN;

CREATE TABLE IF NOT EXISTS organization_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,
    alias_email VARCHAR(255) NOT NULL,
    members JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_aliases_email ON organization_aliases(alias_email);
CREATE INDEX IF NOT EXISTS idx_org_aliases_tenant ON organization_aliases(tenant_id);

COMMIT;
