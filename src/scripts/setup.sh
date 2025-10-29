#!/bin/bash

# Mini-Chatbox RAG Agent Setup Script
# This script sets up the development environment

set -e

echo "🚀 Setting up Mini-Chatbox RAG Agent..."

# Check prerequisites
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo "❌ $1 is not installed. Please install $1 first."
        exit 1
    fi
}

echo "📋 Checking prerequisites..."
check_command node
check_command npm
check_command docker
check_command docker-compose

# Check Node version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version must be 18 or higher. Current version: $(node -v)"
    exit 1
fi

echo "✅ All prerequisites met!"

# Create environment file if it doesn't exist
if [ ! -f backend/.env ]; then
    echo "📝 Creating environment file..."
    cp backend/.env.example backend/.env
    echo "⚠️  Please edit backend/.env with your configuration"
fi

# Install dependencies
echo "📦 Installing dependencies..."
echo "Installing backend dependencies..."
cd backend && npm install
cd ..

echo "Installing frontend dependencies..."
cd frontend && npm install
cd ..

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p logs uploads agent-scripts/examples

# Set up git hooks (optional)
if [ -d .git ]; then
    echo "🔗 Setting up git hooks..."
    cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
# Run linters before commit
cd backend && npm run lint
cd ../frontend && npm run lint
EOF
    chmod +x .git/hooks/pre-commit
fi

# Start services
echo "🐳 Starting Docker services..."
docker-compose -f docker/docker-compose.dev.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check service health
echo "🏥 Checking service health..."
docker-compose -f docker/docker-compose.dev.yml ps

echo "✨ Setup complete!"
echo ""
echo "📌 Next steps:"
echo "1. Edit backend/.env with your API keys and configuration"
echo "2. Run 'make dev' to start the development environment"
echo "3. Access the application at:"
echo "   - Frontend: http://localhost:3001"
echo "   - Backend: http://localhost:3000"
echo "   - pgAdmin: http://localhost:5050"
echo "   - Qdrant: http://localhost:6333"
echo ""
echo "Happy coding! 🎉"