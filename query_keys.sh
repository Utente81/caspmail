export PGPASSWORD=casper_db_password
psql -U postgres -d caspermail -c "SELECT user_email FROM e2ee_keys;"
