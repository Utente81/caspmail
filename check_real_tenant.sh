#!/bin/bash
kubectl exec -n caspermail casper-pg-postgresql-primary-0 -- sh -c 'PGPASSWORD=$(cat /opt/bitnami/postgresql/secrets/password) psql -U caspermail -d caspermail -c "SELECT source_ip, tenant_id FROM soc_events WHERE tenant_id='\''1b77410d1a9e48c8851b'\'' ORDER BY created_at DESC LIMIT 5;"'
