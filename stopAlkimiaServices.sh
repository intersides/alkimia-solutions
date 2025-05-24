#!/bin/sh

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

# List of service names
services="alkimia-backend alkimia-frontend alkimia-load-balancer mqtt-alkimia-broker mongodb-alkimia-storage"


# Stop containers
for service in $services; do
  if docker container inspect "$service" >/dev/null 2>&1; then
    echo "Stopping container: $service"
    docker stop "$service"
  else
    echo "Container not found: $service"
  fi
done

# Remove containers
if [ "$REMOVE_CONTAINERS" = true ]; then
  for service in $services; do
    if docker container inspect "$service" >/dev/null 2>&1; then
      echo "Removing container: $service"
      docker rm -f "$service"
    else
      echo "Container not found (skip removal): $service"
    fi
  done
fi

# Remove images (assumes container name == image name)
if [ "$REMOVE_IMAGES" = true ]; then
  for service in $services; do
    if docker image inspect "$service" >/dev/null 2>&1; then
      echo "Removing image: $service"
      docker rmi -f "$service"
    else
      echo "Image not found: $service"
    fi
  done
fi
