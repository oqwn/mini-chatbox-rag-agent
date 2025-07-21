#!/bin/bash

# Database reset script - clears all data and reapplies schema

echo "🔄 Resetting database data..."

# Database configuration
DB_NAME="rag_chatbox"
DB_USER="chatbox"
DB_PASSWORD="password"
DB_HOST="localhost"

# Drop all tables
echo "🗑️  Dropping all tables..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME << EOF
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO $DB_USER;
GRANT ALL ON SCHEMA public TO public;
EOF

# Apply all schemas
echo "📋 Applying schemas..."
SQL_DIR="$(dirname "$0")/../backend/src/sql"

for schema in schema.sql memory-schema.sql projects-schema.sql; do
    if [ -f "$SQL_DIR/$schema" ]; then
        echo "  → Applying $schema..."
        PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f "$SQL_DIR/$schema"
    fi
done

echo "✅ Database reset complete!"