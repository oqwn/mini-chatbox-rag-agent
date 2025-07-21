import { Pool } from 'pg';
import { Logger } from 'winston';

export interface Conversation {
  id?: number;
  sessionId: string;
  title?: string;
  memorySummary?: string;
  contextWindowSize?: number;
  messageCount?: number;
  lastActivity?: Date;
  isArchived?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Message {
  id?: number;
  conversationId: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, any>;
  tokenCount?: number;
  embedding?: number[];
  importanceScore?: number;
  isSummarized?: boolean;
  createdAt?: Date;
}

export interface ConversationSummary {
  id?: number;
  conversationId: number;
  summaryText: string;
  messageRangeStart?: number;
  messageRangeEnd?: number;
  tokenCount?: number;
  compressionRatio?: number;
  createdAt?: Date;
}

export interface MemoryCache {
  id?: number;
  cacheKey: string;
  cacheData: Record<string, any>;
  ttl: Date;
  createdAt?: Date;
}

export interface ContextWindow {
  id?: number;
  conversationId: number;
  windowStart: number;
  windowEnd: number;
  tokenCount: number;
  createdAt?: Date;
}

export interface MemoryPruningLog {
  id?: number;
  conversationId: number;
  action: 'summarize' | 'archive' | 'delete';
  messagesAffected: number;
  tokensSaved: number;
  createdAt?: Date;
}

export interface MemoryStats {
  totalConversations: number;
  activeConversations: number;
  archivedConversations: number;
  totalMessages: number;
  averageMessagesPerConversation: number;
  cacheEntries: number;
  totalTokensUsed: number;
}

export class ConversationMemoryService {
  private pool: Pool;
  private memoryCache: Map<string, { data: any; ttl: Date }>;

  constructor(private logger: Logger) {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'rag_chatbox',
      user: process.env.DB_USER || process.env.USER,
      password: process.env.DB_PASSWORD,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      options: '--client_encoding=UTF8',
    });

