#!/bin/bash
while true; do
  kubectl exec -n caspermail casper-pg-postgresql-primary-0 -- sh -c 'PGPASSWORD=$(cat /opt/bitnami/postgresql/secrets/password) psql -U caspermail -d caspermail -c "INSERT INTO soc_events (tenant_id, type, severity, source_ip, message, raw) VALUES ('\''acme-corp'\'', '\''DDoS'\'', '\''critical'\'', '\''31.1.1.1'\'', '\''Detected South American origin DDoS'\'', '\''{\"mitre_tactic\": \"TA0040\", \"mitre_technique\": \"T1498\", \"ueba_score\": 95}'\''); INSERT INTO soc_events (tenant_id, type, severity, source_ip, message, raw) VALUES ('\''acme-corp'\'', '\''SQLi'\'', '\''high'\'', '\''26.1.1.1'\'', '\''Detected SQL Injection from SA'\'', '\''{\"mitre_tactic\": \"TA0040\", \"mitre_technique\": \"T1498\", \"ueba_score\": 85}'\'');"'
  sleep 2
done
