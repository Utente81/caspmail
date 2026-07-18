export PGPASSWORD=casper_db_password
psql -U postgres -d caspermail -c "GRANT ALL PRIVILEGES ON TABLE phishing_campaigns TO casper_backend;"
psql -U postgres -d caspermail -c "GRANT ALL PRIVILEGES ON TABLE phishing_targets TO casper_backend;"
psql -U postgres -d caspermail -c "GRANT USAGE, SELECT ON SEQUENCE phishing_campaigns_id_seq TO casper_backend;"
psql -U postgres -d caspermail -c "GRANT USAGE, SELECT ON SEQUENCE phishing_targets_id_seq TO casper_backend;"
