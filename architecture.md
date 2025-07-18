# Mini-Chatbox RAG Agent - Architecture

## System Overview

The Mini-Chatbox RAG Agent is a sophisticated conversational AI system that combines task decomposition, retrieval-augmented generation, multimodal processing, and intelligent memory management with flexible agent scripting capabilities.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      User Interface                          │
│                    (Chatbox Frontend)                        │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                  API Gateway / Router                        │
│              (WebSocket + REST Endpoints)                    │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                 Core Orchestrator                            │
│         (Task Manager & Agent Coordinator)                   │
└──┬──────────┬──────────┬──────────┬──────────┬─────────────┘
   │          │          │          │          │
   ▼          ▼          ▼          ▼          ▼
┌──────┐ ┌─────────┐ ┌──────┐ ┌─────────┐ ┌──────────┐
│ Task │ │   MCP   │ │ RAG  │ │  Multi  │ │  Memory  │
│Division│ │ Server │ │System│ │  Modal  │ │  System  │
└──────┘ └─────────┘ └──────┘ └─────────┘ └──────────┘
```

## Docker Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Host System                        │
├─────────────────────────────────────────────────────────────┤
│                   Docker Compose Network                     │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌──────────────┐ ┌────────────────────────┐│
│ │   Nginx     │ │  Frontend    │ │    Backend API         ││
│ │   Reverse   │ │  Container   │ │    Container           ││
│ │   Proxy     │ │  (React/Vue) │ │    (Node.js)           ││
│ └─────────────┘ └──────────────┘ └────────────────────────┘│
│ ┌─────────────┐ ┌──────────────┐ ┌────────────────────────┐│
│ │  PostgreSQL │ │    Redis     │ │   Vector DB            ││
│ │  Container  │ │  Container   │ │   (Qdrant/Weaviate)   ││
│ └─────────────┘ └──────────────┘ └────────────────────────┘│
│ ┌─────────────────────────────────────────────────────────┐│
│ │              Shared Volumes & Networks                   ││
│ └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Task Division System

**Purpose**: Breaks down complex user requests into manageable subtasks.

**Architecture**:
```
Task Division Module
├── Task Parser
│   ├── Natural Language Understanding
│   ├── Intent Recognition
│   └── Dependency Analysis
├── Task Queue
│   ├── Priority Queue Implementation
│   ├── Task State Manager
│   └── Concurrency Controller
└── Task Executor
    ├── Subtask Generator
    ├── Progress Tracker
    └── Result Aggregator
```

**Key Technologies**:
- Abstract Syntax Tree (AST) for task representation
- Graph-based dependency resolution
- Priority queue with dynamic reordering

### 2. MCP (Model Context Protocol) Integration

**Purpose**: Enables standardized communication with various AI models and tools.

**Architecture**:
```
MCP Integration Layer
├── MCP Server
│   ├── Protocol Handler
│   ├── Tool Registry
│   └── Session Manager
├── MCP Client
│   ├── Connection Pool
│   ├── Request/Response Handler
│   └── Error Recovery
└── Tool Adapters
    ├── Built-in Tools
    ├── Custom Tool Interface
    └── Tool Validation
```

**Key Features**:
- Bidirectional streaming support
- Tool discovery and registration
- Automatic retry with exponential backoff

### 3. RAG (Retrieval-Augmented Generation) System

**Purpose**: Enhances responses with relevant contextual information from a knowledge base.

**Architecture**:
```
RAG Pipeline
├── Document Ingestion
│   ├── Document Loaders (PDF, TXT, MD, etc.)
│   ├── Chunking Strategy
│   └── Metadata Extraction
├── Embedding Generation
│   ├── Text Embedder
│   ├── Batch Processing
│   └── Embedding Cache
├── Vector Store
│   ├── Index Management
│   ├── Similarity Search
│   └── Hybrid Search (Vector + Keyword)
└── Context Assembly
    ├── Relevance Scoring
    ├── Context Window Optimization
    └── Source Attribution
