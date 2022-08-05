#!/usr/bin/env bash

# Version key/value should be on his own line
PACKAGE_VERSION=$(node -p "require('./package.json').version")

sed -i "s/\(^\s*\)version: .*/\1version: $PACKAGE_VERSION/" ./support/doc/api/openapi.yaml

# Sets the package version for libs
echo "packageVersion: $PACKAGE_VERSION" >> ./support/openapi/go.yaml
echo "artifactVersion: $PACKAGE_VERSION" >> ./support/openapi/kotlin.yaml
echo "packageVersion: $PACKAGE_VERSION" >> ./support/openapi/python.yaml
