#!/bin/sh

set -eu

PEERTUBE_PATH=/var/www/peertube/

# Backup database
SQL_BACKUP_PATH="$PEERTUBE_PATH/backup/sql-peertube_prod-$(date +"%Y%m%d-%H%M").bak" 
mkdir -p $PEERTUBE_PATH/backup
pg_dump -U peertube -W -h localhost -F c peertube_prod -f "$SQL_BACKUP_PATH" 

# Get and Display the Latest Version
VERSION=$(curl -s https://api.github.com/repos/chocobozzz/peertube/releases/latest | grep tag_name | cut -d '"' -f 4)
echo "Latest Peertube version is $VERSION"
wget -q "https://github.com/Chocobozzz/PeerTube/releases/download/${VERSION}/peertube-${VERSION}.zip" -O "$PEERTUBE_PATH/versions/peertube-${VERSION}.zip"
cd $PEERTUBE_PATH/versions
unzip -o "peertube-${VERSION}.zip"
rm -f "peertube-${VERSION}.zip"

# Upgrade Scripts
rm -rf $PEERTUBE_PATH/peertube-latest
ln -s "$PEERTUBE_PATH/versions/peertube-${VERSION}" $PEERTUBE_PATH/peertube-latest
cd $PEERTUBE_PATH/peertube-latest
yarn install --production --pure-lockfile 
cp $PEERTUBE_PATH/peertube-latest/config/default.yaml $PEERTUBE_PATH/config/default.yaml

echo "Differences in configuration files..."
diff "$PEERTUBE_PATH/versions/peertube-${VERSION}/config/production.yaml.example" $PEERTUBE_PATH/config/production.yaml

