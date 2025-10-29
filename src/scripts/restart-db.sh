#!/bin/bash

# Database restart script for mini-chatbox-rag-agent

echo "🔄 Restarting database..."

# Database configuration
DB_NAME="rag_chatbox"
DB_USER="chatbox"
DB_PASSWORD="password"
DB_HOST="localhost"
DB_PORT="5432"

# Stop and restart PostgreSQL (adjust for your system)
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    brew services restart postgresql@14 || brew services restart postgresql
elif command -v systemctl &> /dev/null; then
    # Linux with systemd
    sudo systemctl restart postgresql
elif command -v service &> /dev/null; then
    # Linux with service
    sudo service postgresql restart
else
    echo "⚠️  Could not detect system type. Please restart PostgreSQL manually."
    exit 1
fi

echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 3

# Drop and recreate database
echo "🗑️  Dropping existing database..."
PGPASSWORD=$DB_PASSWORD dropdb -h $DB_HOST -p $DB_PORT -U postgres $DB_NAME 2>/dev/null || true

echo "✨ Creating fresh database..."
PGPASSWORD=$DB_PASSWORD createdb -h $DB_HOST -p $DB_PORT -U postgres $DB_NAME

# Create user if not exists
echo "👤 Setting up database user..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U postgres -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null || true
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"

# Apply all schemas in order
echo "📋 Applying database schemas..."
SQL_DIR="$(dirname "$0")/../backend/src/sql"

# Apply schemas in specific order
for schema in schema.sql memory-schema.sql projects-schema.sql; do
    if [ -f "$SQL_DIR/$schema" ]; then
        echo "  → Applying $schema..."
        PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$SQL_DIR/$schema"
    fi
done

echo "✅ Database restarted successfully!"
echo "📊 Database: $DB_NAME"
echo "👤 User: $DB_USER"
echo "🏠 Host: $DB_HOST:$DB_PORT"