#!/bin/sh

pm2 delete all

./stopAlkimiaServices.sh -rm

ENV=development pm2 start ecosystem.config.cjs --no-daemon
