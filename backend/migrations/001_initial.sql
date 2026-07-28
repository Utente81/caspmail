-- CaspMail initial schema
-- Migration: 001_initial.sql

BEGIN;

-- ─── Tenants ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tenants (
    id          TEXT PRIMARY KEY,                         -- e.g. 'acme-corp'
    name        TEXT NOT NULL,
    plan        TEXT NOT NULL DEFAULT 'starter',          -- starter | pro | enterprise
    region      TEXT NOT NULL DEFAULT 'eu-west-1',
    status      TEXT NOT NULL DEFAULT 'active',           -- active | suspended | deleted
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Users ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email       TEXT NOT NULL,
    name        TEXT NOT NULL DEFAULT '',
    role        TEXT NOT NULL DEFAULT 'user',             -- user | soc_analyst | soc_admin | admin | casper_admin
    quota_mb    INTEGER NOT NULL DEFAULT 1024,
    status      TEXT NOT NULL DEFAULT 'active',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email  ON users(email);

-- ─── Domains ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS domains (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    domain          TEXT NOT NULL UNIQUE,
    is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
    verified        BOOLEAN NOT NULL DEFAULT FALSE,
    dns_txt_token   TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_domains_tenant ON domains(tenant_id);

-- ─── E2EE Keys ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS e2ee_keys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_email      TEXT NOT NULL,
    public_key      TEXT NOT NULL,
    key_fingerprint TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, user_email)
);

CREATE INDEX IF NOT EXISTS idx_e2ee_keys_tenant_email ON e2ee_keys(tenant_id, user_email);

-- ─── E2EE Messages ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS e2ee_messages (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    from_email        TEXT NOT NULL,
    to_email          TEXT NOT NULL,
    subject_encrypted TEXT NOT NULL,
    body_encrypted    TEXT NOT NULL,
    nonce             TEXT NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at           TIMESTAMPTZ,
    deleted_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_messages_tenant     ON e2ee_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_messages_to_email   ON e2ee_messages(tenant_id, to_email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_messages_from_email ON e2ee_messages(tenant_id, from_email) WHERE deleted_at IS NULL;

-- ─── SOC Events ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS soc_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    type        TEXT NOT NULL,                            -- login_failure | suspicious_access | data_exfil | …
    severity    TEXT NOT NULL DEFAULT 'info',             -- info | low | medium | high | critical
    source_ip   INET,
    user_email  TEXT,
    message     TEXT NOT NULL DEFAULT '',
    raw         JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_soc_events_tenant   ON soc_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_soc_events_severity ON soc_events(tenant_id, severity);
CREATE INDEX IF NOT EXISTS idx_soc_events_created  ON soc_events(created_at DESC);

-- ─── SOC Cases ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS soc_cases (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    type        TEXT NOT NULL,
    severity    TEXT NOT NULL DEFAULT 'medium',
    status      TEXT NOT NULL DEFAULT 'open',             -- open | investigating | resolved | closed
    title       TEXT NOT NULL DEFAULT '',
    assigned_to TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_soc_cases_tenant ON soc_cases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_soc_cases_status ON soc_cases(tenant_id, status);

-- ─── SOC Alerts ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS soc_alerts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    event_id    UUID REFERENCES soc_events(id) ON DELETE SET NULL,
    severity    TEXT NOT NULL DEFAULT 'medium',
    message     TEXT NOT NULL DEFAULT '',
    status      TEXT NOT NULL DEFAULT 'open',             -- open | acknowledged | resolved
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_soc_alerts_tenant ON soc_alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_soc_alerts_status ON soc_alerts(tenant_id, status);

-- ─── Audit Log ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   TEXT REFERENCES tenants(id) ON DELETE SET NULL,
    actor       TEXT NOT NULL,
    action      TEXT NOT NULL,
    resource    TEXT NOT NULL DEFAULT '',
    details     JSONB NOT NULL DEFAULT '{}',
    ip          INET,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_tenant  ON audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor   ON audit_log(actor);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);

COMMIT;
