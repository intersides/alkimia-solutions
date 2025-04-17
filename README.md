# Intersides Workspace

A monorepo workspace for Intersides applications, containing both frontend and backend services with a custom Node.js-based proxy for local development and production deployment.

## Project Structure

```
intersides-workspace/
├── apps/
│   ├── backend/       # Node.js backend application
│   └── frontend/      # Frontend application
├── libs/
│   ├── common/        # Shared code between frontend and backend
│   ├── browser/       # Browser-specific libraries
│   └── node/          # Node.js-specific libraries
├── traefik/           # Legacy Traefik configuration (being phased out)
│   ├── acme/          # Let's Encrypt certificates for production
│   ├── config/        # Additional Traefik configuration
│   ├── local-certs/   # Local development certificates (still used by Node.js proxy)
│   ├── traefik.dev.yml  # Traefik configuration for development
│   └── traefik.prod.yml # Traefik configuration for production
├── DockerComposeService.js      # Docker container management service for lazy loading
├── proxy.js           # Custom Node.js HTTPS proxy with lazy container startup
├── docker-compose.yml           # Base Docker Compose configuration
├── docker-compose.override.yml  # Development overrides
└── Dockerfile         # Multi-stage Dockerfile for all services
```

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
mkdir -p traefik/local-certs
cd traefik/local-certs
mkcert "*.mydomain.localhost" mydomain.localhost localhost 127.0.0.1 ::1
```

4. Create a fullchain.pem file by combining the certificate with the CA certificate:

```bash
# Find the location of the CA certificate
mkcert -CAROOT
# Copy the certificate and create fullchain.pem
cat "*.mydomain.localhost+4.pem" "$(mkcert -CAROOT)/rootCA.pem" > fullchain.pem
# Copy the key file
cp "*.mydomain.localhost+4-key.pem" key.pem
```

### Local Hosts Configuration

Add the following entries to your `/etc/hosts` file:

```
127.0.0.1 app.alkimia.localhost
127.0.0.1 server.alkimia.localhost
```

### Starting the Development Environment

You can start the environment using Docker Compose or the custom Node.js service:

#### Using Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

#### Using the Custom Node.js Service with Lazy Loading

```bash
# Start the HTTPS proxy with lazy container loading
node proxy.js
```

The proxy will automatically start Docker containers on-demand when requests are received, eliminating the need to manually start containers beforehand.

In development mode, the services are available at:
- Frontend: https://app.alkimia.localhost
- Backend: https://server.alkimia.localhost

## Production Deployment

For production deployment, use the base docker-compose.yml without the override:

```bash
docker-compose -f docker-compose.yml up -d
```

In production mode:
- Let's Encrypt is used for SSL certificates (if using Traefik)
- Volume mounts for live development are disabled
- Environment variables from .env are used for configuration

### Custom Node.js Proxy for Production

For production environments, you can also use the custom Node.js proxy:

```bash
# Start the HTTPS proxy (containers will start automatically when needed)
node proxy.js
```

## Environment Variables

Key environment variables in the `.env` file:

```
ENV=production|development
PROTOCOL=https
DOMAIN=alkimia.localhost
DOCKER_FILE_PORT=3000
FRONTEND_SUBDOMAIN=app
FRONTEND_PORT=3000
BACKEND_SUBDOMAIN=server
BACKEND_PORT=7070
TRAEFIK_LOG_LEVEL=DEBUG|INFO|WARN|ERROR|TRACE
```

## Development Workflow

1. Start the development environment with `docker-compose up -d` or using the Node.js services
2. Make changes to the code in the `apps` or `libs` directories
3. The changes will be automatically reflected due to volume mounts
4. Access the applications at their respective URLs

## Notes on SSL Certificates

- Development certificates are generated using mkcert and are included in the repository for convenience
- These certificates are for development purposes only and should never be used in production
- Production uses Let's Encrypt for automatic certificate generation and renewal

## Custom Node.js Proxy

The project includes a custom Node.js proxy (`proxy.js`) that:

1. Handles HTTPS connections on port 443
2. Routes requests based on hostname to the appropriate service
3. Uses the SSL certificates from the `traefik/local-certs` directory
4. Provides a more lightweight alternative to Traefik for simple routing needs
5. Implements lazy loading of Docker containers - starting services only when they're requested

The proxy uses routing rules to determine where to send requests:

```javascript
const routingRules = [
    {
        // Route based on hostname
        match: (req) => req.headers.host === 'app.alkimia.localhost',
        target: {
            service: "alkimia-frontend",
            name: "frontend",
            host: 'localhost',
            port: 7070 
        }
    },
    {
        // Route based on hostname
        match: (req) => req.headers.host === 'server.alkimia.localhost',
        target: {
            service: "alkimia-backend",
            name: "backend",
            host: 'localhost',
            port: 8080
        }
    }
];
```

When a request is received, the proxy:
1. Determines the target service based on the hostname
2. Checks if the required Docker container is running
3. If not running, builds and starts the container automatically
4. Waits for the container to be ready before forwarding the request
5. Routes the request to the appropriate service

## Troubleshooting

### Certificate Issues

If you encounter certificate issues in development:

1. Ensure mkcert is properly installed and initialized
2. Verify that the certificates are correctly generated in `traefik/local-certs`
3. Check that the fullchain.pem includes both the certificate and CA certificate
4. Restart the services with `docker-compose down && docker-compose up -d`

### Proxy Issues

If you encounter issues with the Node.js proxy:

1. Check that the proxy is running with `node proxy.js`
2. Verify that the SSL certificates are correctly referenced in the proxy code
3. Ensure the backend and frontend services are running and accessible on their respective ports
4. Check the console output for any error messages
