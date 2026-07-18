#!/bin/bash
kubectl exec -n caspermail casper-pg-postgresql-primary-0 -- env PGPASSWORD=casper_db_password psql -U postgres -d caspermail -c "
INSERT INTO soc_compliance (tenant_id, framework, control_id, status, updated_by) VALUES
('system', 'nis2', 'nis2-1', 'partial', 'system'),
('system', 'nis2', 'nis2-2', 'compliant', 'system'),
('system', 'nis2', 'nis2-3', 'compliant', 'system'),
('system', 'nis2', 'nis2-4', 'partial', 'system'),
('system', 'nis2', 'nis2-5', 'compliant', 'system'),
('system', 'nis2', 'nis2-6', 'partial', 'system'),
('system', 'nis2', 'nis2-7', 'not_assessed', 'system'),
('system', 'nis2', 'nis2-8', 'compliant', 'system'),
('system', 'nis2', 'nis2-9', 'compliant', 'system'),
('system', 'nis2', 'nis2-10', 'compliant', 'system'),
('acme-corp', 'nis2', 'nis2-1', 'partial', 'system'),
('acme-corp', 'nis2', 'nis2-2', 'compliant', 'system'),
('acme-corp', 'nis2', 'nis2-3', 'compliant', 'system'),
('acme-corp', 'nis2', 'nis2-4', 'partial', 'system'),
('acme-corp', 'nis2', 'nis2-5', 'compliant', 'system'),
('acme-corp', 'nis2', 'nis2-6', 'partial', 'system'),
('acme-corp', 'nis2', 'nis2-7', 'not_assessed', 'system'),
('acme-corp', 'nis2', 'nis2-8', 'compliant', 'system'),
('acme-corp', 'nis2', 'nis2-9', 'compliant', 'system'),
('acme-corp', 'nis2', 'nis2-10', 'compliant', 'system')
ON CONFLICT (tenant_id, framework, control_id) DO UPDATE SET status = EXCLUDED.status, updated_at = NOW();
"
