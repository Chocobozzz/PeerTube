#!/bin/bash

### Note !! ###
# On shell prompt do :
#
# $ su - peertube
# $ ./upgrade.sh
############

# Stcict mode 
set -e

# Backup database
SQL_BACKUP_PATH="~/backup/sql-peertube_prod-$(date -Im).bak" 
mkdir -p ~/backup
pg_dump -U peertube -W -h localhost -F c peertube_prod -f "$SQL_BACKUP_PATH" 

# Get and Display the Latest Version
VERSION=$(curl -s https://api.github.com/repos/chocobozzz/peertube/releases/latest | grep tag_name | cut -d '"' -f 4)
echo "Latest Peertube version is $VERSION"
wget -q "https://github.com/Chocobozzz/PeerTube/releases/download/${VERSION}/peertube-${VERSION}.zip" -O ~/versions/peertube-${VERSION}.zip 
cd ~/versions
unzip -o peertube-${VERSION}.zip
rm -f peertube-${VERSION}.zip

# Upgrade Scripts
cd ~/versions/peertube-${VERSION}
yarn install --production --pure-lockfile 
cp ~/versions/peertube-${VERSION}/config/default.yaml ~/config/default.yaml
diff ~/versions/peertube-${VERSION}/config/production.yaml.example ~/config/production.yaml 
rm -f ~/peertube-latest
ln -s ~/versions/peertube-${VERSION} ~/peertube-latest 

exit 0
