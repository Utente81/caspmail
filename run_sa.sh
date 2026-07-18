#!/bin/bash
kubectl cp /home/ubuntu/caspmail/new/sa_attack.sql caspermail/casper-pg-postgresql-primary-0:/tmp/sa_attack.sql
kubectl exec -n caspermail casper-pg-postgresql-primary-0 -- sh -c 'PGPASSWORD=$(cat /opt/bitnami/postgresql/secrets/password) psql -U caspermail -d caspermail -f /tmp/sa_attack.sql'
