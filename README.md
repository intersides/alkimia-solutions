# Intersides Workspace

A monorepo workspace for Intersides applications, containing both frontend and backend services with a Traefik reverse proxy for local development and production deployment.

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
├── traefik/
│   ├── acme/          # Let's Encrypt certificates for production
│   ├── config/        # Additional Traefik configuration
│   ├── local-certs/   # Local development certificates
│   ├── traefik.dev.yml  # Traefik configuration for development
│   └── traefik.prod.yml # Traefik configuration for production
├── docker-compose.yml           # Base Docker Compose configuration
├── docker-compose.override.yml  # Development overrides
└── Dockerfile         # Multi-stage Dockerfile for all services
```

## Environment Setup

The project uses Docker and Docker Compose for both development and production environments. Configuration is managed through environment variables in the `.env` file.

### Prerequisites

- Docker and Docker Compose
- Node.js (for local development)
- mkcert (for generating local SSL certificates)

## Development Environment

### Setting up mkcert on macOS

1. Install mkcert using Homebrew:

```bash
brew install mkcert
brew install nss  # if you use Firefox
```

2. Initialize mkcert:

```bash
mkcert -install
```

3. Generate certificates for local development:

```bash
mkdir -p traefik/local-certs
cd traefik/local-certs
mkcert "*.alkimia.localhost" alkimia.localhost localhost 127.0.0.1 ::1
```

4. Create a fullchain.pem file by combining the certificate with the CA certificate:

```bash
# Find the location of the CA certificate
mkcert -CAROOT
# Copy the certificate and create fullchain.pem
cat "*.alkimia.localhost+4.pem" "$(mkcert -CAROOT)/rootCA.pem" > fullchain.pem
# Copy the key file
cp "*.alkimia.localhost+4-key.pem" alkimia.localhost-key.pem
```

### Local Hosts Configuration

Add the following entries to your `/etc/hosts` file:

```
127.0.0.1 app.alkimia.localhost
127.0.0.1 server.alkimia.localhost
```

### Starting the Development Environment

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

In development mode, the services are available at:
- Frontend: https://app.alkimia.localhost
- Backend: https://server.alkimia.localhost
- Traefik Dashboard: http://localhost:8080

## Production Deployment

For production deployment, use the base docker-compose.yml without the override:

```bash
docker-compose -f docker-compose.yml up -d
```

In production mode:
- Let's Encrypt is used for SSL certificates
- Volume mounts for live development are disabled
- Environment variables from .env are used for configuration

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

1. Start the development environment with `docker-compose up -d`
2. Make changes to the code in the `apps` or `libs` directories
3. The changes will be automatically reflected due to volume mounts
4. Access the applications at their respective URLs

## Notes on SSL Certificates

- Development certificates are generated using mkcert and are included in the repository for convenience
- These certificates are for development purposes only and should never be used in production
- Production uses Let's Encrypt for automatic certificate generation and renewal

## Troubleshooting

### Certificate Issues

If you encounter certificate issues in development:

1. Ensure mkcert is properly installed and initialized
2. Verify that the certificates are correctly generated in `traefik/local-certs`
3. Check that the fullchain.pem includes both the certificate and CA certificate
4. Restart the services with `docker-compose down && docker-compose up -d`

### Traefik Configuration

To debug Traefik configuration:

1. Set `TRAEFIK_LOG_LEVEL=DEBUG` in your .env file
2. Check the Traefik logs with `docker-compose logs traefik`
3. Access the Traefik dashboard at http://localhost:8080
