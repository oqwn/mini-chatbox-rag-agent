#!/bin/bash

# Setup script for environment files

echo "Setting up environment files..."

# Root .env
if [ ! -f .env ]; then
  # Create .env from template
  cat > .env << 'EOF'
# Application
NODE_ENV=development
PORT=20001
HOST=localhost

# Database
DATABASE_URL=postgresql://chatbox:secret@localhost:5432/chatbox
DB_HOST=localhost
DB_PORT=5432
DB_NAME=chatbox
DB_USER=chatbox
DB_PASSWORD=secret

# Redis
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# Vector Database
VECTOR_DB_URL=http://localhost:6333
VECTOR_DB_API_KEY=

# Authentication
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_SECRET=your-refresh-token-secret
REFRESH_TOKEN_EXPIRES_IN=30d

# AI Models
OPENAI_API_KEY=your-openai-api-key-here
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
ANTHROPIC_API_KEY=

# MCP Configuration
MCP_SERVER_URL=http://localhost:8080
MCP_API_KEY=

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
CORS_ORIGIN=http://localhost:5173,http://localhost:3001,http://localhost:3000

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/app.log

# External Services
S3_BUCKET=
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=

# Feature Flags
ENABLE_MULTIMODAL=true
ENABLE_MEMORY_SYSTEM=true
ENABLE_AGENT_SCRIPTS=true
EOF
  echo "✓ Created .env - Please update with your OpenAI API key"
else
  echo "✓ .env already exists"
fi

# Frontend .env
if [ ! -f frontend/.env ]; then
  cp frontend/.env.example frontend/.env
  echo "✓ Created frontend/.env"
else
  echo "✓ frontend/.env already exists"
fi

echo ""
echo "Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env and add your OpenAI API key"
echo "2. Run 'pnpm dev' to start both frontend and backend"
echo "3. Open http://localhost:5173 in your browser"
echo "4. Go to Settings to configure your OpenAI API key if you haven't already"
echo ""
echo "Note: Backend runs on port 20001, frontend on port 5173"