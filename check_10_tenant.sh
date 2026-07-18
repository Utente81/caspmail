#!/bin/bash
kubectl exec -n caspermail casper-pg-postgresql-primary-0 -- sh -c 'PGPASSWORD=$(cat /opt/bitnami/postgresql/secrets/password) psql -U caspermail -d caspermail -c "SELECT DISTINCT tenant_id FROM soc_events WHERE source_ip='\''10.42.0.1'\'';"'
