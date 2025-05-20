#!/bin/sh

pm2 delete all

ENV=development pm2 start ecosystem.config.cjs --no-daemon
