#!/bin/bash

cd client || exit -1

npm run webpack-bundle-analyzer ./dist/stats.json
