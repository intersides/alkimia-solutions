FROM node:23-bullseye AS base
WORKDIR /stress-agent

# Copy only what's needed to install deps
COPY package*.json ./

# Install all workspace deps
RUN npm install

# Install PM2 globally for better process management
RUN npm install pm2 -g

# Make sure the libraries are properly linked
#RUN npm rebuild