```

**Storage Options**:
- Primary: Pinecone/Weaviate/Qdrant for vector storage
- Secondary: PostgreSQL with pgvector for hybrid search
- Cache: Redis for embedding cache

### 4. Multimodal Processing

**Purpose**: Handles various input types beyond text.

**Architecture**:
```
Multimodal Engine
├── Image Processing
│   ├── Image Upload Handler
│   ├── Vision Model Integration
│   ├── OCR Pipeline
│   └── Image Embedding Generator
├── Video Processing
│   ├── Frame Extraction
│   ├── Scene Analysis
│   └── Temporal Understanding
└── Audio Processing
    ├── Speech-to-Text
    ├── Audio Analysis
    └── Emotion Detection
```

**Integration Points**:
- OpenAI Vision API / Claude Vision
- Whisper for audio transcription
- Custom ML models for specialized tasks

### 5. Context Memory System

**Purpose**: Maintains conversation context and user preferences across sessions.

**Architecture**:
```
Memory Management
├── Short-term Memory
│   ├── Conversation Buffer
│   ├── Active Context Window
│   └── Recent Interactions Cache
├── Long-term Memory
│   ├── User Profile Store
│   ├── Conversation History DB
│   └── Learned Preferences
└── Memory Operations
    ├── Contextual Retrieval
    ├── Memory Consolidation
    ├── Forgetting Mechanism
    └── Memory Search
```

**Storage Strategy**:
- In-memory: Current conversation context
- Redis: Recent conversations and quick access
- PostgreSQL: Long-term conversation history
- Vector DB: Semantic memory search

### 6. Agent Script System

**Purpose**: Enables rapid creation and deployment of specialized agents.

**Architecture**:
```
Agent Framework
├── Script Engine
│   ├── DSL Parser
│   ├── Script Validator
│   └── Runtime Environment
├── Agent Registry
│   ├── Agent Templates
│   ├── Capability Mapping
│   └── Version Control
└── Orchestration Layer
    ├── Agent Scheduler
    ├── Inter-agent Communication
    └── Resource Management
```

**Script Format Example**:
```yaml
agent:
  name: "Research Assistant"
  capabilities:
    - web_search
    - summarization
    - citation_generation
  triggers:
    - intent: "research"
    - keywords: ["find", "search", "investigate"]
  workflow:
    - search_web
    - extract_relevant_info
    - generate_summary
    - add_citations
```

## Data Flow

1. **User Input** → API Gateway → Core Orchestrator
2. **Task Analysis** → Task Division → Subtask Queue
3. **Context Gathering** → Memory System + RAG Retrieval
4. **Processing** → Agent Selection → MCP Tools → Response Generation
5. **Response** → Context Update → Memory Storage → User Output

## Technology Stack

### Backend
- **Language**: Node.js/TypeScript (primary) or Python
- **Framework**: Express.js/Fastify or FastAPI
- **Real-time**: Socket.io or native WebSockets
- **Queue**: Redis + Bull Queue

### Storage
- **Primary DB**: PostgreSQL
- **Vector DB**: Pinecone/Weaviate/Qdrant
- **Cache**: Redis
- **File Storage**: S3-compatible storage

### AI/ML
- **LLMs**: OpenAI GPT-4, Claude, local models via Ollama
- **Embeddings**: OpenAI Ada, Sentence Transformers
- **Vision**: OpenAI Vision, CLIP
- **Speech**: Whisper, Azure Speech Services

### Infrastructure
- **Container**: Docker
- **Orchestration**: Kubernetes (for scale)
- **Monitoring**: Prometheus + Grafana
- **Logging**: ELK Stack or Loki

## Docker Implementation

### Container Strategy

#### 1. Multi-Stage Dockerfile
```dockerfile
# Stage 1: Dependencies
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Stage 2: Build
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 3: Production
FROM node:18-alpine AS runner
WORKDIR /app
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
USER nodejs
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

