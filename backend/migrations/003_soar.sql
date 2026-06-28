CREATE TABLE IF NOT EXISTS soar_playbooks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        TEXT NOT NULL,
  name             TEXT NOT NULL,
  trigger_type     TEXT NOT NULL,
  action_type      TEXT NOT NULL,
  config           JSONB NOT NULL DEFAULT '{}',
  status           TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active','inactive','error')),
  created_by       TEXT,
  last_run_at      TIMESTAMPTZ,
  last_run_status  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS soar_playbooks_tenant ON soar_playbooks (tenant_id);
CREATE INDEX IF NOT EXISTS soar_playbooks_trigger ON soar_playbooks (trigger_type) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS soar_runs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id  UUID NOT NULL REFERENCES soar_playbooks(id) ON DELETE CASCADE,
  tenant_id    TEXT NOT NULL,
  trigger_type TEXT NOT NULL DEFAULT 'manual',
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','running','success','failure')),
  result       JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS soar_runs_playbook ON soar_runs (playbook_id, created_at DESC);
CREATE INDEX IF NOT EXISTS soar_runs_tenant ON soar_runs (tenant_id, created_at DESC);
