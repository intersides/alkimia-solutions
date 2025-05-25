#!/bin/sh

pm2 delete all

docker stop $(docker ps -a -q)
#docker rm $(docker ps -a -q)

#docker system prune -a --force
