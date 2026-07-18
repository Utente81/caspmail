#!/bin/bash
kubectl exec -n caspermail casper-pg-postgresql-primary-0 -- env PGPASSWORD=casper_db_password psql -U postgres -d caspermail -c "SELECT id, email, tenant_id FROM users;"
