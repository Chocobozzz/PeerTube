#!/bin/sh

set -eu

PEERTUBE_PATH=${1:-/var/www/peertube}

if [ ! -e "$PEERTUBE_PATH" ]; then
  echo "Error - path \"$PEERTUBE_PATH\" wasn't found"
  echo ""
  echo "If peertube was installed in another path, you can specify it with"
  echo "    ./upgrade.sh <PATH>"
  exit 1
fi

if [ ! -e "$PEERTUBE_PATH/versions" -o ! -e "$PEERTUBE_PATH/config/production.yaml" ]; then
  echo "Error - Couldn't find peertube installation in \"$PEERTUBE_PATH\""
  echo ""
  echo "If peertube was installed in another path, you can specify it with"
  echo "    ./upgrade.sh <PATH>"
  exit 1
fi

if [ -x "$(command -v awk)" ] && [ -x "$(command -v sed)" ]; then
    REMAINING=$(df -k $PEERTUBE_PATH | awk '{ print $4}' | sed -n 2p)
    ONE_GB=$((1024 * 1024))

    if [ "$REMAINING" -lt "$ONE_GB" ]; then
      echo "Error - not enough free space for upgrading"
      echo ""
      echo "Make sure you have at least 1 GB of free space in $PEERTUBE_PATH"
      exit 1
    fi
fi

# Backup database
if [ -x "$(command -v pg_dump)" ]; then
  mkdir -p $PEERTUBE_PATH/backup

  SQL_BACKUP_PATH="$PEERTUBE_PATH/backup/sql-peertube_prod-$(date +"%Y%m%d-%H%M").bak"

  echo "Backing up PostgreSQL database in $SQL_BACKUP_PATH"

  DB_USER=$(node -e "console.log(require('js-yaml').load(fs.readFileSync('$PEERTUBE_PATH/config/production.yaml', 'utf8'))['database']['username'])")
  DB_PASS=$(node -e "console.log(require('js-yaml').load(fs.readFileSync('$PEERTUBE_PATH/config/production.yaml', 'utf8'))['database']['password'])")
  DB_HOST=$(node -e "console.log(require('js-yaml').load(fs.readFileSync('$PEERTUBE_PATH/config/production.yaml', 'utf8'))['database']['hostname'])")
  DB_PORT=$(node -e "console.log(require('js-yaml').load(fs.readFileSync('$PEERTUBE_PATH/config/production.yaml', 'utf8'))['database']['port'])")
  DB_SUFFIX=$(node -e "console.log(require('js-yaml').load(fs.readFileSync('$PEERTUBE_PATH/config/production.yaml', 'utf8'))['database']['suffix'])")
  DB_NAME=$(node -e "console.log(require('js-yaml').load(fs.readFileSync('$PEERTUBE_PATH/config/production.yaml', 'utf8'))['database']['name'] || '')")

  PGPASSWORD=$DB_PASS pg_dump -U $DB_USER -p $DB_PORT -h $DB_HOST -F c "${DB_NAME:-peertube${DB_SUFFIX}}" -f "$SQL_BACKUP_PATH"
else
  echo "pg_dump not found. Cannot make a SQL backup!"
fi

# If there is a pre-release, give the user a choice which one to install.
RELEASE_VERSION=$(curl -s https://api.github.com/repos/chocobozzz/peertube/releases/latest | grep tag_name | cut -d '"' -f 4)
PRE_RELEASE_VERSION=$(curl -s https://api.github.com/repos/chocobozzz/peertube/releases | grep tag_name | head -1 | cut -d '"' -f 4)

if [ "$RELEASE_VERSION" != "$PRE_RELEASE_VERSION" ]; then
  echo -e "Which version do you want to install?\n[1] $RELEASE_VERSION (stable) \n[2] $PRE_RELEASE_VERSION (pre-release)"
  read choice
  case $choice in
      [1]* ) VERSION="$RELEASE_VERSION";;
      [2]* ) VERSION="$PRE_RELEASE_VERSION";;
      * ) exit;
  esac
else
  VERSION="$RELEASE_VERSION"
fi

echo "Installing Peertube version $VERSION"
wget -q "https://github.com/Chocobozzz/PeerTube/releases/download/${VERSION}/peertube-${VERSION}.zip" -O "$PEERTUBE_PATH/versions/peertube-${VERSION}.zip"
cd $PEERTUBE_PATH/versions
unzip -o "peertube-${VERSION}.zip"
rm -f "peertube-${VERSION}.zip"

RELEASE_PAGE_URL="https://github.com/Chocobozzz/PeerTube/releases/tag/${VERSION}"
LATEST_VERSION_DIRECTORY="$PEERTUBE_PATH/versions/peertube-${VERSION}"
cd "$LATEST_VERSION_DIRECTORY"

NOCLIENT=1 npm run install-node-dependencies -- --production

OLD_VERSION_DIRECTORY=$(readlink "$PEERTUBE_PATH/peertube-latest")

# Switch to latest code version
rm -rf $PEERTUBE_PATH/peertube-latest
ln -s "$LATEST_VERSION_DIRECTORY" $PEERTUBE_PATH/peertube-latest
cp $PEERTUBE_PATH/peertube-latest/config/default.yaml $PEERTUBE_PATH/config/default.yaml

echo ""
echo "=========================================================="
echo ""

if [ -x "$(command -v git)" ]; then
  cd $PEERTUBE_PATH

  git merge-file -p config/production.yaml "$OLD_VERSION_DIRECTORY/config/production.yaml.example" "peertube-latest/config/production.yaml.example" | tee "config/production.yaml.new" > /dev/null
  echo "$PEERTUBE_PATH/config/production.yaml.new generated"
  echo "You can review it and replace your existing production.yaml configuration"
else
  echo "git command not found: unable to generate config/production.yaml.new configuration file based on your existing production.yaml configuration"
fi

echo ""
echo "=========================================================="
echo ""
echo "Please read the IMPORTANT NOTES on $RELEASE_PAGE_URL"
echo ""
echo "Then restart PeerTube!"
