BEGIN;

ALTER TABLE e2ee_keys
ADD COLUMN IF NOT EXISTS private_key_encrypted TEXT,
ADD COLUMN IF NOT EXISTS private_key_salt TEXT;

COMMIT;
