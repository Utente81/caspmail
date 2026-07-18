export PGPASSWORD=casper_db_password
psql -U postgres -d caspermail -c "SELECT email, tenant_id FROM users;"
psql -U postgres -d caspermail -c "SELECT id, name FROM tenants;"
