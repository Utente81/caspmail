#!/bin/bash
kubectl exec -n caspermail casper-pg-postgresql-primary-0 -- env PGPASSWORD=casper_db_password psql -U postgres -d caspermail -c "
INSERT INTO soc_compliance (tenant_id, framework, control_id, status, updated_by) VALUES
('system', 'gdpr', 'gdpr-3', 'compliant', 'system'),
('system', 'gdpr', 'gdpr-4', 'compliant', 'system'),
('system', 'gdpr', 'gdpr-5', 'compliant', 'system'),
('system', 'gdpr', 'gdpr-7', 'compliant', 'system'),
('system', 'gdpr', 'gdpr-8', 'compliant', 'system'),
('system', 'gdpr', 'gdpr-1', 'not_assessed', 'system'),
('system', 'gdpr', 'gdpr-2', 'not_assessed', 'system'),
('system', 'gdpr', 'gdpr-6', 'not_assessed', 'system'),

('system', 'iso27001', 'iso-3', 'compliant', 'system'),
('system', 'iso27001', 'iso-4', 'compliant', 'system'),
('system', 'iso27001', 'iso-6', 'compliant', 'system'),
('system', 'iso27001', 'iso-7', 'compliant', 'system'),
('system', 'iso27001', 'iso-9', 'compliant', 'system'),
('system', 'iso27001', 'iso-1', 'partial', 'system'),
('system', 'iso27001', 'iso-2', 'partial', 'system'),
('system', 'iso27001', 'iso-5', 'not_assessed', 'system'),
('system', 'iso27001', 'iso-8', 'not_assessed', 'system'),
('system', 'iso27001', 'iso-10', 'partial', 'system')
ON CONFLICT (tenant_id, framework, control_id) DO UPDATE SET status = EXCLUDED.status, updated_at = NOW();
"
