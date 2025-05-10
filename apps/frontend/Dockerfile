# Use the base image that contains all libraries and dependencies
FROM intersides-workspace-base AS base

# Single Alpine stage for build and runtime
FROM node:23-alpine

WORKDIR /app

# Copy only what's needed from the base image
COPY --from=base /repo/package.json /repo/package-lock.json ./
COPY --from=base /repo/node_modules ./node_modules
COPY --from=base /repo/libs/common ./libs/common
COPY --from=base /repo/libs/browser ./libs/browser
COPY --from=base /repo/libs/node ./libs/node

# Copy backend app to root of /app
COPY apps/frontend .

# Ensure workspace links are correct (if needed)
RUN npm install

#if production...
#RUN npm run development

RUN echo "mode: $ENV"

EXPOSE 3000

# Run the frontend
CMD ["sh", "-c", "npm run development"]
