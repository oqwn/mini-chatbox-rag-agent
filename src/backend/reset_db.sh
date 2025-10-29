#!/bin/bash

# ============================================
# PostgreSQL Database Reset Script
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
echo -e "${BLUE}  PostgreSQL Database Reset${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Load environment variables
if [ ! -f ".env" ]; then
    echo -e "${RED}✗ .env file not found${NC}"
    exit 1
fi

source .env

# Set defaults if not in .env
POSTGRES_HOST=${POSTGRES_HOST:-localhost}
POSTGRES_PORT=${POSTGRES_PORT:-5432}
POSTGRES_USER=${POSTGRES_USER:-chatbox}
POSTGRES_DB=${POSTGRES_DB:-rag_chatbox}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-chatbox_password}

echo -e "${YELLOW}⚠ WARNING: This will drop and recreate the database!${NC}"
echo -e "${YELLOW}  Database: ${POSTGRES_DB}${NC}"
echo -e "${YELLOW}  Host: ${POSTGRES_HOST}:${POSTGRES_PORT}${NC}"
echo ""
echo -e "${YELLOW}  All data will be lost!${NC}"
echo ""
echo -e "${GREEN}Auto-confirming database reset...${NC}"
echo ""

# Check if PostgreSQL is running
echo -e "${BLUE}Checking PostgreSQL service...${NC}"
if ! pg_isready -h ${POSTGRES_HOST} -p ${POSTGRES_PORT} &> /dev/null; then
    echo -e "${RED}✗ PostgreSQL is not running${NC}"
    echo -e "${YELLOW}  Please start PostgreSQL first:${NC}"
    echo -e "${YELLOW}  brew services start postgresql@15${NC}"
    echo -e "${YELLOW}  or${NC}"
    echo -e "${YELLOW}  docker run -d --name chatbox-postgres -p 5432:5432 -e POSTGRES_USER=chatbox -e POSTGRES_PASSWORD=chatbox_password -e POSTGRES_DB=rag_chatbox postgres:15${NC}"
    exit 1
fi
echo -e "${GREEN}✓ PostgreSQL is running${NC}"
echo ""

# Use postgres superuser for database operations
SUPERUSER=${SUPERUSER:-postgres}

# Terminate all connections to the database
echo -e "${BLUE}Terminating all connections to database...${NC}"
psql -h ${POSTGRES_HOST} -p ${POSTGRES_PORT} -U ${SUPERUSER} -d postgres -c "
SELECT pg_terminate_backend(pg_stat_activity.pid)
FROM pg_stat_activity
WHERE pg_stat_activity.datname = '${POSTGRES_DB}'
  AND pid <> pg_backend_pid();" 2>&1 | grep -v "NOTICE" || true
echo -e "${GREEN}✓ Connections terminated${NC}"
echo ""

# Drop existing database
echo -e "${BLUE}Dropping existing database...${NC}"
psql -h ${POSTGRES_HOST} -p ${POSTGRES_PORT} -U ${SUPERUSER} -d postgres -c "DROP DATABASE IF EXISTS ${POSTGRES_DB};" 2>&1 | grep -v "NOTICE" || true
echo -e "${GREEN}✓ Database dropped${NC}"
echo ""

# Create new database
echo -e "${BLUE}Creating new database...${NC}"
psql -h ${POSTGRES_HOST} -p ${POSTGRES_PORT} -U ${SUPERUSER} -d postgres -c "CREATE DATABASE ${POSTGRES_DB};" 2>&1 | grep -v "NOTICE" || true
echo -e "${GREEN}✓ Database created${NC}"
echo ""

# Grant privileges to application user
echo -e "${BLUE}Granting privileges to ${POSTGRES_USER}...${NC}"
psql -h ${POSTGRES_HOST} -p ${POSTGRES_PORT} -U ${SUPERUSER} -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE ${POSTGRES_DB} TO ${POSTGRES_USER};" 2>&1 | grep -v "NOTICE" || true
echo -e "${GREEN}✓ Privileges granted${NC}"
echo ""

# Run init.sql to create tables
if [ -f "init.sql" ]; then
    echo -e "${BLUE}Running init.sql to create tables...${NC}"
    psql -h ${POSTGRES_HOST} -p ${POSTGRES_PORT} -U ${POSTGRES_USER} -d ${POSTGRES_DB} -f init.sql 2>&1 | grep -v "NOTICE" || true
    echo -e "${GREEN}✓ Database tables created${NC}"
    echo ""
else
    echo -e "${YELLOW}⚠ init.sql not found, skipping table creation${NC}"
    echo ""
fi

# Activate virtual environment and run Django migrations
if [ -d "venv" ]; then
    echo -e "${BLUE}Activating virtual environment...${NC}"
    source venv/bin/activate

    # Mark custom app migrations as applied (since tables already exist)
    echo -e "${BLUE}Marking custom app migrations as applied...${NC}"
    for app in chat conversation rag mcp projects; do
        python manage.py migrate --fake $app 2>&1 | grep -v "NOTICE" || true
    done
    echo -e "${GREEN}✓ Custom app migrations marked as applied${NC}"
    echo ""

    # Create superuser
    echo -e "${BLUE}Creating superuser...${NC}"
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
else
    echo -e "${YELLOW}⚠ Virtual environment not found, skipping Django migrations${NC}"
    echo ""
fi

# Summary
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  Database Reset Complete!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "${BLUE}Database Details:${NC}"
echo -e "  ${GREEN}Host:${NC}     ${POSTGRES_HOST}:${POSTGRES_PORT}"
echo -e "  ${GREEN}Database:${NC} ${POSTGRES_DB}"
echo -e "  ${GREEN}User:${NC}     ${POSTGRES_USER}"
echo ""
echo -e "${BLUE}Admin Credentials:${NC}"
echo -e "  ${GREEN}Username:${NC} admin"
echo -e "  ${GREEN}Password:${NC} admin"
echo ""
echo -e "${BLUE}You can now start the backend:${NC}"
echo -e "  ${GREEN}./start-backend.sh${NC}"
echo -e "${GREEN}============================================${NC}"
