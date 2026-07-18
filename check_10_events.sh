#!/bin/bash
kubectl exec -n caspermail casper-pg-postgresql-primary-0 -- sh -c 'PGPASSWORD=$(cat /opt/bitnami/postgresql/secrets/password) psql -U caspermail -d caspermail -c "SELECT source_ip, type, message FROM soc_events WHERE source_ip='\''10.42.0.1'\'' ORDER BY created_at DESC LIMIT 10;"'
