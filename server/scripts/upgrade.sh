#!/bin/sh

set -eu

PEERTUBE_PATH=${1:-/var/www/peertube}

# Fingerprint: 0336 DF98 1C56 F778 51CC  4FB7 3BEF 14A3 B157 4BA7
RELEASE_KEY_FINGERPRINT="0336DF981C56F77851CC4FB73BEF14A3B1574BA7"
RELEASE_PUBLIC_KEY_BASE64="
mDMEawBUvxYJKwYBBAHaRw8BAQdAglsnEi2i6DweKVGkzdjbYdk4Wgro4dmry2M8BkAF52K0M1Bl
ZXJUdWJlIHJlbGVhc2VzIDxwZWVydHViZS1zZWN1cml0eUBmcmFtYXNvZnQub3JnPoiQBBMWCgA4
FiEEAzbfmBxW93hRzE+3O+8Uo7FXS6cFAmsAVL8CGwEFCwkIBwIGFQoJCAsCBBYCAwECHgECF4AA
CgkQO+8Uo7FXS6dwFAEAvB5Tm8X4vMXQLLkCGdEo9G8gkuw0bNUTteY+kBTF/R4A/i+Xn1Rp9DKh
8pCuNyPIN6n78Ivl3OKm6SJalcBHp4cEuDMEawBXoRYJKwYBBAHaRw8BAQdAtzXgToimzzYbANCR
OcD8NqyR8TaS2WsQivpQoswiK6mI7wQYFgoAIBYhBAM235gcVvd4UcxPtzvvFKOxV0unBQJrAFeh
AhsCAIEJEDvvFKOxV0undiAEGRYKAB0WIQRlvV2i70NHZA44i5Mk6sflehbWVgUCawBXoQAKCRAk
6sflehbWVnkKAP98AENEdVgNRHiasjXJPWMKhEPjLg4Tdm9jbKdz4eF3DgEAr0r9JjkGQA+9Dgqe
k+o+3eH/d2qivzn6IUoY6mVWFgklqAD+I+pLooiGadg7g10sbdHUTeTfD/F5OIzpRDEjEY9Ly0cB
AO7GMpwbyAJqosIjCj2sYsHHAK0wtMXhSUeoBKW9PQQD
"

# PEERTUBE_UPGRADE_SIGNATURE_CHECK:
#   * warn (default): check the release signature, but only display a warning if the check fails
#   * require: refuse to install a release that is not signed by the PeerTube release key (future default)
#   * skip: do not check the release signature
SIGNATURE_CHECK_MODE="${PEERTUBE_UPGRADE_SIGNATURE_CHECK:-warn}"

case "$SIGNATURE_CHECK_MODE" in
  warn|require|skip) ;;
  *)
    echo "Error - invalid PEERTUBE_UPGRADE_SIGNATURE_CHECK value \"$SIGNATURE_CHECK_MODE\" (expected warn, require or skip)"
    exit 1
    ;;
esac

signature_check_failed() {
  message="$1"
  file_path="$2"
  signature_path="$3"

  if [ "$SIGNATURE_CHECK_MODE" = "require" ]; then
    echo "Error - $message"
    echo ""
    echo "Do not install it. Retry later, or check the release on https://github.com/Chocobozzz/PeerTube/releases"
    rm -f "$file_path" "$signature_path"
    exit 1
  fi

  echo "Warning - $message"
  echo "Continuing anyway. Set PEERTUBE_UPGRADE_SIGNATURE_CHECK=require to refuse unsigned releases"
}

cleanup_gpg_tmp_dir() {
  if [ -n "${gpg_tmp_dir:-}" ]; then
    rm -rf "$gpg_tmp_dir"
    gpg_tmp_dir=""
  fi

  trap - EXIT INT TERM
}

