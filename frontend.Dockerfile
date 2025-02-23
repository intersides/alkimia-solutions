FROM node:23-slim
WORKDIR /app

# Install system dependencies for npm rebuild
RUN apt-get update && apt-get install -y python3 make g++

# Copy package.json and install dependencies
COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps

# Force rebuild of Rollup
RUN npm rebuild rollup

# Copy the rest of the project files
COPY . .

# Ensure node_modules/.bin is in PATH
ENV PATH="/app/node_modules/.bin:$PATH"

EXPOSE 3000
CMD ["npm", "run", "dev"]
