#!/bin/bash
kubectl exec -n caspermail casper-pg-postgresql-primary-0 -- sh -c 'PGPASSWORD=$(cat /opt/bitnami/postgresql/secrets/password) psql -U caspermail -d caspermail -c "SELECT count(*) FROM soc_events WHERE source_ip='\''31.1.1.1'\'';"'
