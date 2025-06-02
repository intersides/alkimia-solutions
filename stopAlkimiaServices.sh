#!/bin/sh
# shellcheck disable=SC2086

# Function to display usage
usage() {
  echo "Usage: $0 [-rm | -rmf]"
  echo "  -rm     Remove containers after stopping them"
  echo "  -rmf    Remove containers and their images (full cleanup)"
  exit 1
}

# Parse argument
REMOVE_CONTAINERS=false
REMOVE_IMAGES=false
if [ "$1" = "-rm" ]; then
  REMOVE_CONTAINERS=true
elif [ "$1" = "-rmf" ]; then
  REMOVE_CONTAINERS=true
  REMOVE_IMAGES=true
elif [ ! -z "$1" ]; then
  usage
fi

services=$(docker ps -a -q --filter "label=service.namespace=alkimia-workspace")

# Stop containers
if [ -n "$services" ]; then

  docker stop $services
fi

# Remove containers
if [ "$REMOVE_CONTAINERS" = true ] && [ -n "$services" ]; then
  docker rm -f $services
fi

# Remove images (based on containers' image names)
if [ "$REMOVE_IMAGES" = true ] && [ -n "$services" ]; then
  images=$(docker inspect -f '{{.Config.Image}}' $services | sort -u)
  if [ -n "$images" ]; then
    docker rmi -f $images
  fi
fi
