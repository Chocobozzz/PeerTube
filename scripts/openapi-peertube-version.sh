# Version key/value should be on his own line
PACKAGE_VERSION=$(node -p "require('./package.json').version")

sed -i "s/\(^\s*\)version: .*/\1version: $PACKAGE_VERSION/" support/doc/api/openapi.yaml
