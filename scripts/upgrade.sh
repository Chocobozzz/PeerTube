#!/bin/bash

nodeMinVersion="v6.0.0"
npmMinVersion="3.0.0"

if [[ $(node --version) < $nodeMinVersion ]]; then
  echo 'You need node >= 6'
  exit 0
fi

if [[ $(npm --version) < $npmMinVersion ]]; then
  echo 'You need npm >= 3'
  exit 0
fi

if ! which yarn > /dev/null; then
  echo 'You need yarn'
  exit 0
fi

if pgrep peertube > /dev/null; then
  echo 'PeerTube is running!'
  exit 0
fi

git pull origin $(git rev-parse --abbrev-ref HEAD) || exit -1

yarn install
yarn upgrade
cd client && yarn upgrade && cd ../
npm run build

echo "\n\nUpgrade finished! You can restart PeerTube that may run the migration scripts."
