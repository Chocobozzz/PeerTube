#!/bin/bash

NODE_ENV=test NODE_APP_INSTANCE=1 node server.js &
sleep 1
NODE_ENV=test NODE_APP_INSTANCE=2 node server.js &
sleep 1
NODE_ENV=test NODE_APP_INSTANCE=3 node server.js &
