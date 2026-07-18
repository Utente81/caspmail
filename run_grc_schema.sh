export PGPASSWORD=casper_db_password
psql -U postgres -d caspermail -f /tmp/grc_schema.sql
psql -U postgres -d caspermail -c "ALTER TABLE ropa_records OWNER TO caspermail;"
psql -U postgres -d caspermail -c "ALTER TABLE dsr_requests OWNER TO caspermail;"
psql -U postgres -d caspermail -c "ALTER TABLE vulnerabilities OWNER TO caspermail;"
psql -U postgres -d caspermail -c "ALTER TABLE assets OWNER TO caspermail;"
psql -U postgres -d caspermail -c "ALTER TABLE security_policies OWNER TO caspermail;"
psql -U postgres -d caspermail -c "ALTER TABLE policy_acknowledgments OWNER TO caspermail;"
