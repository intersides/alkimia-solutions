# Intersides Workspace

A monorepo workspace for Intersides applications, built around the Alkimia framework. This workspace contains both frontend and backend services with a custom Node.js-based proxy for local development and production deployment, featuring intelligent lazy loading of Docker containers and resource monitoring capabilities.

## Project Overview

Intersides Workspace is a comprehensive development environment that:

- Provides a unified development experience for frontend and backend applications
- Implements a custom HTTPS proxy with automatic container management
- Supports both development and production environments
- Uses a modular architecture with shared libraries
- Integrates with the Alkimia framework for frontend development
- Includes container monitoring and stress testing capabilities
- Features a load balancer service for scaling strategies

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
├── modules/
│   └── ContainerMonitorService.js  # Service for monitoring Docker container performance
├── services/
│   └── LoadBalancer/  # Load balancing service for scaling strategies
├── certs/             # SSL certificates for local development
│   ├── fullchain.pem  # Combined certificate with CA
│   └── key.pem        # Private key
├── stress-agent/      # Performance testing tools for stress testing containers
├── tests/             # Test suite
├── DockerManager.js   # Docker container management service with resource limits
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

### Docker Integration with Resource Management

The `DockerManager.js` module provides:

1. On-demand container management
2. Automatic building and starting of containers when services are requested
3. Container health monitoring with health checks
4. Environment-specific configuration
5. Resource limits for containers (CPU and memory)
6. Support for container scaling strategies

### Container Performance Monitoring

The `ContainerMonitorService.js` module provides:

1. Real-time monitoring of container CPU and memory usage
2. Threshold-based alerts for resource usage
3. Performance data collection for analysis
4. Support for automatic scaling decisions
5. Panic threshold detection for critical resource usage

### Load Balancer Service

The `LoadBalancer` service provides:

1. Intelligent distribution of traffic across multiple service instances
2. MQTT integration for real-time communication between services
3. Health monitoring of backend services
4. Connection-aware scaling strategies
5. Support for graceful scaling up and down of services

### Stress Testing

The `stress-agent` module provides:

1. Tools for generating controlled load on backend services
2. Incremental stress testing with configurable parameters
3. CPU load simulation with precise intensity control
4. Integration with the monitoring system for observing container behavior under load

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
127.0.0.1 balancer.alkimia.localhost
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
- Load Balancer: https://balancer.alkimia.localhost

## Container Resource Management

Docker containers are configured with resource limits to prevent resource exhaustion and enable testing of scaling strategies:

```bash
# CPU and memory limits are set in DockerManager.js
--cpus=1     # Limit to 1 CPU core
--memory=512m # Limit to 512MB of memory
```

These limits help simulate resource constraints and test how the system behaves under load.

## Container Health Monitoring

The system includes Docker health checks to ensure containers are functioning properly:

```dockerfile
# Example from LoadBalancer Dockerfile
HEALTHCHECK --interval=5s --timeout=3s --retries=10 CMD curl --fail http://localhost:3000/ping || exit 1
```

The DockerManager includes a `waitUntilContainerIsHealthy` method that polls the container's health status:

```javascript
// Wait for a container to report healthy status
await dockerManager.waitUntilContainerIsHealthy('alkimia-load-balancer');
```

## Stress Testing

The stress-agent provides endpoints to generate controlled load on the backend services:

```bash
# Run a constant CPU stress test
curl http://localhost:8888/stress

# Run an incremental CPU stress test (10% increase every 10 seconds)
curl http://localhost:8888/stress-incremental
```

The backend provides two stress endpoints:
- `/api/stress?intensity=80&duration=30000` - Constant CPU load at specified intensity
- `/api/stress/incremental?steps=10&maxIntensity=100&stepDuration=10000` - Gradually increasing CPU load

## Container Monitoring

The ContainerMonitorService provides real-time monitoring of container resources:

```javascript
// Example usage in your code
import ContainerMonitorService from './modules/ContainerMonitorService.js';

const monitorService = ContainerMonitorService.getSingleton();

// Monitor CPU usage with panic threshold at 80%
monitorService.monitorContainerCpu('alkimia-backend', 1000, 0, (reading) => {
  console.log(`CPU: ${reading.cpuPercent.toFixed(2)}%`);
  if (reading.panic) {
    console.log('CPU usage exceeded panic threshold!');
    // Implement scaling strategy here
  }
}, 80);
```

## Service Communication

Services communicate with each other using MQTT for real-time messaging:

```javascript
// Example from LoadBalancer service
mqttClient = mqtt.connect("mqtt://mqtt-alkimia-broker/");
mqttClient.on("connect", () => {
    mqttClient.publish("services/network", JSON.stringify({
        service: "load-balancer", 
        message: {
            event: "connection",
            status: "connected"
        }
    }), {qos: 2});
});
```

This enables services to share status information, coordinate scaling activities, and implement distributed decision-making.

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
5. Use the stress-agent to test system behavior under load
6. Monitor container performance with ContainerMonitorService

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

### Container Resource Limits

If containers are being terminated due to resource limits:

1. Adjust the CPU and memory limits in DockerManager.js
2. Monitor container performance during stress tests
3. Implement appropriate scaling strategies based on resource usage patterns

### Container Health Checks

If containers are failing health checks:

1. Check the container logs for error messages
2. Verify that the health check endpoint is responding correctly
3. Adjust the health check parameters (interval, timeout, retries) if needed
4. Ensure the service inside the container is properly initialized before health checks begin
