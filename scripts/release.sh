#!/bin/bash

npm run build
npm test

cd ../ || exit -1
zip -r PeerTube/peertube.zip PeerTube/{CREDITS.md,node_modules,FAQ.md,LICENSE,README.md,client/dist/,client/yarn.lock,client/package.json,config,dist,package.json,scripts,support,tsconfig.json,yarn.lock}
