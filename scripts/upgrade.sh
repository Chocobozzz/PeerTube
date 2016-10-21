#!/usr/bin/env sh


git pull origin $(git rev-parse --abbrev-ref HEAD) || exit -1

if pgrep peertube > /dev/null; then
  echo 'PeerTube is running!'
  exit 0
fi

npm install
npm update
cd client && npm update && cd ../
npm run build

echo "\n\nUpgrade finished! You can restart PeerTube that may run the migration scripts."
