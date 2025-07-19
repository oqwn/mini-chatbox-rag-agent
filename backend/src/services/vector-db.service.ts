import { Pool } from 'pg';
import { Logger } from 'winston';

export interface Document {
  id?: number;
  title?: string;
  content: string;
  metadata?: Record<string, any>;
  filePath?: string;
  fileType?: string;
  fileSize?: number;
  knowledgeSourceId?: number;
}

export interface DocumentChunk {
  id?: number;
  documentId: number;
  chunkText: string;
  chunkIndex: number;
  embedding?: number[];
  tokenCount?: number;
  metadata?: Record<string, any>;
}

export interface KnowledgeSource {
  id?: number;
  name: string;
  description?: string;
  sourceType: string;
  config?: Record<string, any>;
  isActive?: boolean;
}

export interface SimilaritySearchResult {
  id: number;
  documentId: number;
  chunkText: string;
  chunkIndex: number;
  similarity: number;
  documentTitle?: string;
  documentMetadata?: Record<string, any>;
  chunkMetadata?: Record<string, any>;
}

export class VectorDbService {
  private pool: Pool;

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
    });

    // Test connection
    this.testConnection();
  }

  private async testConnection(): Promise<void> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      this.logger.info('Vector database connection successful');
    } catch (error) {
      this.logger.error('Vector database connection failed:', error);
      throw error;
    }
  }

  // Knowledge Sources
  async createKnowledgeSource(source: KnowledgeSource): Promise<number> {
    const query = `
      INSERT INTO knowledge_sources (name, description, source_type, config, is_active)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;
    const values = [
      source.name,
      source.description,
      source.sourceType,
      JSON.stringify(source.config || {}),
      source.isActive ?? true,
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0].id;
  }

  async getKnowledgeSources(): Promise<KnowledgeSource[]> {
    const query = `
      SELECT id, name, description, source_type, config, is_active, created_at, updated_at
      FROM knowledge_sources
      WHERE is_active = true
      ORDER BY created_at DESC
    `;
    const result = await this.pool.query(query);
    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      sourceType: row.source_type,
      config: row.config,
      isActive: row.is_active,
    }));
  }

  // Documents
  async createDocument(document: Document): Promise<number> {
    const query = `
      INSERT INTO documents (title, content, metadata, file_path, file_type, file_size, knowledge_source_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `;
    const values = [
      document.title,
      document.content,
      JSON.stringify(document.metadata || {}),
      document.filePath,
      document.fileType,
      document.fileSize,
      document.knowledgeSourceId,
    ];

    const result = await this.pool.query(query, values);
    this.logger.info(`Created document with ID: ${result.rows[0].id}`);
    return result.rows[0].id;
  }

  async getDocument(id: number): Promise<Document | null> {
    const query = `
      SELECT id, title, content, metadata, file_path, file_type, file_size, knowledge_source_id
      FROM documents
      WHERE id = $1
    `;
    const result = await this.pool.query(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      title: row.title,
      content: row.content,
      metadata: row.metadata,
      filePath: row.file_path,
      fileType: row.file_type,
      fileSize: row.file_size,
      knowledgeSourceId: row.knowledge_source_id,
    };
  }

  async getDocuments(knowledgeSourceId?: number): Promise<Document[]> {
    let query = `
      SELECT id, title, content, metadata, file_path, file_type, file_size, knowledge_source_id
      FROM documents
    `;
    const values: any[] = [];

    if (knowledgeSourceId) {
      query += ' WHERE knowledge_source_id = $1';
      values.push(knowledgeSourceId);
    }

    query += ' ORDER BY created_at DESC';

    const result = await this.pool.query(query, values);
    return result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      metadata: row.metadata,
      filePath: row.file_path,
      fileType: row.file_type,
      fileSize: row.file_size,
      knowledgeSourceId: row.knowledge_source_id,
    }));
  }

  // Document Chunks
  async createDocumentChunk(chunk: DocumentChunk): Promise<number> {
    const query = `
      INSERT INTO document_chunks (document_id, chunk_text, chunk_index, embedding, token_count, metadata)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;
    const values = [
      chunk.documentId,
      chunk.chunkText,
      chunk.chunkIndex,
      chunk.embedding ? `[${chunk.embedding.join(',')}]` : null,
      chunk.tokenCount,
      JSON.stringify(chunk.metadata || {}),
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0].id;
  }

  // Batch insert for better performance with large documents
  async createDocumentChunksBatch(chunks: DocumentChunk[]): Promise<number[]> {
    if (chunks.length === 0) return [];

    // Build batch insert query with proper parameter placeholders
    const valueStrings: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const chunk of chunks) {
      valueStrings.push(
        `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5})`
      );
      values.push(
        chunk.documentId,
        chunk.chunkText,
        chunk.chunkIndex,
        chunk.embedding ? `[${chunk.embedding.join(',')}]` : null,
        chunk.tokenCount,
        JSON.stringify(chunk.metadata || {})
      );
      paramIndex += 6;
    }

    const query = `
      INSERT INTO document_chunks (document_id, chunk_text, chunk_index, embedding, token_count, metadata)
      VALUES ${valueStrings.join(', ')}
      RETURNING id
    `;

    try {
      const result = await this.pool.query(query, values);
      return result.rows.map((row) => row.id);
    } catch (error) {
      this.logger.error('Batch insert failed, falling back to individual inserts:', error);
      // Fallback to individual inserts if batch fails
      const ids: number[] = [];
      for (const chunk of chunks) {
        const id = await this.createDocumentChunk(chunk);
        ids.push(id);
      }
      return ids;
    }
  }

  async updateChunkEmbedding(chunkId: number, embedding: number[]): Promise<void> {
    const query = `
      UPDATE document_chunks
      SET embedding = $1
      WHERE id = $2
    `;
    await this.pool.query(query, [`[${embedding.join(',')}]`, chunkId]);
  }

  // Batch update embeddings for better performance
  async updateChunkEmbeddingsBatch(chunkIds: number[], embeddings: number[][]): Promise<void> {
    if (chunkIds.length !== embeddings.length) {
      throw new Error('ChunkIds and embeddings arrays must have the same length');
    }

    if (chunkIds.length === 0) return;

    try {
      // Use CASE statement for batch update
      const caseStatements = chunkIds
        .map((_, index) => `WHEN id = $${index * 2 + 1} THEN $${index * 2 + 2}`)
        .join(' ');

      const values: any[] = [];
      for (let i = 0; i < chunkIds.length; i++) {
        values.push(chunkIds[i], `[${embeddings[i].join(',')}]`);
      }
      values.push(...chunkIds); // For the WHERE clause

      const query = `
        UPDATE document_chunks 
        SET embedding = CASE 
          ${caseStatements}
        END 
        WHERE id IN (${chunkIds.map((_, i) => `$${chunkIds.length * 2 + 1 + i}`).join(', ')})
      `;

      await this.pool.query(query, values);
    } catch (error) {
      this.logger.error(
        'Batch embedding update failed, falling back to individual updates:',
        error
      );
      // Fallback to individual updates
      for (let i = 0; i < chunkIds.length; i++) {
        await this.updateChunkEmbedding(chunkIds[i], embeddings[i]);
      }
    }
  }

  async getDocumentChunks(documentId: number): Promise<DocumentChunk[]> {
    const query = `
      SELECT id, document_id, chunk_text, chunk_index, token_count, metadata
      FROM document_chunks
      WHERE document_id = $1
      ORDER BY chunk_index ASC
    `;
    const result = await this.pool.query(query, [documentId]);

    return result.rows.map((row) => ({
      id: row.id,
      documentId: row.document_id,
      chunkText: row.chunk_text,
      chunkIndex: row.chunk_index,
      tokenCount: row.token_count,
      metadata: row.metadata,
    }));
  }

  // Vector Similarity Search
  async similaritySearch(
    queryEmbedding: number[],
    limit: number = 5,
    threshold: number = 0.7,
    knowledgeSourceId?: number
  ): Promise<SimilaritySearchResult[]> {
    let query = `
      SELECT 
        dc.id,
        dc.document_id,
        dc.chunk_text,
        dc.chunk_index,
        dc.metadata as chunk_metadata,
        d.title as document_title,
        d.metadata as document_metadata,
        1 - (dc.embedding <=> $1) as similarity
      FROM document_chunks dc
      JOIN documents d ON dc.document_id = d.id
    `;

    const values: any[] = [`[${queryEmbedding.join(',')}]`];
    let paramCount = 1;

    if (knowledgeSourceId) {
      paramCount++;
      query += ` WHERE d.knowledge_source_id = $${paramCount}`;
      values.push(knowledgeSourceId);
    }

    query += `
      ORDER BY dc.embedding <=> $1
      LIMIT $${paramCount + 1}
    `;
    values.push(limit);

    const result = await this.pool.query(query, values);

    return result.rows
      .filter((row) => row.similarity >= threshold)
      .map((row) => ({
        id: row.id,
        documentId: row.document_id,
        chunkText: row.chunk_text,
        chunkIndex: row.chunk_index,
        similarity: parseFloat(row.similarity),
        documentTitle: row.document_title,
        documentMetadata: row.document_metadata,
        chunkMetadata: row.chunk_metadata,
      }));
  }

  // Hybrid search combining keyword and vector search
  async hybridSearch(
    queryText: string,
    queryEmbedding: number[],
    limit: number = 5,
    vectorWeight: number = 0.7,
    keywordWeight: number = 0.3,
    knowledgeSourceId?: number
  ): Promise<SimilaritySearchResult[]> {
    let query = `
      SELECT 
        dc.id,
        dc.document_id,
        dc.chunk_text,
        dc.chunk_index,
        dc.metadata as chunk_metadata,
        d.title as document_title,
        d.metadata as document_metadata,
        (
          $3 * (1 - (dc.embedding <=> $1)) +
          $4 * ts_rank_cd(to_tsvector('english', dc.chunk_text), plainto_tsquery('english', $2))
        ) as combined_score
      FROM document_chunks dc
      JOIN documents d ON dc.document_id = d.id
    `;

    const values: any[] = [`[${queryEmbedding.join(',')}]`, queryText, vectorWeight, keywordWeight];
    let paramCount = 4;

    if (knowledgeSourceId) {
      paramCount++;
      query += ` WHERE d.knowledge_source_id = $${paramCount}`;
      values.push(knowledgeSourceId);
    }

    query += `
      ORDER BY combined_score DESC
      LIMIT $${paramCount + 1}
    `;
    values.push(limit);

    const result = await this.pool.query(query, values);

    return result.rows.map((row) => ({
      id: row.id,
      documentId: row.document_id,
      chunkText: row.chunk_text,
      chunkIndex: row.chunk_index,
      similarity: parseFloat(row.combined_score),
      documentTitle: row.document_title,
      documentMetadata: row.document_metadata,
      chunkMetadata: row.chunk_metadata,
    }));
  }

  // Cleanup and utility methods
  async deleteDocument(id: number): Promise<void> {
    const query = 'DELETE FROM documents WHERE id = $1';
    await this.pool.query(query, [id]);
    this.logger.info(`Deleted document with ID: ${id}`);
  }

  async getStats(): Promise<{
    documentsCount: number;
    chunksCount: number;
    knowledgeSourcesCount: number;
  }> {
    const statsQuery = `
      SELECT 
        (SELECT COUNT(*) FROM documents) as documents_count,
        (SELECT COUNT(*) FROM document_chunks) as chunks_count,
        (SELECT COUNT(*) FROM knowledge_sources WHERE is_active = true) as knowledge_sources_count
    `;

    const result = await this.pool.query(statsQuery);
    const row = result.rows[0];

    return {
      documentsCount: parseInt(row.documents_count),
      chunksCount: parseInt(row.chunks_count),
      knowledgeSourcesCount: parseInt(row.knowledge_sources_count),
    };
  }

  async close(): Promise<void> {
    await this.pool.end();
    this.logger.info('Vector database connection pool closed');
  }
}
