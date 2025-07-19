# RAG (Retrieval-Augmented Generation) System

## Overview

The RAG system provides intelligent document retrieval and context generation for the chatbox using vector similarity search. It combines semantic search with traditional keyword matching to find the most relevant information.

## Architecture

### Components

1. **Vector Database**: PostgreSQL with pgvector extension
2. **Embedding Service**: OpenAI text-embedding-3-small (1536 dimensions)
3. **Document Ingestion**: Text chunking and embedding generation
4. **Similarity Search**: Hybrid vector + keyword search
5. **Context Retrieval**: Relevance ranking and context generation

### Database Schema

```sql
- documents: Store original documents with metadata
- document_chunks: Store text chunks with embeddings
- knowledge_sources: Organize documents by source
- conversations: Track chat sessions
- messages: Store conversation history
```

## Installation & Setup

### Prerequisites

1. **PostgreSQL with pgvector**:
   ```bash
   brew install pgvector
   brew services start postgresql@14
   createdb rag_chatbox
   psql rag_chatbox -c "CREATE EXTENSION vector;"
   ```

2. **Environment Variables**:
   ```bash
   OPENAI_API_KEY=your_openai_api_key
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=rag_chatbox
   DB_USER=your_username
   ```

3. **Database Schema**:
   ```bash
   psql rag_chatbox -f backend/src/sql/schema.sql
   ```

## API Endpoints

### Knowledge Sources
- `POST /api/rag/knowledge-sources` - Create a knowledge source
- `GET /api/rag/knowledge-sources` - List all knowledge sources

### Document Ingestion
- `POST /api/rag/ingest/text` - Ingest text content
- `POST /api/rag/ingest/file` - Upload and ingest file

### Document Management
- `GET /api/rag/documents` - List documents
- `GET /api/rag/documents/:id` - Get specific document
- `DELETE /api/rag/documents/:id` - Delete document
- `GET /api/rag/documents/:id/chunks` - Get document chunks

### Search & Retrieval
- `POST /api/rag/search` - Full RAG retrieval with context
- `POST /api/rag/similarity-search` - Basic similarity search

### System
- `GET /api/rag/health` - Health check
- `GET /api/rag/info` - System information
- `POST /api/rag/embedding` - Generate embedding for text

## Usage Examples

### 1. Create Knowledge Source

```javascript
POST /api/rag/knowledge-sources
{
  \"name\": \"Company Docs\",
  \"description\": \"Internal company documentation\",
  \"sourceType\": \"file\",
  \"config\": {}
}
```

### 2. Ingest Text Document

```javascript
POST /api/rag/ingest/text
{
  \"content\": \"This is the document content...\",
  \"title\": \"Document Title\",
  \"knowledgeSourceId\": 1,
  \"metadata\": {
    \"author\": \"John Doe\",
    \"category\": \"technical\"
  }
}
```

### 3. Upload File

```bash
curl -X POST http://localhost:3001/api/rag/ingest/file \\
  -F \"file=@document.txt\" \\
  -F \"knowledgeSourceId=1\" \\
  -F \"metadata={\\\"category\\\":\\\"manual\\\"}\"
```

### 4. Search for Relevant Context

```javascript
POST /api/rag/search
{
  \"query\": \"How to configure the system?\",
  \"maxResults\": 5,
  \"similarityThreshold\": 0.7,
  \"useHybridSearch\": true,
  \"contextWindowSize\": 2
}
```

Response:
```javascript
{
  \"success\": true,
  \"relevantChunks\": [...],
  \"contextText\": \"[Source: Manual]\\n\\nTo configure the system...\",
  \"totalTokens\": 1250,
  \"retrievalTime\": 45,
  \"searchMethod\": \"hybrid\"
}
```

## Features

### Document Processing
- **Text Chunking**: Intelligent splitting with overlap
- **Multiple Formats**: Support for .txt, .md, .json, .csv, .log files
- **Metadata Preservation**: Custom metadata support
- **Batch Processing**: Directory ingestion

### Search Capabilities
- **Vector Similarity**: Semantic search using embeddings
- **Hybrid Search**: Combines vector + keyword search
- **Context Windows**: Include surrounding chunks
- **Relevance Ranking**: Multi-factor scoring algorithm

### Ranking Factors
1. **Similarity Score** (60%): Vector cosine similarity
2. **Keyword Matching** (10%): Traditional text matching
3. **Length Factor** (10%): Prefer optimal chunk lengths
4. **Position Factor** (10%): Earlier chunks ranked higher
5. **Recency Factor** (10%): Newer documents preferred

### Context Generation
- **Document Grouping**: Group chunks by source
- **Context Expansion**: Include before/after chunks
- **Diversity**: Limit chunks per document
- **Formatting**: Clean markdown output with sources

## Configuration

### Chunking Options
```javascript
{
  chunkSize: 500,        // tokens per chunk
  chunkOverlap: 50,      // overlap in tokens
  separators: ['\\n\\n', '\\n', '. ', '! ', '? ']
}
```

### Search Options
```javascript
{
  maxResults: 5,
  similarityThreshold: 0.7,
  useHybridSearch: true,
  contextWindowSize: 2,
  vectorWeight: 0.7,
  keywordWeight: 0.3
}
```

## Performance Considerations

### Vector Indexing
- Uses IVFFlat index for fast similarity search
- Index created automatically with 100 lists
- Performance improves with more data

### Embedding Costs
- ~$0.02 per 1M tokens for text-embedding-3-small
- Batch processing for efficiency
- Caching to avoid re-processing

### Database Optimization
- Indexed columns for fast filtering
- Connection pooling
- Query optimization for large datasets

## Monitoring & Health

### Health Check
```bash
GET /api/rag/health
```

Returns:
- Database connectivity
- Embedding service status
- Retrieval system test

### System Information
```bash
GET /api/rag/info
```

Returns:
- Document/chunk counts
- Embedding model info
- System statistics

## Troubleshooting

### Common Issues

1. **Database Connection**:
   - Verify PostgreSQL is running
   - Check connection credentials
   - Ensure pgvector extension is installed

2. **Embedding Generation**:
   - Verify OpenAI API key
   - Check rate limits
   - Monitor token usage

3. **Search Results**:
   - Adjust similarity threshold
   - Try hybrid search
   - Check document ingestion

### Logs
- Check application logs for detailed error messages
- Database query logs for performance issues
- OpenAI API response logs for embedding issues

## Future Enhancements

1. **Advanced Retrieval**:
   - Multi-query expansion
   - Hypothetical document embeddings
   - Cross-encoder re-ranking

2. **Document Types**:
   - PDF processing
   - HTML/XML parsing
   - Image text extraction

3. **Optimization**:
   - Vector quantization
   - Caching layers
   - Async processing

4. **Analytics**:
   - Search analytics
   - Usage tracking
   - Performance metrics