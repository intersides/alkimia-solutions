# Intersides Workspace - README Update

This document contains the updated README.md content for the Intersides Workspace project, based on the analysis of the project structure and code.

## Updated README.md Content

```markdown
# Intersides Workspace

A monorepo workspace for Intersides applications, built around the Alkimia framework. This workspace contains both frontend and backend services with a custom Node.js-based proxy for local development and production deployment, featuring intelligent lazy loading of Docker containers.

## Project Overview

Intersides Workspace is a comprehensive development environment that:

- Provides a unified development experience for frontend and backend applications
- Implements a custom HTTPS proxy with automatic container management
- Supports both development and production environments
- Uses a modular architecture with shared libraries
- Integrates with the Alkimia framework for frontend development

## Project Structure

```
intersides-workspace/
├── apps/
│   ├── backend/       # Node.js backend application
│   └── frontend/      # Frontend application using Alkimia framework
├── libs/
│   ├── common/        # Shared code between frontend and backend
│   ├── browser/       # Browser-specific libraries
│   └── node/          # Node.js-specific libraries
├── certs/             # SSL certificates for local development
│   ├── fullchain.pem  # Combined certificate with CA
│   └── key.pem        # Private key
├── services/          # Additional service definitions
├── stress-agent/      # Performance testing tools
├── tests/             # Test suite
├── DockerService.js   # Docker container management service for lazy loading
├── proxy.js           # Custom Node.js HTTPS proxy with lazy container startup
├── ecosystem.config.cjs # PM2 process manager configuration
├── Dockerfile.base    # Base Docker image configuration
└── .env               # Environment configuration
```

## Key Features

### Custom Node.js Proxy

The project includes a sophisticated Node.js proxy (`proxy.js`) that:

1. Handles HTTPS connections on port 443
2. Routes requests based on hostname to the appropriate service
3. Uses SSL certificates for secure local development
4. Implements lazy loading of Docker containers - starting services only when they're requested
5. Provides a lightweight alternative to traditional reverse proxies

### Docker Integration

The `DockerService.js` module provides:

1. On-demand container management
2. Automatic building and starting of containers when services are requested
3. Container health monitoring
4. Environment-specific configuration

### Modular Architecture

The workspace uses a modular architecture with:

1. Shared libraries in the `libs/` directory
2. Separate frontend and backend applications
3. Common utilities and components
4. Workspace-level package management

## Environment Setup

The project uses Docker and Docker Compose for both development and production environments, with a custom Node.js proxy for routing. Configuration is managed through environment variables in the `.env` file.

### Prerequisites

- Docker and Docker Compose
- Node.js (for local development)
- mkcert (for generating local SSL certificates)

## Development Environment

### Setting up mkcert on macOS

1. Install mkcert using Homebrew:

```bash
brew install mkcert
```

2. Initialize mkcert:

```bash
mkcert -install
```

3. Generate certificates for local development:

```bash
mkdir -p certs
cd certs
mkcert "*.alkimia.localhost" alkimia.localhost localhost 127.0.0.1 ::1
```

4. Create a fullchain.pem file by combining the certificate with the CA certificate:

```bash
# Find the location of the CA certificate
mkcert -CAROOT
# Copy the certificate and create fullchain.pem
cat "*.alkimia.localhost+4.pem" "$(mkcert -CAROOT)/rootCA.pem" > fullchain.pem
# Copy the key file
cp "*.alkimia.localhost+4-key.pem" key.pem
```

### Local Hosts Configuration

Add the following entries to your `/etc/hosts` file:

```
127.0.0.1 app.alkimia.localhost
127.0.0.1 server.alkimia.localhost
```

### Starting the Development Environment

You can start the environment using the custom Node.js proxy with lazy loading:

```bash
# Start the HTTPS proxy with lazy container loading
npm run proxy-development
```

The proxy will automatically start Docker containers on-demand when requests are received, eliminating the need to manually start containers beforehand.

In development mode, the services are available at:
- Frontend: https://app.alkimia.localhost
- Backend: https://server.alkimia.localhost

## Production Deployment

For production deployment:

```bash
# Start the production proxy
npm run proxy-production
```

In production mode:
- SSL certificates should be properly configured
- Environment variables from .env are used for configuration
- PM2 process manager ensures service reliability

## Environment Variables

Key environment variables in the `.env` file:

```
ENV=production|development
PROTOCOL=https
DOMAIN=alkimia.localhost
LOCAL_IP=0.0.0.0
DOCKER_FILE_PORT=3000
FRONTEND_SUBDOMAIN=app
FRONTEND_PORT=3000
BACKEND_SUBDOMAIN=server
BACKEND_PORT=7070
```

## Development Workflow

1. Start the development environment with `npm run proxy-development`
2. Make changes to the code in the `apps` or `libs` directories
3. The changes will be automatically reflected due to volume mounts
4. Access the applications at their respective URLs

## Troubleshooting

### Certificate Issues

If you encounter certificate issues in development:

1. Ensure mkcert is properly installed and initialized
2. Verify that the certificates are correctly generated in the `certs` directory
3. Check that the fullchain.pem includes both the certificate and CA certificate
4. Restart the proxy service

### Proxy Issues

If you encounter issues with the Node.js proxy:

1. Check the console output for any error messages
2. Verify that the SSL certificates are correctly referenced in the proxy code
3. Ensure Docker is running and accessible
4. Check that the required ports are available
```
