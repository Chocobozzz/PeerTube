#!/bin/bash

npm run build:server || exit -1

npm run travis -- client || exit -1
npm run travis -- api || exit -1
npm run travis -- cli || exit -1
npm run travis -- lint || exit -1
