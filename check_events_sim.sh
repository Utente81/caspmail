#!/bin/bash
kubectl exec -n caspermail casper-pg-postgresql-primary-0 -- sh -c 'PGPASSWORD=$(cat /opt/bitnami/postgresql/secrets/password) psql -U caspermail -d caspermail -c "SELECT source_ip, type, severity, message, raw FROM soc_events WHERE source_ip != '\''26.1.1.1'\'' AND source_ip != '\''31.1.1.1'\'' ORDER BY created_at DESC LIMIT 2;"'