verify_release_signature() {
  file_path="$1"
  signature_path="$2"

  if [ "$SIGNATURE_CHECK_MODE" = "skip" ]; then
    echo "Warning - skipping the signature check of the release (PEERTUBE_UPGRADE_SIGNATURE_CHECK=skip)"
    return 0
  fi

  if [ ! -s "$signature_path" ]; then
    signature_check_failed "cannot download the signature of the release" "$file_path" "$signature_path"
    return 0
  fi

  if [ ! -x "$(command -v gpgv)" ]; then
    signature_check_failed "gpgv not found: cannot check the signature of the release (install the gpgv package, or gnupg)" "$file_path" "$signature_path"
    return 0
  fi

  # Remove the temporary directory even if the script is interrupted
  trap cleanup_gpg_tmp_dir EXIT
  trap 'exit 1' INT TERM

  if ! gpg_tmp_dir=$(mktemp -d); then
    cleanup_gpg_tmp_dir
    signature_check_failed "cannot create a temporary directory to check the signature of the release" "$file_path" "$signature_path"
    return 0
  fi

  keyring_path="$gpg_tmp_dir/peertube-release.gpg"
  gpg_log_path="$gpg_tmp_dir/gpg.log"

  if ! echo "$RELEASE_PUBLIC_KEY_BASE64" | base64 -d > "$keyring_path" 2>/dev/null || [ ! -s "$keyring_path" ]; then
    cleanup_gpg_tmp_dir
    signature_check_failed "cannot decode the PeerTube release key: is the base64 command available?" "$file_path" "$signature_path"
    return 0
  fi

  if gpgv --homedir "$gpg_tmp_dir" --keyring "$keyring_path" "$signature_path" "$file_path" > "$gpg_log_path" 2>&1; then
    cleanup_gpg_tmp_dir
    echo "Release signature verified"
    return 0
  fi

  echo "Output of gpgv:"
  sed 's/^/    /' "$gpg_log_path"
  cleanup_gpg_tmp_dir

  signature_check_failed "the release signature is invalid or was not made by the PeerTube release key ($RELEASE_KEY_FINGERPRINT)" "$file_path" "$signature_path"
}

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
    REMAINING=$(df -k "$PEERTUBE_PATH" | awk '{ print $4}' | sed -n 2p)
    THREE_GB=$((3 * 1024 * 1024))

    if [ "$REMAINING" -lt "$THREE_GB" ]; then
      echo "Error - not enough free space for upgrading"
      echo ""
      echo "Make sure you have at least 3 GB of free space in $PEERTUBE_PATH"
      exit 1
    fi
fi

# Backup database
if [ -x "$(command -v pg_dump)" ]; then
  mkdir -p "$PEERTUBE_PATH/backup"
  chmod 700 "$PEERTUBE_PATH/backup"

  SQL_BACKUP_PATH="$PEERTUBE_PATH/backup/sql-peertube_prod-$(date +"%Y%m%d-%H%M").bak"

  echo "Backing up PostgreSQL database in $SQL_BACKUP_PATH"

  # One value per line: read them separately so empty values don't shift the others
  {
    IFS= read -r DB_HOST
    IFS= read -r DB_SUFFIX
    IFS= read -r DB_NAME
    IFS= read -r DB_USER
    IFS= read -r DB_PASS
    IFS= read -r DB_PORT
  } <<EOF
