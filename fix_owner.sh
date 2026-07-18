export PGPASSWORD=casper_db_password
psql -U postgres -d caspermail -c "ALTER TABLE phishing_campaigns OWNER TO caspermail;"
psql -U postgres -d caspermail -c "ALTER TABLE phishing_targets OWNER TO caspermail;"
