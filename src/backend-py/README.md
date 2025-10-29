# Mini-Chatbox RAG Agent - Django Backend

Django-based backend for the Mini-Chatbox RAG Agent system with support for chat, RAG (Retrieval-Augmented Generation), MCP (Model Context Protocol), and multimodal processing.

## Features

- **Django REST Framework** for RESTful APIs
- **WebSocket support** via Django Channels for real-time chat
- **PostgreSQL** database with UUID primary keys
- **Redis** for caching and WebSocket channels
- **Celery** for background task processing
- **JWT authentication**
- **Multimodal support** (images, audio, video, documents)
- **RAG system** with Qdrant vector database
- **MCP integration** for tool orchestration

## Project Structure

```
backend-py/
├── backend/                 # Django project settings
│   ├── __init__.py
│   ├── settings.py         # Main settings
│   ├── urls.py             # Root URL configuration
│   ├── wsgi.py             # WSGI entry point
│   ├── asgi.py             # ASGI entry point (WebSockets)
│   └── celery.py           # Celery configuration
├── apps/                    # Django applications
│   ├── chat/               # Chat functionality
│   │   ├── models.py       # Message, Attachment models
│   │   ├── views.py        # Chat API views
│   │   ├── serializers.py  # DRF serializers
│   │   ├── consumers.py    # WebSocket consumers
│   │   └── routing.py      # WebSocket routing
│   ├── conversation/       # Conversation management
│   ├── rag/                # RAG functionality
│   ├── mcp/                # MCP server integration
│   └── projects/           # Project management
├── manage.py               # Django management script
├── requirements.txt        # Python dependencies
├── Dockerfile              # Production Docker image
├── Dockerfile.dev          # Development Docker image
└── .env.example            # Environment variables template
```

## Quick Start

### Prerequisites

- Python 3.11+
- PostgreSQL
- Redis
- Qdrant (vector database)

### Local Development Setup

1. **Create virtual environment**:
   ```bash
   cd src/backend-py
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Run migrations**:
   ```bash
   python manage.py makemigrations
   python manage.py migrate
   ```

5. **Create superuser**:
   ```bash
   python manage.py createsuperuser
   ```

6. **Run development server**:
   ```bash
   python manage.py runserver 0.0.0.0:20001
   ```

7. **Run Celery worker** (in separate terminal):
   ```bash
   celery -A backend worker -l info
   ```

### One-Click Startup (Recommended)

```bash
# 一键启动后端 / One-click startup
./start-backend.sh
```

This script will:
- Check and create virtual environment
- Install dependencies
- Check database and Redis connections
- Run migrations
- Create default superuser (admin/admin)
- Start server on port 20001

### Docker Development

```bash
# Build and start services
docker-compose -f ../../docker/docker-compose.dev.python.yml up -d backend-py

# View logs
docker-compose -f ../../docker/docker-compose.dev.python.yml logs -f backend-py

# Run migrations
docker-compose -f ../../docker/docker-compose.dev.python.yml exec backend-py python manage.py migrate

# Create superuser
docker-compose -f ../../docker/docker-compose.dev.python.yml exec backend-py python manage.py createsuperuser
```

## API Endpoints

### Chat
- `POST /api/chat/send_message/` - Send a chat message
- `GET /api/chat/history/` - Get chat history

### Conversations
- `GET /api/conversation/` - List conversations
- `POST /api/conversation/` - Create conversation
- `GET /api/conversation/{id}/` - Get conversation details
- `PUT /api/conversation/{id}/` - Update conversation
- `DELETE /api/conversation/{id}/` - Delete conversation

### RAG
- `GET /api/rag/documents/` - List documents
- `POST /api/rag/documents/` - Upload document
- `GET /api/rag/knowledge-sources/` - List knowledge sources
- `POST /api/rag/knowledge-sources/` - Create knowledge source
- `POST /api/rag/knowledge-sources/{id}/query/` - Query knowledge source

### MCP
- `GET /api/mcp/servers/` - List MCP servers
- `POST /api/mcp/servers/` - Add MCP server
- `POST /api/mcp/servers/{id}/sync_tools/` - Sync tools from server
- `GET /api/mcp/tools/` - List available tools
- `POST /api/mcp/tools/{id}/execute/` - Execute tool

### Projects
- `GET /api/projects/` - List projects
- `POST /api/projects/` - Create project
- `GET /api/projects/{id}/` - Get project details
- `PUT /api/projects/{id}/` - Update project
- `DELETE /api/projects/{id}/` - Delete project

## WebSocket

Connect to WebSocket for real-time chat:

```javascript
const ws = new WebSocket('ws://localhost:20001/ws/chat/');

ws.onmessage = function(event) {
    const data = JSON.parse(event.data);
    console.log('Message:', data);
};

ws.send(JSON.stringify({
    'message': 'Hello, AI!'
}));
```

## Database Models

### Chat App
- **Message**: Chat messages with role, content, and metadata
- **Attachment**: File attachments for multimodal content

### Conversation App
- **Conversation**: Conversation containers with title and metadata

### RAG App
- **Document**: Uploaded documents for RAG
- **KnowledgeSource**: Vector store collections

### MCP App
- **MCPServer**: MCP server configurations
- **MCPTool**: Available MCP tools

### Projects App
- **Project**: User projects

## Testing

```bash
# Run all tests
python manage.py test

# Run specific app tests
python manage.py test apps.chat

# Run with coverage
pytest --cov=apps --cov-report=html
```

## Admin Interface

Access the Django admin interface at `http://localhost:20001/admin/`

Use the superuser credentials created during setup.

## Environment Variables

Key environment variables (see `.env.example` for complete list):

```env
DJANGO_SECRET_KEY=your-secret-key
DJANGO_DEBUG=True
DATABASE_URL=postgresql://user:pass@localhost:5432/chatbox
REDIS_URL=redis://localhost:6379/0
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
QDRANT_URL=http://localhost:6333
```

## Deployment

### Production Checklist

1. Set `DJANGO_DEBUG=False`
2. Use strong `DJANGO_SECRET_KEY`
3. Configure `ALLOWED_HOSTS`
4. Set up proper database backup
5. Use HTTPS/SSL
6. Configure CORS properly
7. Set up logging and monitoring
8. Use gunicorn/daphne with supervisor

### Docker Production

```bash
docker build -t chatbox-backend-py:latest -f Dockerfile .
docker run -p 20001:20001 --env-file .env chatbox-backend-py:latest
```

## Development

### Creating a new app

```bash
python manage.py startapp myapp apps/myapp
```

### Creating migrations

```bash
python manage.py makemigrations
python manage.py migrate
```

### Django Shell

```bash
python manage.py shell
```

## Contributing

1. Follow PEP 8 style guide
2. Use Black for code formatting: `black .`
3. Check with flake8: `flake8 .`
4. Write tests for new features
5. Update documentation

## License

MIT License
