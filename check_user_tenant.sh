#!/bin/bash
kubectl exec -n caspermail casper-pg-postgresql-primary-0 -- sh -c 'PGPASSWORD=$(cat /opt/bitnami/postgresql/secrets/password) psql -U caspermail -d caspermail -c "SELECT email, tenant_id FROM users WHERE email='\''admin@caspmail.com'\'' OR email='\''superadmin@caspmail.com'\'';"'
