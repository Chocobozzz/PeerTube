# Developer Database

## Mac Install PostgreSQL

```
brew install postgresql

# first run this command to make sure there is no issues with a postgres data dir etc
pg_ctl -D /usr/local/var/postgres start

# then start the service if all checks out
brew services start postgresql
```

### Setup development database

```
# password is peertube
sudo -u $USER createuser -P peertube

sudo -u $USER createdb -O peertube peertube_dev

sudo -u $USER psql -c "CREATE EXTENSION pg_trgm;" peertube_dev
sudo -u $USER psql -c "CREATE EXTENSION unaccent;" peertube_dev
```