    this.memoryCache = new Map();
    this.testConnection();
    this.startCacheCleanup();
  }

  private async testConnection(): Promise<void> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      this.logger.info('Conversation memory database connection successful');
    } catch (error) {
      this.logger.error('Conversation memory database connection failed:', error);
      throw error;
    }
  }

  private startCacheCleanup(): void {
    // Clean expired cache entries every 5 minutes
    setInterval(
      () => {
        this.cleanExpiredCache();
      },
      5 * 60 * 1000
    );
  }

  // Conversation Management
  async createConversation(conversation: Omit<Conversation, 'id'>): Promise<number> {
    const query = `
      INSERT INTO conversations (session_id, title, memory_summary, context_window_size)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `;
    const values = [
      conversation.sessionId,
      conversation.title,
      conversation.memorySummary,
      conversation.contextWindowSize || 4000,
    ];

    const result = await this.pool.query(query, values);
    const conversationId = result.rows[0].id;
    this.logger.info(`Created conversation with ID: ${conversationId}`);
    return conversationId;
  }

  async getConversation(sessionId: string): Promise<Conversation | null> {
    const query = `
      SELECT id, session_id, title, memory_summary, context_window_size, 
             message_count, last_activity, is_archived, created_at, updated_at
      FROM conversations
      WHERE session_id = $1
    `;
    const result = await this.pool.query(query, [sessionId]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToConversation(result.rows[0]);
  }

  async getConversationById(id: number): Promise<Conversation | null> {
    const query = `
      SELECT id, session_id, title, memory_summary, context_window_size, 
             message_count, last_activity, is_archived, created_at, updated_at
      FROM conversations
      WHERE id = $1
    `;
    const result = await this.pool.query(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToConversation(result.rows[0]);
  }

  async getConversations(limit: number = 50, offset: number = 0): Promise<Conversation[]> {
    const query = `
      SELECT id, session_id, title, memory_summary, context_window_size, 
             message_count, last_activity, is_archived, created_at, updated_at
      FROM conversations
      WHERE is_archived = false
      ORDER BY last_activity DESC
      LIMIT $1 OFFSET $2
    `;
    const result = await this.pool.query(query, [limit, offset]);

    return result.rows.map((row) => this.mapRowToConversation(row));
  }

  async updateConversation(sessionId: string, updates: Partial<Conversation>): Promise<void> {
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (updates.title !== undefined) {
      updateFields.push(`title = $${paramCount++}`);
      values.push(updates.title);
    }
    if (updates.memorySummary !== undefined) {
      updateFields.push(`memory_summary = $${paramCount++}`);
      values.push(updates.memorySummary);
    }
    if (updates.contextWindowSize !== undefined) {
      updateFields.push(`context_window_size = $${paramCount++}`);
      values.push(updates.contextWindowSize);
    }
    if (updates.isArchived !== undefined) {
      updateFields.push(`is_archived = $${paramCount++}`);
      values.push(updates.isArchived);
    }

    if (updateFields.length === 0) {
      return;
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(sessionId);

    const query = `
      UPDATE conversations 
      SET ${updateFields.join(', ')}
      WHERE session_id = $${paramCount}
    `;

    await this.pool.query(query, values);
  }

  // Message Management
  async addMessage(message: Omit<Message, 'id'>): Promise<number> {
    const query = `
      INSERT INTO messages (conversation_id, role, content, metadata, token_count, 
                           embedding, importance_score, is_summarized)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `;
    const values = [
      message.conversationId,
      message.role,
      message.content,
      JSON.stringify(message.metadata || {}),
      message.tokenCount,
      message.embedding ? `[${message.embedding.join(',')}]` : null,
      message.importanceScore || 0.5,
      message.isSummarized || false,
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0].id;
  }

  async getMessages(conversationId: number, limit?: number, offset?: number): Promise<Message[]> {
    let query = `
      SELECT id, conversation_id, role, content, metadata, token_count,
             importance_score, is_summarized, created_at
      FROM messages
      WHERE conversation_id = $1
      ORDER BY created_at ASC
    `;
    const values: any[] = [conversationId];

    if (limit !== undefined) {
      query += ` LIMIT $2`;
      values.push(limit);
      if (offset !== undefined) {
        query += ` OFFSET $3`;
        values.push(offset);
      }
    }

    const result = await this.pool.query(query, values);
    return result.rows.map((row) => this.mapRowToMessage(row));
  }

  async getRecentMessages(conversationId: number, tokenLimit: number = 4000): Promise<Message[]> {
    const query = `
      WITH recent_messages AS (
        SELECT id, conversation_id, role, content, metadata, token_count,
               importance_score, is_summarized, created_at,
               SUM(COALESCE(token_count, LENGTH(content) / 4)) OVER (
                 ORDER BY created_at DESC
                 ROWS UNBOUNDED PRECEDING
               ) as running_token_count
        FROM messages
        WHERE conversation_id = $1
        ORDER BY created_at DESC
      )
      SELECT id, conversation_id, role, content, metadata, token_count,
             importance_score, is_summarized, created_at
      FROM recent_messages
      WHERE running_token_count <= $2
      ORDER BY created_at ASC
    `;

    const result = await this.pool.query(query, [conversationId, tokenLimit]);
    return result.rows.map((row) => this.mapRowToMessage(row));
  }

  async getImportantMessages(
    conversationId: number,
    importanceThreshold: number = 0.7,
    limit: number = 20
  ): Promise<Message[]> {
    const query = `
      SELECT id, conversation_id, role, content, metadata, token_count,
             importance_score, is_summarized, created_at
      FROM messages
      WHERE conversation_id = $1 AND importance_score >= $2
      ORDER BY importance_score DESC, created_at DESC
      LIMIT $3
    `;

    const result = await this.pool.query(query, [conversationId, importanceThreshold, limit]);
    return result.rows.map((row) => this.mapRowToMessage(row));
  }

  // Context Window Management
  async createContextWindow(contextWindow: Omit<ContextWindow, 'id'>): Promise<number> {
    const query = `
      INSERT INTO context_windows (conversation_id, window_start, window_end, token_count)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `;
    const values = [
      contextWindow.conversationId,
      contextWindow.windowStart,
      contextWindow.windowEnd,
      contextWindow.tokenCount,
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0].id;
  }

  async getActiveContextWindow(conversationId: number): Promise<ContextWindow | null> {
    const query = `
      SELECT id, conversation_id, window_start, window_end, token_count, created_at
      FROM context_windows
      WHERE conversation_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const result = await this.pool.query(query, [conversationId]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToContextWindow(result.rows[0]);
  }

  // Memory Summarization
  async createSummary(summary: Omit<ConversationSummary, 'id'>): Promise<number> {
    const query = `
      INSERT INTO conversation_summaries (conversation_id, summary_text, message_range_start, 
                                        message_range_end, token_count, compression_ratio)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;
    const values = [
      summary.conversationId,
      summary.summaryText,
      summary.messageRangeStart,
      summary.messageRangeEnd,
      summary.tokenCount,
      summary.compressionRatio,
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0].id;
  }

  async getSummaries(conversationId: number): Promise<ConversationSummary[]> {
    const query = `
      SELECT id, conversation_id, summary_text, message_range_start, message_range_end,
             token_count, compression_ratio, created_at
      FROM conversation_summaries
      WHERE conversation_id = $1
      ORDER BY created_at ASC
    `;
    const result = await this.pool.query(query, [conversationId]);

    return result.rows.map((row) => ({
      id: row.id,
      conversationId: row.conversation_id,
      summaryText: row.summary_text,
      messageRangeStart: row.message_range_start,
      messageRangeEnd: row.message_range_end,
      tokenCount: row.token_count,
      compressionRatio: row.compression_ratio,
      createdAt: row.created_at,
    }));
  }

  // Memory Cache (In-Memory + Persistent)
  async setCache(key: string, data: any, ttlMinutes: number = 60): Promise<void> {
    const ttl = new Date(Date.now() + ttlMinutes * 60 * 1000);

    // Store in memory cache
    this.memoryCache.set(key, { data, ttl });

    // Store in persistent cache
    const query = `
      INSERT INTO memory_cache (cache_key, cache_data, ttl)
      VALUES ($1, $2, $3)
      ON CONFLICT (cache_key) DO UPDATE SET
        cache_data = EXCLUDED.cache_data,
        ttl = EXCLUDED.ttl,
        created_at = CURRENT_TIMESTAMP
    `;
    await this.pool.query(query, [key, JSON.stringify(data), ttl]);
  }

  async getCache(key: string): Promise<any | null> {
    // Check memory cache first
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry && memoryEntry.ttl > new Date()) {
      return memoryEntry.data;
    }

    // Check persistent cache
    const query = `
      SELECT cache_data
      FROM memory_cache
      WHERE cache_key = $1 AND ttl > CURRENT_TIMESTAMP
    `;
    const result = await this.pool.query(query, [key]);

    if (result.rows.length === 0) {
      return null;
    }

    const data = result.rows[0].cache_data;

    // Update memory cache
    const ttl = new Date(Date.now() + 60 * 60 * 1000); // 1 hour default
    this.memoryCache.set(key, { data, ttl });

    return data;
  }

  private cleanExpiredCache(): void {
    const now = new Date();
    for (const [key, value] of this.memoryCache.entries()) {
      if (value.ttl <= now) {
        this.memoryCache.delete(key);
      }
    }

    // Clean persistent cache
    this.pool.query('SELECT clean_expired_cache()').catch((error) => {
      this.logger.error('Failed to clean expired cache:', error);
    });
  }

  // Memory Pruning
  async pruneOldMessages(
    conversationId: number,
    keepRecentCount: number = 50
  ): Promise<MemoryPruningLog> {
    const messagesQuery = `
      SELECT id FROM messages
      WHERE conversation_id = $1
      ORDER BY created_at DESC
      OFFSET $2
    `;
    const messagesToDelete = await this.pool.query(messagesQuery, [
      conversationId,
      keepRecentCount,
    ]);

    if (messagesToDelete.rows.length === 0) {
      return {
        conversationId,
        action: 'delete',
        messagesAffected: 0,
        tokensSaved: 0,
        createdAt: new Date(),
      };
    }

    const messageIds = messagesToDelete.rows.map((row) => row.id);

    // Calculate tokens saved
    const tokenQuery = `
      SELECT COALESCE(SUM(token_count), SUM(LENGTH(content) / 4)) as total_tokens
      FROM messages
      WHERE id = ANY($1)
    `;
    const tokenResult = await this.pool.query(tokenQuery, [messageIds]);
    const tokensSaved = parseInt(tokenResult.rows[0].total_tokens) || 0;

    // Delete old messages
    const deleteQuery = `DELETE FROM messages WHERE id = ANY($1)`;
    await this.pool.query(deleteQuery, [messageIds]);

    // Log the pruning action
    const logQuery = `
      INSERT INTO memory_pruning_log (conversation_id, action, messages_affected, tokens_saved)
      VALUES ($1, $2, $3, $4)
      RETURNING id, created_at
    `;
    const logResult = await this.pool.query(logQuery, [
      conversationId,
      'delete',
      messageIds.length,
      tokensSaved,
    ]);

    this.logger.info(
      `Pruned ${messageIds.length} messages from conversation ${conversationId}, saved ${tokensSaved} tokens`
    );

    return {
      id: logResult.rows[0].id,
      conversationId,
      action: 'delete',
      messagesAffected: messageIds.length,
      tokensSaved,
      createdAt: logResult.rows[0].created_at,
    };
  }

  // Statistics and Monitoring
  async getMemoryStats(): Promise<MemoryStats> {
    const query = `
      SELECT 
        (SELECT COUNT(*) FROM conversations) as total_conversations,
        (SELECT COUNT(*) FROM conversations WHERE is_archived = false) as active_conversations,
        (SELECT COUNT(*) FROM conversations WHERE is_archived = true) as archived_conversations,
        (SELECT COUNT(*) FROM messages) as total_messages,
        (SELECT AVG(message_count) FROM conversations WHERE message_count > 0) as avg_messages_per_conversation,
        (SELECT COUNT(*) FROM memory_cache WHERE ttl > CURRENT_TIMESTAMP) as cache_entries,
        (SELECT COALESCE(SUM(token_count), SUM(LENGTH(content) / 4)) FROM messages) as total_tokens
    `;

    const result = await this.pool.query(query);
    const row = result.rows[0];

    return {
      totalConversations: parseInt(row.total_conversations) || 0,
      activeConversations: parseInt(row.active_conversations) || 0,
      archivedConversations: parseInt(row.archived_conversations) || 0,
      totalMessages: parseInt(row.total_messages) || 0,
      averageMessagesPerConversation: parseFloat(row.avg_messages_per_conversation) || 0,
      cacheEntries: parseInt(row.cache_entries) || 0,
      totalTokensUsed: parseInt(row.total_tokens) || 0,
    };
  }

  // Helper Methods
  private mapRowToConversation(row: any): Conversation {
    return {
      id: row.id,
      sessionId: row.session_id,
      title: row.title,
      memorySummary: row.memory_summary,
      contextWindowSize: row.context_window_size,
      messageCount: row.message_count,
      lastActivity: row.last_activity,
      isArchived: row.is_archived,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapRowToMessage(row: any): Message {
    return {
      id: row.id,
      conversationId: row.conversation_id,
      role: row.role,
      content: row.content,
      metadata: row.metadata,
      tokenCount: row.token_count,
      importanceScore: row.importance_score,
      isSummarized: row.is_summarized,
      createdAt: row.created_at,
    };
  }

  private mapRowToContextWindow(row: any): ContextWindow {
    return {
      id: row.id,
      conversationId: row.conversation_id,
      windowStart: row.window_start,
      windowEnd: row.window_end,
      tokenCount: row.token_count,
      createdAt: row.created_at,
    };
  }

  async close(): Promise<void> {
    await this.pool.end();
    this.logger.info('Conversation memory database connection pool closed');
  }
}
