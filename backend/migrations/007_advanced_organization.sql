-- Advanced Organization & Contacts
-- Migration: 007_advanced_organization.sql

BEGIN;

-- 1. Add JSONB flags to messages for flexible organization
ALTER TABLE e2ee_messages ADD COLUMN IF NOT EXISTS sender_flags JSONB DEFAULT '{}';
ALTER TABLE e2ee_messages ADD COLUMN IF NOT EXISTS recipient_flags JSONB DEFAULT '{}';

-- 2. Drafts table
CREATE TABLE IF NOT EXISTS e2ee_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_email TEXT NOT NULL,
    to_email TEXT,
    subject_encrypted TEXT NOT NULL,
    body_encrypted TEXT NOT NULL,
    nonce TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_drafts_tenant_email ON e2ee_drafts(tenant_id, user_email);

-- 3. Custom Folders / Labels table
CREATE TABLE IF NOT EXISTS e2ee_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_email TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'folder', -- 'folder' or 'label'
    color TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, user_email, name, type)
);
CREATE INDEX IF NOT EXISTS idx_folders_tenant_email ON e2ee_folders(tenant_id, user_email);

-- 4. Contacts table
CREATE TABLE IF NOT EXISTS e2ee_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_email TEXT NOT NULL,
    contact_email TEXT NOT NULL,
    contact_name TEXT,
    is_favorite BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, user_email, contact_email)
);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_email ON e2ee_contacts(tenant_id, user_email);

COMMIT;
