# Mini-Chatbox RAG Agent

A sophisticated conversational AI system that combines task decomposition, retrieval-augmented generation (RAG), multimodal processing, and intelligent memory management with flexible agent scripting capabilities.

## Features

- **Task Division System**: Breaks down complex user requests into manageable subtasks
- **MCP Integration**: Model Context Protocol support for standardized AI model communication
- **RAG System**: Retrieval-Augmented Generation for enhanced contextual responses
- **Multimodal Support**: Process images, videos, and audio inputs
- **Context Memory**: Intelligent conversation memory management
- **Agent Scripts**: Flexible agent creation and orchestration

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose
- PostgreSQL (or use Docker)
- Redis (or use Docker)

### Local Development

1. Clone the repository:
```bash
git clone https://github.com/your-org/mini-chatbox-rag-agent
cd mini-chatbox-rag-agent
```

2. Run the setup script (recommended):
```bash
./scripts/setup.sh
```

Or manually install dependencies:
```bash
# Using npm workspaces
npm install

# Or using Make
make install
```

3. Set up environment variables:
```bash
cp backend/.env.example backend/.env
# Edit .env with your configuration
```

4. Start development servers:
```bash
# Using Make (recommended)
make dev

# Or using Docker Compose
docker-compose -f docker-compose.dev.yml up -d

# Or manually (without Docker)
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend
cd frontend && npm run dev
```

5. Access the application:
- Frontend: http://localhost:3001
- Backend API: http://localhost:3000
- pgAdmin: http://localhost:5050 (admin@chatbox.local / admin)
- Qdrant: http://localhost:6333

## Deployment

### Production Deployment with Docker

#### 1. Single Server Deployment

```bash
# Clone and navigate to project
git clone https://github.com/your-org/mini-chatbox-rag-agent
cd mini-chatbox-rag-agent

# Create production environment file
cp backend/.env.example backend/.env.production
# Edit .env.production with production values

# Build and start all services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f
```

The application will be available at http://your-server-ip

#### 2. Docker Swarm Deployment

```bash
# Initialize Swarm (on manager node)
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.yml chatbox

# Check services
docker service ls

# Scale services
docker service scale chatbox_backend=3
```

#### 3. Kubernetes Deployment

Create deployment manifests:

```yaml
# k8s/backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: chatbox-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: chatbox-backend
  template:
    metadata:
      labels:
        app: chatbox-backend
    spec:
      containers:
      - name: backend
        image: your-registry/chatbox-backend:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: chatbox-secrets
              key: database-url
```

Deploy to Kubernetes:

```bash
# Create namespace
kubectl create namespace chatbox

# Create secrets
kubectl create secret generic chatbox-secrets \
  --from-literal=database-url="postgresql://..." \
  --from-literal=jwt-secret="..." \
  -n chatbox

# Apply manifests
kubectl apply -f k8s/ -n chatbox

# Check deployment
kubectl get pods -n chatbox

# Expose service
kubectl expose deployment chatbox-backend \
  --type=LoadBalancer \
  --port=80 \
  --target-port=3000 \
  -n chatbox
```

### Cloud Platform Deployments

#### AWS ECS Deployment

1. Build and push images to ECR:
```bash
# Build images
docker-compose build

# Tag for ECR
docker tag chatbox-backend:latest \
  123456789.dkr.ecr.us-east-1.amazonaws.com/chatbox-backend:latest

# Push to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  123456789.dkr.ecr.us-east-1.amazonaws.com

docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/chatbox-backend:latest
```

2. Create ECS task definition and service via AWS Console or CLI

#### Google Cloud Run Deployment

```bash
# Build and push to Google Container Registry
gcloud builds submit --tag gcr.io/PROJECT-ID/chatbox-backend

# Deploy to Cloud Run
gcloud run deploy chatbox-backend \
  --image gcr.io/PROJECT-ID/chatbox-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production
```

#### Azure Container Instances

```bash
# Create resource group
az group create --name chatbox-rg --location eastus

# Create container registry
az acr create --resource-group chatbox-rg \
  --name chatboxregistry --sku Basic

# Build and push image
az acr build --registry chatboxregistry \
  --image chatbox-backend:v1 .

# Deploy container
az container create \
  --resource-group chatbox-rg \
  --name chatbox-backend \
  --image chatboxregistry.azurecr.io/chatbox-backend:v1 \
  --dns-name-label chatbox-backend \
  --ports 3000
```

