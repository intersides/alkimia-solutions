# Use the base image that contains all libraries and dependencies
FROM intersides-workspace-base AS base

# Single Alpine stage for build and runtime
FROM node:24.0.1-alpine

# Install vim and curl
RUN apk add --no-cache vim curl

ARG ENV

WORKDIR /app

# Copy only what's needed from the base image
COPY --from=base /repo/package.json /repo/package-lock.json ./
COPY --from=base /repo/node_modules ./node_modules
COPY --from=base /repo/libs/common ./libs/common
COPY --from=base /repo/libs/node ./libs/node

# Copy backend app to root of /app
COPY apps/backend .

RUN npm install

RUN echo "mode: $ENV"

EXPOSE 3000

# Health check via HTTP
HEALTHCHECK --interval=5s --timeout=3s --retries=10 CMD curl --fail http://localhost:3000/ping || exit 1

# Use PM2 runtime for both development and production
# The environment will be passed as an argument
CMD ["sh", "-c", "npm run \"$ENV\""]
