export PGPASSWORD=casper_db_password
psql -U postgres -d caspermail -c "\du"
psql -U postgres -d caspermail -c "\d"
