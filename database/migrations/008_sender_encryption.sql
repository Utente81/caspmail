-- Migration 008: Add sender encryption fields to messages

BEGIN;

ALTER TABLE e2ee_messages ADD COLUMN IF NOT EXISTS sender_subject_encrypted TEXT;
ALTER TABLE e2ee_messages ADD COLUMN IF NOT EXISTS sender_body_encrypted TEXT;
ALTER TABLE e2ee_messages ADD COLUMN IF NOT EXISTS sender_nonce TEXT;

COMMIT;
