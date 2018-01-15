#!/bin/bash

shutdown() {
  # Get our process group id
  PGID=$(ps -o pgid= $$ | grep -o [0-9]*)

  # Kill it in a new new process group
  setsid kill -- -$PGID
  exit 0
}

trap "shutdown" SIGINT SIGTERM

if [ -z "$1" ]; then
  echo "Need version as argument"
  exit -1
fi

cd ./client || exit -1
npm version --no-git-tag-version --no-commit-hooks $1 || exit -1

cd ../ || exit -1
npm version -f --no-git-tag-version --no-commit-hooks $1 || exit -1

git commit package.json client/package.json -m "Bumped to version $1" || exit -1
git tag -s -a "v$1" -m "v$1"

npm run build || exit -1
#npm test || exit -1

cd ../ || exit -1
rm -f PeerTube/peertube.zip || exit -1
zip -r PeerTube/peertube.zip PeerTube/{CREDITS.md,node_modules,FAQ.md,LICENSE,README.md,client/dist/,client/yarn.lock,client/package.json,config,dist,package.json,scripts,support,tsconfig.json,yarn.lock}
