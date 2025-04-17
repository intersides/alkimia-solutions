# Stage 1: Dependency Installation
FROM node:23-bullseye AS dependencies

WORKDIR /app

#Copy the root workspace config
COPY package.json package-lock.json ./

# Copy workspace-specific package.json files for all services and libraries
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/
COPY libs/common/package.json ./libs/common/
COPY libs/browser/package.json ./libs/browser/
COPY libs/node/package.json ./libs/node/

# Install all dependencies, resolving via npm workspaces
RUN npm install

# Copy the entire source code of the monorepo into the image
COPY . .

# Stage 2: Build the target service (backend or frontend)
FROM node:23-bullseye AS builder
ARG SERVICE

WORKDIR /app

# Copy dependencies from the previous stage
COPY --from=dependencies /app /app

## Use the SERVICE argument to build either frontend or backend
#RUN npm run build --workspace=apps/${SERVICE}
# Conditionally execute npm run build for frontend
RUN if [ "$SERVICE" = "frontend" ]; then \
      npm run build --workspace=apps/frontend; \
    else \
      echo "Skipping build for non-frontend services"; \
    fi


# Stage 3: Lightweight production image
FROM node:23-alpine AS runner
ARG SERVICE
ARG ENV

WORKDIR /app

# Copy only the necessary files for the target service
COPY --from=builder /app/apps/${SERVICE} .

COPY --from=builder /app/apps/${SERVICE}/package.json ./package.json
COPY --from=builder /app/libs/common ./libs/common
COPY --from=builder /app/libs/browser ./libs/browser
COPY --from=builder /app/libs/node ./libs/node
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000
CMD ["sh", "-c", "npm run \"$ENV\""]
