#!/bin/bash

# ============================================
# 一键启动 Python Django 后端
# One-Click Startup Script for Python Backend
# ============================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  Starting Python Django Backend (Port: 20001)${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Check if .env exists, if not copy from .env.example
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠ .env file not found, copying from .env.example...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✓ .env file created${NC}"
    echo -e "${YELLOW}  Please edit .env file to configure your API keys and database${NC}"
    echo ""
fi

# Check Python version
echo -e "${BLUE}Checking Python version...${NC}"
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}✗ Python 3 not found, please install Python 3.11+${NC}"
    exit 1
fi

PYTHON_VERSION=$(python3 --version | cut -d ' ' -f 2)
echo -e "${GREEN}✓ Python version: $PYTHON_VERSION${NC}"
echo ""

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}⚠ Virtual environment not found, creating...${NC}"
    python3 -m venv venv
    echo -e "${GREEN}✓ Virtual environment created${NC}"
    echo ""
fi

# Activate virtual environment
echo -e "${BLUE}Activating virtual environment...${NC}"
source venv/bin/activate
echo -e "${GREEN}✓ Virtual environment activated${NC}"
echo ""

# Check if dependencies are installed
echo -e "${BLUE}Checking dependencies...${NC}"
if ! python -c "import django" &> /dev/null; then
    echo -e "${YELLOW}⚠ Django not installed, installing dependencies...${NC}"
    pip install --upgrade pip
    pip install -r requirements.txt
    echo -e "${GREEN}✓ Dependencies installed${NC}"
    echo ""
else
    echo -e "${GREEN}✓ Dependencies installed${NC}"
    echo ""
fi

# Check database connection and create database if needed
echo -e "${BLUE}Checking database connection...${NC}"
source .env
if command -v psql &> /dev/null; then
    # Check if PostgreSQL is running
    if pg_isready -h ${POSTGRES_HOST:-localhost} -p ${POSTGRES_PORT:-5432} &> /dev/null; then
        echo -e "${GREEN}✓ PostgreSQL service is running${NC}"

        # Check if database exists
        if psql -h ${POSTGRES_HOST:-localhost} -p ${POSTGRES_PORT:-5432} -U ${POSTGRES_USER:-chatbox} -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw ${POSTGRES_DB:-chatbox}; then
            echo -e "${GREEN}✓ Database '${POSTGRES_DB:-chatbox}' exists${NC}"
        else
            echo -e "${YELLOW}⚠ Database '${POSTGRES_DB:-chatbox}' does not exist, creating...${NC}"
            # Try to create database
            if psql -h ${POSTGRES_HOST:-localhost} -p ${POSTGRES_PORT:-5432} -U ${POSTGRES_USER:-chatbox} -c "CREATE DATABASE ${POSTGRES_DB:-chatbox};" 2>/dev/null; then
                echo -e "${GREEN}✓ Database created successfully${NC}"
            else
                echo -e "${YELLOW}⚠ Cannot create database automatically, please run manually:${NC}"
                echo -e "${YELLOW}  createdb -h ${POSTGRES_HOST:-localhost} -U ${POSTGRES_USER:-chatbox} ${POSTGRES_DB:-chatbox}${NC}"
                echo -e "${YELLOW}  or use psql:${NC}"
                echo -e "${YELLOW}  psql -h ${POSTGRES_HOST:-localhost} -U ${POSTGRES_USER:-chatbox} -c 'CREATE DATABASE ${POSTGRES_DB:-chatbox};'${NC}"
            fi
        fi
    else
        echo -e "${YELLOW}⚠ PostgreSQL database is not running${NC}"
        echo -e "${YELLOW}  Please start the database or use Docker:${NC}"
        echo -e "${YELLOW}  docker run -d --name chatbox-postgres -p 5432:5432 -e POSTGRES_USER=chatbox -e POSTGRES_PASSWORD=chatbox -e POSTGRES_DB=chatbox postgres:15${NC}"
        echo ""
        echo -e "${YELLOW}  Continue anyway (migrations may fail)? (y/n)${NC}"
        read -r response
        if [[ ! "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
            echo -e "${RED}✗ Startup cancelled${NC}"
            exit 1
        fi
    fi
else
    echo -e "${YELLOW}⚠ psql not installed, skipping database check${NC}"
    echo -e "${YELLOW}  Recommend installing PostgreSQL client tools${NC}"
fi
echo ""

# Check Redis connection
echo -e "${BLUE}Checking Redis connection...${NC}"
if command -v redis-cli &> /dev/null; then
    if redis-cli -h ${REDIS_HOST:-localhost} -p ${REDIS_PORT:-6379} ping &> /dev/null; then
        echo -e "${GREEN}✓ Redis connection OK${NC}"
    else
        echo -e "${YELLOW}⚠ Redis is not running${NC}"
        echo -e "${YELLOW}  Please start Redis or use Docker:${NC}"
        echo -e "${YELLOW}  docker run -d -p 6379:6379 redis:7-alpine${NC}"
    fi
else
    echo -e "${YELLOW}⚠ redis-cli not installed, skipping Redis check${NC}"
fi
echo ""

# Run migrations
echo -e "${BLUE}Running database migrations...${NC}"
python manage.py makemigrations
python manage.py migrate
echo -e "${GREEN}✓ Database migrations completed${NC}"
echo ""

# Collect static files
echo -e "${BLUE}Collecting static files...${NC}"
python manage.py collectstatic --noinput
echo -e "${GREEN}✓ Static files collected${NC}"
echo ""

# Create superuser if needed
echo -e "${BLUE}Checking superuser...${NC}"
python manage.py shell << END
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@example.com', 'admin')
    print('${GREEN}✓ Superuser created: admin/admin${NC}')
else:
    print('${GREEN}✓ Superuser already exists${NC}')
END
echo ""

# Check if port is in use
echo -e "${BLUE}Checking port 20001...${NC}"
if lsof -Pi :20001 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${RED}✗ Port 20001 is already in use${NC}"
    echo -e "${YELLOW}  Process using the port:${NC}"
    lsof -Pi :20001 -sTCP:LISTEN
    echo ""
    echo -e "${YELLOW}  Kill the process? (y/n)${NC}"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        lsof -ti:20001 | xargs kill -9
        echo -e "${GREEN}✓ Process killed${NC}"
    else
        echo -e "${RED}✗ Startup cancelled${NC}"
        exit 1
    fi
fi
echo -e "${GREEN}✓ Port 20001 is available${NC}"
echo ""

# Display information
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  Starting Python Django Backend...${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "${BLUE}Access URLs:${NC}"
echo -e "  ${GREEN}API:${NC}        http://localhost:20001/api/"
echo -e "  ${GREEN}Admin:${NC}      http://localhost:20001/admin/"
echo -e "  ${GREEN}Username:${NC}   admin"
echo -e "  ${GREEN}Password:${NC}   admin"
echo ""
echo -e "${BLUE}Port Configuration:${NC}"
echo -e "  ${GREEN}Python Backend:${NC}   20001"
echo -e "  ${GREEN}Node.js Backend:${NC}  20002"
echo -e "  ${GREEN}PostgreSQL:${NC}       5432"
echo -e "  ${GREEN}Redis:${NC}            6379"
echo -e "  ${GREEN}Qdrant:${NC}           6333"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop the server${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""

# Start the server
python manage.py runserver 0.0.0.0:20001