$(node -e "
    const config = require('js-yaml').load(require('fs').readFileSync(process.argv[1], 'utf8'))['database'];
    console.log([
      config.hostname || '',
      config.suffix || '',
      config.name || '',
      config.username || '',
      config.password || '',
      config.port || 5432
    ].join('\n'));
  " -- "$PEERTUBE_PATH/config/production.yaml")
EOF

  pg_dump_cmd() {
    (
      umask 077
      pg_dump -F c "${DB_NAME:-peertube${DB_SUFFIX}}" -f "$SQL_BACKUP_PATH" "$@"
    )
  }

  # Empty hostname means that we should connect using default postgres socket using peer auth
  # For non-empty host we are using network connection with credentials
  if [ -z "$DB_HOST" ]; then
    pg_dump_cmd
  else
    PGPASSWORD="$DB_PASS" pg_dump_cmd -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT"
  fi

  echo "Backup complete"
else
  echo "pg_dump not found. Cannot make a SQL backup!"
fi

# If there is a pre-release, give the user a choice which one to install.
RELEASE_VERSION=$(curl -s https://api.github.com/repos/chocobozzz/peertube/releases/latest | grep tag_name | cut -d '"' -f 4)
PRE_RELEASE_VERSION=$(curl -s https://api.github.com/repos/chocobozzz/peertube/releases | grep tag_name | head -1 | cut -d '"' -f 4)

if [ "$RELEASE_VERSION" != "$PRE_RELEASE_VERSION" ]; then
  printf "Which version do you want to install?\n[1] %s (stable) \n[2] %s (pre-release)\n" "$RELEASE_VERSION" "$PRE_RELEASE_VERSION"
  read choice
  case $choice in
      [1]* ) VERSION="$RELEASE_VERSION";;
      [2]* ) VERSION="$PRE_RELEASE_VERSION";;
      * ) exit;
  esac
else
  VERSION="$RELEASE_VERSION"
fi

if [ -z "$VERSION" ]; then
  echo "Error - could not determine the version to install"
  echo ""
  echo "This usually means the GitHub API call failed (rate limit, network issue,"
  echo "or unexpected response). Please retry in a few minutes."
  exit 1
fi

echo "Installing Peertube version $VERSION"

ZIP_PATH="$PEERTUBE_PATH/versions/peertube-${VERSION}.zip"
RELEASE_DOWNLOAD_URL="https://github.com/Chocobozzz/PeerTube/releases/download/${VERSION}/peertube-${VERSION}.zip"

wget -q "$RELEASE_DOWNLOAD_URL" -O "$ZIP_PATH"
# Do not stop the script if the signature is missing: verify_release_signature handles it
wget -q "$RELEASE_DOWNLOAD_URL.asc" -O "$ZIP_PATH.asc" || true

verify_release_signature "$ZIP_PATH" "$ZIP_PATH.asc"
rm -f "$ZIP_PATH.asc"

cd "$PEERTUBE_PATH/versions"
unzip -o "peertube-${VERSION}.zip"
rm -f "peertube-${VERSION}.zip"

RELEASE_PAGE_URL="https://github.com/Chocobozzz/PeerTube/releases/tag/${VERSION}"
LATEST_VERSION_DIRECTORY="$PEERTUBE_PATH/versions/peertube-${VERSION}"
cd "$LATEST_VERSION_DIRECTORY"

npm run install-node-dependencies -- --production

OLD_VERSION_DIRECTORY=$(readlink "$PEERTUBE_PATH/peertube-latest")


rm -f "$PEERTUBE_PATH/peertube-latest"
ln -s "$LATEST_VERSION_DIRECTORY" "$PEERTUBE_PATH/peertube-latest"

RESOLVED_TARGET=$(cd -P "$PEERTUBE_PATH/peertube-latest" 2>/dev/null && pwd) || RESOLVED_TARGET=""
EXPECTED_TARGET=$(cd -P "$LATEST_VERSION_DIRECTORY" 2>/dev/null && pwd) || {
  echo "Error - could not resolve $LATEST_VERSION_DIRECTORY"
  exit 1
}

if [ -z "$RESOLVED_TARGET" ] || [ "$RESOLVED_TARGET" != "$EXPECTED_TARGET" ]; then
  echo "Error - peertube-latest symlink is broken after update"
  echo "  Expected : $EXPECTED_TARGET"
  echo "  Resolved : ${RESOLVED_TARGET:-<unresolvable>}"
  exit 1
fi

cp "$PEERTUBE_PATH/peertube-latest/config/default.yaml" "$PEERTUBE_PATH/config/default.yaml"

echo ""
echo "=========================================================="
echo ""

if [ -x "$(command -v git)" ]; then
  cd "$PEERTUBE_PATH"

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
