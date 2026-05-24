# Docker Quick Reference Guide

## Quick Commands

### Production
```bash
# Build and start
npm run docker:up
# or
docker compose up --build

# Stop
npm run docker:down
# or
docker compose down

# View logs
npm run docker:logs
# or
docker compose logs -f

# Clean everything (removes volumes)
docker compose down -v
```

### Development
```bash
# Build and start with hot-reload
npm run docker:dev
# or
docker compose -f docker-compose.dev.yml up --build

# Stop
npm run docker:dev-down
# or
docker compose -f docker-compose.dev.yml down
```

## Container Management

### View running containers
```bash
docker compose ps
```

### Execute commands in container
```bash
# Application container
docker compose exec app sh

# MongoDB container
docker compose exec mongodb mongosh
```

### Restart specific service
```bash
docker compose restart app
docker compose restart mongodb
```

## Database Access

### Connect to MongoDB
```bash
# From inside the container
docker compose exec mongodb mongosh -u admin -p admin123 --authenticationDatabase admin

# From host (using port 27017)
mongosh mongodb://admin:admin123@localhost:27017/bloommonie?authSource=admin
```

### Backup database
```bash
docker compose exec mongodb mongodump -u admin -p admin123 --authenticationDatabase admin --db bloommonie --archive /data/backup.bson
docker cp bloommonie-mongodb:/data/backup.bson ./backup.bson
```

### Restore database
```bash
docker cp ./backup.bson bloommonie-mongodb:/data/backup.bson
docker compose exec mongodb mongorestore -u admin -p admin123 --authenticationDatabase admin --db bloommonie --archive /data/backup.bson
```

## Troubleshooting

### Check container status
```bash
docker compose ps
```

### View container logs
```bash
# All logs
docker compose logs

# Specific service logs
docker compose logs app
docker compose logs mongodb

# Follow logs
docker compose logs -f app
```

### Rebuild without cache
```bash
docker compose build --no-cache
```

### Remove all Docker data
```bash
docker compose down -v
docker system prune -a
```

## Service URLs

- **Application API:** http://localhost:5000
- **MongoDB:** mongodb://admin:admin123@localhost:27017/bloommonie?authSource=admin
- **Health Check:** http://localhost:5000/

## Default Credentials

- **MongoDB Username:** admin
- **MongoDB Password:** admin123
- **MongoDB Database:** bloommonie

## Important Notes

- First run may take several minutes to build
- MongoDB data persists in Docker volumes
- Application logs are stored in `./logs` directory
- Change default passwords in production
- Update `.env.docker` with your actual configuration