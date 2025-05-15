#!/bin/sh

./stopAndClean.sh

ENV=development pm2 start ecosystem.config.cjs --no-daemon
