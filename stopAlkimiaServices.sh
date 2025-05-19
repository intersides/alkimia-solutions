#!/bin/sh

# Function to display usage
usage() {
  echo "Usage: $0 [-rm]"
  echo "  -rm    Remove containers after stopping them"
  exit 1
}

# Check if the -rm flag is passed
REMOVE_CONTAINERS=false
if [ "$1" = "-rm" ]; then
  REMOVE_CONTAINERS=true
elif [ ! -z "$1" ]; then
  usage
fi

# Stop containers
docker stop alkimia-backend
docker stop alkimia-frontend
docker stop alkimia-load-balancer
docker stop mqtt-alkimia-broker
docker stop mongodb-alkimia-storage

# Remove containers if -rm flag is passed
if [ "$REMOVE_CONTAINERS" = true ]; then
  docker rm alkimia-backend
  docker rm alkimia-frontend
  docker rm alkimia-load-balancer
  docker rm mqtt-alkimia-broker
  docker rm mongodb-alkimia-storage
fi

# Docker system prune command (commented out by default)
#docker system prune -a --force
