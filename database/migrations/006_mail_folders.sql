-- CaspMail folders schema update
-- Migration: 006_mail_folders.sql

BEGIN;

ALTER TABLE e2ee_messages ADD COLUMN sender_deleted_at TIMESTAMPTZ;
ALTER TABLE e2ee_messages ADD COLUMN recipient_deleted_at TIMESTAMPTZ;

-- Maintain indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_sender_deleted ON e2ee_messages(tenant_id, from_email) WHERE sender_deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_recipient_deleted ON e2ee_messages(tenant_id, to_email) WHERE recipient_deleted_at IS NOT NULL;

COMMIT;