#### 2. Docker Compose Configuration
```yaml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - backend
      - frontend
    networks:
      - chatbox-network

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:pass@postgres:5432/chatbox
      - REDIS_URL=redis://redis:6379
      - VECTOR_DB_URL=http://qdrant:6333
    depends_on:
      - postgres
      - redis
      - qdrant
    networks:
      - chatbox-network
    volumes:
      - ./agent-scripts:/app/agent-scripts
      - uploads:/app/uploads

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    environment:
      - REACT_APP_API_URL=http://backend:3000
    networks:
      - chatbox-network

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=chatbox
      - POSTGRES_PASSWORD=secret
      - POSTGRES_DB=chatbox
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - chatbox-network

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis-data:/data
    networks:
      - chatbox-network

  qdrant:
    image: qdrant/qdrant:latest
    volumes:
      - qdrant-data:/qdrant/storage
    networks:
      - chatbox-network

volumes:
  postgres-data:
  redis-data:
  qdrant-data:
  uploads:

networks:
  chatbox-network:
    driver: bridge
```

#### 3. Development Docker Compose
```yaml
version: '3.8'

services:
  backend-dev:
    build:
      context: ./backend
      dockerfile: Dockerfile.dev
    volumes:
      - ./backend:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
    command: npm run dev
    ports:
      - "3000:3000"
      - "9229:9229" # Debug port

  frontend-dev:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    volumes:
      - ./frontend:/app
      - /app/node_modules
    environment:
      - CHOKIDAR_USEPOLLING=true
    command: npm start
    ports:
      - "3001:3000"
```

### Docker Best Practices

1. **Security**
   - Run containers as non-root user
   - Use official base images
   - Scan images for vulnerabilities
   - Implement secrets management

2. **Optimization**
   - Minimize layers in Dockerfile
   - Use .dockerignore effectively
   - Leverage build cache
   - Optimize image size

3. **Networking**
   - Use custom networks for isolation
   - Implement service discovery
   - Configure health checks

4. **Data Management**
   - Use named volumes for persistence
   - Implement backup strategies
   - Handle database migrations

### Quick Start Guide

```bash
# Clone repository
git clone https://github.com/your-org/mini-chatbox-rag-agent
cd mini-chatbox-rag-agent

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Scale backend services
docker-compose up -d --scale backend=3

# Stop all services
docker-compose down
```

## Security Considerations

1. **Authentication**: JWT-based auth with refresh tokens
2. **Authorization**: Role-based access control (RBAC)
3. **Data Encryption**: TLS in transit, AES-256 at rest
4. **Input Validation**: Comprehensive sanitization
5. **Rate Limiting**: Per-user and per-endpoint limits
6. **Audit Logging**: All actions logged with user context

## Scalability Design

1. **Horizontal Scaling**: Stateless services behind load balancer
2. **Caching Strategy**: Multi-level caching (CDN, Redis, application)
3. **Database Sharding**: User-based sharding for conversation data
4. **Async Processing**: Event-driven architecture with message queues
5. **Resource Pooling**: Connection pools for DB and external services

## Performance Targets

- **Response Time**: < 2s for simple queries, < 5s for complex RAG queries
- **Throughput**: 1000+ concurrent users
- **Availability**: 99.9% uptime
- **Memory Efficiency**: < 500MB per active session
- **Vector Search**: < 100ms for 1M vectors
- **Container Startup**: < 30s for full stack
- **Image Size**: < 200MB for production images

## Docker Monitoring & Observability

### Container Metrics
```yaml
# docker-compose.monitoring.yml
services:
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana:latest
    volumes:
      - grafana-data:/var/lib/grafana
      - ./grafana/dashboards:/etc/grafana/provisioning/dashboards
    ports:
      - "3000:3000"

  cadvisor:
    image: gcr.io/cadvisor/cadvisor:latest
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:ro
      - /sys:/sys:ro
      - /var/lib/docker/:/var/lib/docker:ro
    ports:
      - "8080:8080"
```

### Health Checks
```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js || exit 1
```