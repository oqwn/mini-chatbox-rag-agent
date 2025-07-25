const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:20001';

export interface KnowledgeSource {
  id?: number;
  name: string;
  description?: string;
  sourceType: string;
  config?: Record<string, any>;
  isActive?: boolean;
}

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
  tokenCount?: number;
  metadata?: Record<string, any>;
}

export interface SearchResult {
  id: number;
  documentId: number;
  chunkText: string;
  chunkIndex: number;
  similarity: number;
  documentTitle?: string;
  documentMetadata?: Record<string, any>;
  chunkMetadata?: Record<string, any>;
  relevanceScore: number;
}

export interface ContextRetrievalResult {
  success: boolean;
  relevantChunks: SearchResult[];
  contextText: string;
  totalTokens: number;
  retrievalTime: number;
  searchMethod: 'vector' | 'hybrid';
  rerankingUsed: boolean;
  rerankingTime?: number;
  rerankingMethod?: string;
}

export interface IngestionResult {
  success: boolean;
  documentId: number;
  chunksCreated: number;
  totalTokens: number;
  processingTime: number;
}

export interface SystemInfo {
  database: {
    documentsCount: number;
    chunksCount: number;
    knowledgeSourcesCount: number;
  };
  embedding: {
    defaultModel: string;
    dimensions: number;
    maxTokens: number;
    isConfigured: boolean;
  };
  retrieval: {
    totalDocuments: number;
    totalChunks: number;
    averageChunkSize: number;
    embeddingCoverage: number;
    reranking: {
      isConfigured: boolean;
      provider: string;
      method: string;
      isLocal: boolean;
      requiresApiKey?: boolean;
    };
  };
  system: {
    status: string;
    timestamp: string;
  };
}

export interface RagConfiguration {
  embedding: {
    provider: string;
    model: string;
    isLocal: boolean;
    isConfigured: boolean;
    requiresApiKey: boolean;
    dimensions: number;
    environment: {
      OPENAI_API_KEY?: string;
      EMBEDDING_MODEL?: string;
      EMBEDDING_ENDPOINT?: string;
    };
  };
  reranking: {
    provider: string;
    method: string;
    isLocal: boolean;
    isConfigured: boolean;
    requiresApiKey: boolean;
    environment: {
      RERANK_ENDPOINT?: string;
      RERANK_API_KEY?: string;
      RERANK_FORCE_LOCAL?: string;
    };
  };
}

export interface ConfigurationUpdateRequest {
  embedding?: {
    OPENAI_API_KEY?: string;
    EMBEDDING_MODEL?: string;
    EMBEDDING_ENDPOINT?: string;
  };
  reranking?: {
    RERANK_ENDPOINT?: string;
    RERANK_API_KEY?: string;
    RERANK_FORCE_LOCAL?: string;
  };
}

class RagApiService {
  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${API_BASE_URL}/api/rag${endpoint}`;

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Knowledge Sources
  async createKnowledgeSource(
    source: Omit<KnowledgeSource, 'id'>
  ): Promise<{ id: number; message: string }> {
    return this.request('/knowledge-sources', {
      method: 'POST',
      body: JSON.stringify(source),
    });
  }

  async getKnowledgeSources(): Promise<{ sources: KnowledgeSource[] }> {
    return this.request('/knowledge-sources');
  }

  async deleteKnowledgeSource(id: number): Promise<{ message: string }> {
    return this.request(`/knowledge-sources/${id}`, {
      method: 'DELETE',
    });
  }

  // Document Ingestion
  async ingestText(
    content: string,
    title: string,
    knowledgeSourceId?: number,
    metadata?: Record<string, any>
  ): Promise<IngestionResult> {
    return this.request('/ingest/text', {
      method: 'POST',
      body: JSON.stringify({
        content,
        title,
        knowledgeSourceId,
        metadata,
      }),
    });
  }

  async uploadFile(
    file: File,
    knowledgeSourceId?: number,
    metadata?: Record<string, any>
  ): Promise<IngestionResult> {
    const formData = new FormData();
    formData.append('file', file);

    if (knowledgeSourceId) {
      formData.append('knowledgeSourceId', knowledgeSourceId.toString());
    }

    if (metadata) {
      formData.append('metadata', JSON.stringify(metadata));
    }

    const response = await fetch(`${API_BASE_URL}/api/rag/ingest/file`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Document Management
  async getDocuments(knowledgeSourceId?: number): Promise<{ documents: Document[] }> {
    const params = knowledgeSourceId ? `?knowledgeSourceId=${knowledgeSourceId}` : '';
    return this.request(`/documents${params}`);
  }

  async getDocument(id: number): Promise<{ document: Document }> {
    return this.request(`/documents/${id}`);
  }

  async deleteDocument(id: number): Promise<{ message: string }> {
    return this.request(`/documents/${id}`, {
      method: 'DELETE',
    });
  }

  async moveDocument(
    id: number,
    knowledgeSourceId: number | null
  ): Promise<{ message: string; documentId: number; knowledgeSourceId: number | null }> {
    return this.request(`/documents/${id}/move`, {
      method: 'PUT',
      body: JSON.stringify({ knowledgeSourceId }),
    });
  }

  async getDocumentChunks(id: number): Promise<{ chunks: DocumentChunk[] }> {
    return this.request(`/documents/${id}/chunks`);
  }

  // Search and Retrieval
  async search(
    query: string,
    options: {
      knowledgeSourceId?: number;
      maxResults?: number;
      similarityThreshold?: number;
      useHybridSearch?: boolean;
      contextWindowSize?: number;
      useReranking?: boolean;
      rerankTopK?: number;
    } = {}
  ): Promise<ContextRetrievalResult> {
    return this.request('/search', {
      method: 'POST',
      body: JSON.stringify({
        query,
        ...options,
      }),
    });
  }

  async similaritySearch(
    query: string,
    knowledgeSourceId?: number,
    limit: number = 5,
    threshold: number = 0.7
  ): Promise<{
    success: boolean;
    results: SearchResult[];
    query: string;
    resultsCount: number;
  }> {
    return this.request('/similarity-search', {
      method: 'POST',
      body: JSON.stringify({
        query,
        knowledgeSourceId,
        limit,
        threshold,
      }),
    });
  }

  // System Information
  async getSystemInfo(): Promise<SystemInfo> {
    return this.request('/info');
  }

  async healthCheck(): Promise<{
    status: string;
    timestamp: string;
    checks: Record<string, any>;
  }> {
    return this.request('/health');
  }

  // Configuration Management
  async getRagConfiguration(): Promise<{ success: boolean; configuration: RagConfiguration }> {
    return this.request('/config');
  }

  async updateRagConfiguration(config: ConfigurationUpdateRequest): Promise<{
    success: boolean;
    message: string;
    warnings?: string[];
  }> {
    return this.request('/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  }

  // Utility
  async generateEmbedding(text: string): Promise<{
    success: boolean;
    embedding: number[];
    dimensions: number;
    tokenCount: number;
  }> {
    return this.request('/embedding', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  }
}

export const ragApiService = new RagApiService();