### Production Configuration

#### Environment Variables

Create a production `.env` file:

```env
# Application
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://user:pass@db-host:5432/chatbox_prod

# Redis
REDIS_URL=redis://redis-host:6379

# Security
JWT_SECRET=your-production-secret-key-here
CORS_ORIGIN=https://your-domain.com

# AI Services
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key

# Monitoring
SENTRY_DSN=your-sentry-dsn
NEW_RELIC_LICENSE_KEY=your-new-relic-key
```

#### SSL/TLS Configuration

For HTTPS, update nginx configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/ssl/certs/your-cert.pem;
    ssl_certificate_key /etc/ssl/private/your-key.pem;

    # ... rest of configuration
}
```

#### Database Backups

Set up automated backups:

```bash
# Create backup script
cat > backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker exec postgres pg_dump -U chatbox chatbox > backup_$DATE.sql
# Upload to S3
aws s3 cp backup_$DATE.sql s3://your-backup-bucket/
# Clean up old local backups
find . -name "backup_*.sql" -mtime +7 -delete
EOF

# Add to crontab (daily at 2 AM)
0 2 * * * /path/to/backup.sh
```

### Monitoring and Maintenance

#### Health Checks

The application includes health check endpoints:

- Backend: `GET /health`
- Frontend: `GET /`

#### Logging

View logs:
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend

# Save logs to file
docker-compose logs > logs_$(date +%Y%m%d).txt
```

#### Performance Monitoring

1. **Prometheus + Grafana** (included in docker-compose.monitoring.yml):
```bash
docker-compose -f docker-compose.monitoring.yml up -d
```
Access Grafana at http://localhost:3000

2. **Application Metrics**:
- Response time tracking
- Error rate monitoring
- Resource usage (CPU, Memory)
- Active connections

### Scaling Considerations

#### Horizontal Scaling

```bash
# Scale backend instances
docker-compose up -d --scale backend=5

# With Kubernetes
kubectl scale deployment chatbox-backend --replicas=5
```

#### Load Balancing

The included nginx configuration handles load balancing automatically. For cloud deployments, use:
- AWS: Application Load Balancer (ALB)
- GCP: Cloud Load Balancing
- Azure: Application Gateway

#### Caching Strategy

1. **Redis** for session storage and caching
2. **CDN** for static assets (CloudFlare, AWS CloudFront)
3. **Database query caching** via TypeORM

### Troubleshooting

#### Common Issues

1. **Container won't start**:
```bash
docker-compose logs backend
# Check for missing environment variables or connection issues
```

2. **Database connection failed**:
```bash
# Test connection
docker exec -it postgres psql -U chatbox -d chatbox

# Check if migrations ran
docker exec backend npm run migration:show
```

3. **Out of memory**:
```bash
# Increase Docker memory limit
# Docker Desktop: Preferences > Resources > Memory

# Or set container limits in docker-compose.yml
services:
  backend:
    mem_limit: 2g
```

#### Rollback Procedure

```bash
# Stop current deployment
docker-compose down

# Restore previous version
git checkout tags/v1.0.0
docker-compose build
docker-compose up -d

# Restore database if needed
docker exec -i postgres psql -U chatbox chatbox < backup.sql
```

## Project Structure

```
mini-chatbox-rag-agent/
├── backend/                 # Node.js/TypeScript backend
│   ├── src/
│   │   ├── controllers/    # API controllers
│   │   ├── services/       # Business logic
│   │   ├── models/         # Data models
│   │   ├── middleware/     # Express middleware
│   │   └── utils/          # Utility functions
│   └── tests/              # Backend tests
├── frontend/               # React/TypeScript frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom React hooks
│   │   └── services/       # API services
│   └── public/             # Static assets
├── docker/                 # Docker configurations
├── agent-scripts/          # Agent script templates
└── docs/                   # Additional documentation
```

## Development

See [DEVELOPMENT.md](./DEVELOPMENT.md) for detailed development instructions.

## Architecture

See [architecture.md](./architecture.md) for detailed system design and component documentation.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.