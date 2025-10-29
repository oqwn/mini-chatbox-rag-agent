-- Context Memory System Schema Extension
-- Extends existing schema with conversation memory features

-- Add memory-related columns to conversations table
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS memory_summary TEXT,
ADD COLUMN IF NOT EXISTS context_window_size INTEGER DEFAULT 4000,
ADD COLUMN IF NOT EXISTS message_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

-- Add memory-related columns to messages table  
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS token_count INTEGER,
ADD COLUMN IF NOT EXISTS embedding vector(1536),
ADD COLUMN IF NOT EXISTS importance_score FLOAT DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS is_summarized BOOLEAN DEFAULT false;

-- Conversation memory summaries table
CREATE TABLE IF NOT EXISTS conversation_summaries (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
    summary_text TEXT NOT NULL,
    message_range_start INTEGER,
    message_range_end INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    token_count INTEGER,
    compression_ratio FLOAT
);

-- Memory cache table for short-term storage
CREATE TABLE IF NOT EXISTS memory_cache (
    id SERIAL PRIMARY KEY,
    cache_key VARCHAR(255) UNIQUE NOT NULL,
    cache_data JSONB NOT NULL,
    ttl TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Context windows table to track conversation context
CREATE TABLE IF NOT EXISTS context_windows (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
    window_start INTEGER NOT NULL,
    window_end INTEGER NOT NULL,
    token_count INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Memory pruning log table
CREATE TABLE IF NOT EXISTS memory_pruning_log (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- 'summarize', 'archive', 'delete'
    messages_affected INTEGER,
    tokens_saved INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient memory operations
CREATE INDEX IF NOT EXISTS idx_conversations_last_activity ON conversations(last_activity);
CREATE INDEX IF NOT EXISTS idx_conversations_message_count ON conversations(message_count);
CREATE INDEX IF NOT EXISTS idx_conversations_is_archived ON conversations(is_archived);
CREATE INDEX IF NOT EXISTS idx_messages_importance_score ON messages(importance_score);
CREATE INDEX IF NOT EXISTS idx_messages_is_summarized ON messages(is_summarized);
CREATE INDEX IF NOT EXISTS idx_messages_embedding ON messages USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_conversation_summaries_conversation_id ON conversation_summaries(conversation_id);
CREATE INDEX IF NOT EXISTS idx_memory_cache_ttl ON memory_cache(ttl);
CREATE INDEX IF NOT EXISTS idx_context_windows_conversation_id ON context_windows(conversation_id);

-- Update trigger for conversations last_activity
CREATE OR REPLACE FUNCTION update_conversation_activity()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations 
    SET last_activity = CURRENT_TIMESTAMP,
        message_count = message_count + 1
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_conversation_activity_trigger ON messages;
CREATE TRIGGER update_conversation_activity_trigger
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_activity();

-- Function to clean expired cache entries
CREATE OR REPLACE FUNCTION clean_expired_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM memory_cache WHERE ttl < CURRENT_TIMESTAMP;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ language 'plpgsql';