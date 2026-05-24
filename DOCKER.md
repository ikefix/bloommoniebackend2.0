# Docker Setup for Bloommonie Backend

This document provides instructions for setting up and running the Bloommonie Backend application using Docker.

## Prerequisites

- Docker installed on your machine
- Docker Compose installed on your machine
- At least 2GB of available RAM
- At least 5GB of available disk space


+++++++++++++++++++++++++++++++++++++++++++

do this in below in power shell as adminstrator

# 1. Enable WSL2 (required for Docker)
Write-Host "Enabling WSL2..." -ForegroundColor Yellow
wsl --install

# 2. Set WSL2 as default version
wsl --set-default-version 2

# 3. Install Docker Desktop via winget
Write-Host "Installing Docker Desktop..." -ForegroundColor Yellow
winget install --id Docker.DockerDesktop --silent --accept-package-agreements --accept-source-agreements

# 4. Verify installation
Write-Host "Verifying Docker installation..." -ForegroundColor Yellow
docker --version

# 5. Test Docker works
Write-Host "Running test container..." -ForegroundColor Yellow
docker run hello-world

Write-Host "Docker installation complete! 🎉" -ForegroundColor Green

++++++++++++++++++++++++++++++++++++++++++++


## Quick Start

### Production Build

1. Clone the repository and navigate to the project directory:
```bash
cd bloommoniebackend2.0
```

2. Create a copy of the Docker environment file and customize it:
```bash
cp .env.docker .env
```

3. Update the `.env` file with your actual configuration values (especially JWT_SECRET, recovery_code, and third-party API credentials).

4. Build and start the containers:
```bash
docker compose up --build
```

The application will be available at `http://localhost:5000`

### Development Mode with Hot-Reload

For development with hot-reload capabilities:

```bash
docker compose -f docker-compose.dev.yml up --build
```

## Services

### MongoDB
- **Port:** 27017
- **Username:** admin
- **Password:** admin123
- **Database:** bloommonie
- **Data Persistence:** Volumes are used to persist MongoDB data

### Backend Application
- **Port:** 5000
- **Node Version:** 20 LTS
- **TypeScript:** Compiled during build
- **Hot-Reload:** Available in development mode

## Docker Commands

### Build and Start
```bash
# Production
docker compose up --build

# Development
docker compose -f docker-compose.dev.yml up --build
```

### Stop Containers
```bash
# Production
docker compose down

# Development
docker compose -f docker-compose.dev.yml down
```

### View Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f app
docker compose logs -f mongodb
```

### Restart Services
```bash
# Production
docker compose restart

# Development
docker compose -f docker-compose.dev.yml restart
```

### Remove Volumes (Delete all data)
```bash
# Production
docker compose down -v

# Development
docker compose -f docker-compose.dev.yml down -v
```

## Environment Variables

The application requires the following environment variables:

### Required
- `MONGO_DB_CONN` - MongoDB connection string
- `JWT_SECRET` - Secret key for JWT token generation
- `PORT` - Application port (default: 5000)
- `APIC` - API prefix for routes

### Optional (but recommended)
- `GOOGLE_APP_PASSWORD` - Google app password for email services
- `APP_VERIFY_URL` - URL for email verification
- `APP_RESET_PASSWORD_URL` - URL for password reset

### Google OAuth2
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `GOOGLE_REDIRECT_URI` - Google OAuth redirect URI

### Twilio (SMS Service)
- `TWILIO_ACCOUNT_SID` - Twilio account SID
- `TWILIO_AUTH_TOKEN` - Twilio auth token
- `TWILIO_PHONE_NUMBER` - Twilio phone number

### Security
- `recovery_code` - Recovery code for account recovery

## Volume Management

### MongoDB Data
- Production: `mongodb_data` and `mongodb_config` volumes
- Development: `mongodb_data_dev` and `mongodb_config_dev` volumes

### Application Logs
- Logs are stored in the `./logs` directory on the host machine

## Troubleshooting

### MongoDB Connection Issues
If the application cannot connect to MongoDB:
1. Check if MongoDB container is running: `docker compose ps`
2. Check MongoDB logs: `docker compose logs mongodb`
3. Ensure the application container waits for MongoDB to be healthy (configured in docker-compose.yml)

### Port Conflicts
If port 5000 is already in use:
1. Modify the port mapping in docker-compose.yml:
```yaml
ports:
  - "5001:5000"  # Use port 5001 instead
```

### Build Errors
If you encounter build errors:
1. Remove old containers and volumes: `docker compose down -v`
2. Rebuild from scratch: `docker compose up --build --force-recreate`

### Permission Issues
If you encounter permission issues with volumes:
1. Check Docker daemon permissions
2. On Linux/Mac, you may need to adjust user permissions for the `./logs` directory

## Production Considerations

### Security
- Change all default passwords and secrets in production
- Use strong, random values for JWT_SECRET and recovery_code
- Keep your `.env` file secure and never commit it to version control
- Use Docker secrets or environment variable management in production

### Performance
- Adjust MongoDB memory settings based on your requirements
- Configure resource limits in docker-compose.yml if needed
- Use a reverse proxy (nginx) for SSL termination in production

### Monitoring
- Consider adding monitoring tools (Prometheus, Grafana)
- Set up log aggregation (ELK stack, Splunk, etc.)
- Configure health checks and alerts

### Scaling
- For horizontal scaling, use Docker Swarm or Kubernetes
- Consider using a managed MongoDB service (MongoDB Atlas) for production
- Implement load balancing for multiple application instances

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [MongoDB Docker Image](https://hub.docker.com/_/mongo)
- [Node.js Docker Best Practices](https://github.com/nodejs/docker-node/blob/main/README.md)