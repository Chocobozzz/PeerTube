#!/bin/sh

set -eu

# Backup database
SQL_BACKUP_PATH="/var/www/peertube/backup/sql-peertube_prod-$(date +\"%Y%m%d-%H%M\").bak" 
mkdir -p /var/www/peertube/backup
pg_dump -U peertube -W -h localhost -F c peertube_prod -f "$SQL_BACKUP_PATH" 

# Get and Display the Latest Version
VERSION=$(curl -s https://api.github.com/repos/chocobozzz/peertube/releases/latest | grep tag_name | cut -d '"' -f 4)
echo "Latest Peertube version is $VERSION"
wget -q "https://github.com/Chocobozzz/PeerTube/releases/download/${VERSION}/peertube-${VERSION}.zip" -O "/var/www/peertube/versions/peertube-${VERSION}.zip"
cd /var/www/peertube/versions
unzip -o "peertube-${VERSION}.zip"
rm -f "peertube-${VERSION}.zip"

# Upgrade Scripts
rm -rf /var/www/peertube/peertube-latest
ln -s "/var/www/peertube/versions/peertube-${VERSION}" /var/www/peertube/peertube-latest
cd /var/www/peertube/peertube-latest
yarn install --production --pure-lockfile 
cp /var/www/peertube/peertube-latest/config/default.yaml /var/www/peertube/config/default.yaml

echo "Differences in configuration files..."
diff "/var/www/peertube/versions/peertube-${VERSION}/config/production.yaml.example" /var/www/peertube/config/production.yaml

