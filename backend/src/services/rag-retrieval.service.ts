import { Logger } from 'winston';
import { VectorDbService, SimilaritySearchResult } from './vector-db.service';
import { IEmbeddingService } from './embedding-factory.service';
import { IRerankingService, RerankingDocument } from './reranking.service';

export interface RetrievalQuery {
  query: string;
  knowledgeSourceId?: number;
  maxResults?: number;
  similarityThreshold?: number;
  useHybridSearch?: boolean;
  contextWindowSize?: number;
  useReranking?: boolean;
  rerankTopK?: number;
}

export interface RetrievalResult {
  relevantChunks: EnrichedChunk[];
  contextText: string;
  totalTokens: number;
  retrievalTime: number;
  searchMethod: 'vector' | 'hybrid';
  rerankingUsed: boolean;
  rerankingTime?: number;
  rerankingMethod?: string;
}

export interface EnrichedChunk {
  id: number;
  documentId: number;
  chunkText: string;
  chunkIndex: number;
  similarity: number;
  documentTitle?: string;
  documentMetadata?: Record<string, any>;
  chunkMetadata?: Record<string, any>;
  relevanceScore: number;
  contextBefore?: string;
  contextAfter?: string;
  rerankScore?: number;
  originalRank?: number;
  finalRank?: number;
}

export interface RankingOptions {
  diversityWeight?: number;
  recencyWeight?: number;
  lengthWeight?: number;
  positionWeight?: number;
}

export class RagRetrievalService {
  private defaultOptions = {
    maxResults: 5,
    similarityThreshold: 0.3,
    useHybridSearch: true,
    contextWindowSize: 2, // Number of surrounding chunks to include for context
    vectorWeight: 0.7,
    keywordWeight: 0.3,
    useReranking: true,
    rerankTopK: 20, // Retrieve more candidates for reranking
  };

  constructor(
    private vectorDbService: VectorDbService,
    private embeddingService: IEmbeddingService,
    private rerankingService: IRerankingService,
    private logger: Logger
  ) {}

  /**
   * Retrieve relevant context for a query
   */
  async retrieveContext(query: RetrievalQuery): Promise<RetrievalResult> {
    const startTime = Date.now();
    let rerankingTime = 0;
    let rerankingMethod = '';
    const useReranking = query.useReranking !== false && this.defaultOptions.useReranking;

    try {
      this.logger.debug(`Retrieving context for query: ${query.query.substring(0, 100)}...`);

      // Generate query embedding
      const queryEmbedding = await this.embeddingService.generateQueryEmbedding(query.query);

      // Determine how many results to retrieve initially
      const initialMaxResults = useReranking
        ? Math.max(
            query.rerankTopK || this.defaultOptions.rerankTopK,
            (query.maxResults || this.defaultOptions.maxResults) * 2
          )
        : query.maxResults || this.defaultOptions.maxResults;

      // Perform search
      const searchMethod = query.useHybridSearch !== false ? 'hybrid' : 'vector';
      let searchResults: SimilaritySearchResult[];

      if (searchMethod === 'hybrid') {
        searchResults = await this.vectorDbService.hybridSearch(
          query.query,
          queryEmbedding.embedding,
          initialMaxResults,
          this.defaultOptions.vectorWeight,
          this.defaultOptions.keywordWeight,
          query.knowledgeSourceId
        );
      } else {
        searchResults = await this.vectorDbService.similaritySearch(
          queryEmbedding.embedding,
          initialMaxResults,
          query.similarityThreshold || this.defaultOptions.similarityThreshold,
          query.knowledgeSourceId
        );
      }

      // Enrich chunks with additional context and relevance scoring
      let enrichedChunks = await this.enrichChunks(searchResults, query);

      // Apply reranking if enabled and configured
      if (useReranking && enrichedChunks.length > 1) {
        const rerankStart = Date.now();

        try {
          enrichedChunks = await this.applyReranking(enrichedChunks, query);
          rerankingTime = Date.now() - rerankStart;
          rerankingMethod = this.rerankingService.getServiceInfo().method;

          this.logger.debug(
            `Reranked ${enrichedChunks.length} chunks in ${rerankingTime}ms using ${rerankingMethod}`
          );
        } catch (error) {
          this.logger.warn('Reranking failed, using original ranking:', error);
          rerankingTime = Date.now() - rerankStart;
          rerankingMethod = 'failed-fallback';
        }
      }

      // Apply traditional ranking and diversity if no reranking was used
      if (!useReranking || enrichedChunks.length <= 1) {
        enrichedChunks = this.rankChunks(enrichedChunks, query);
      }

      // Limit to final maxResults
      const finalMaxResults = query.maxResults || this.defaultOptions.maxResults;
      const rankedChunks = enrichedChunks.slice(0, finalMaxResults);

      // Generate context text
      const contextText = this.generateContextText(rankedChunks);
      const totalTokens = this.estimateTokenCount(contextText);

      const retrievalTime = Date.now() - startTime;

      this.logger.debug(
        `Retrieved ${rankedChunks.length} chunks (${totalTokens} tokens) in ${retrievalTime}ms`
      );

      return {
        relevantChunks: rankedChunks,
        contextText,
        totalTokens,
        retrievalTime,
        searchMethod,
        rerankingUsed: useReranking && rerankingTime > 0,
        rerankingTime: rerankingTime || undefined,
        rerankingMethod: rerankingMethod || undefined,
      };
    } catch (error) {
      this.logger.error('Failed to retrieve context:', error);
      throw new Error(
        `Context retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Apply reranking to enriched chunks
   */
  private async applyReranking(
    enrichedChunks: EnrichedChunk[],
    query: RetrievalQuery
  ): Promise<EnrichedChunk[]> {
    // Convert enriched chunks to reranking documents
    const rerankingDocs: RerankingDocument[] = enrichedChunks.map((chunk) => ({
      id: chunk.id,
      text: chunk.chunkText,
      title: chunk.documentTitle,
      metadata: {
        ...chunk.chunkMetadata,
        documentMetadata: chunk.documentMetadata,
        chunkIndex: chunk.chunkIndex,
        documentId: chunk.documentId,
      },
      originalScore: chunk.relevanceScore,
    }));

    // Perform reranking
    const rerankResponse = await this.rerankingService.rerank({
      query: query.query,
      documents: rerankingDocs,
      topK: query.maxResults || this.defaultOptions.maxResults,
    });

    // Map reranked results back to enriched chunks
    const rerankedChunks: EnrichedChunk[] = [];

    for (const rerankResult of rerankResponse.results) {
      const originalChunk = enrichedChunks.find((chunk) => chunk.id === rerankResult.id);
      if (originalChunk) {
        rerankedChunks.push({
          ...originalChunk,
          rerankScore: rerankResult.rerankScore,
          originalRank: enrichedChunks.findIndex((chunk) => chunk.id === rerankResult.id) + 1,
          finalRank: rerankResult.rank,
        });
      }
    }

    return rerankedChunks;
  }

  /**
   * Enrich chunks with additional context and metadata
   */
  private async enrichChunks(
    searchResults: SimilaritySearchResult[],
    query: RetrievalQuery
  ): Promise<EnrichedChunk[]> {
    const enrichedChunks: EnrichedChunk[] = [];
    const contextWindowSize = query.contextWindowSize || this.defaultOptions.contextWindowSize;

    for (const result of searchResults) {
      // Get surrounding chunks for context
      const surroundingChunks = await this.getSurroundingChunks(
        result.documentId,
        result.chunkIndex,
        contextWindowSize
      );

      // Calculate relevance score
      const relevanceScore = this.calculateRelevanceScore(result, query);

      const enriched: EnrichedChunk = {
        id: result.id,
        documentId: result.documentId,
        chunkText: result.chunkText,
        chunkIndex: result.chunkIndex,
        similarity: result.similarity,
        documentTitle: result.documentTitle,
        documentMetadata: result.documentMetadata,
        chunkMetadata: result.chunkMetadata,
        relevanceScore,
        contextBefore: surroundingChunks.before,
        contextAfter: surroundingChunks.after,
      };

      enrichedChunks.push(enriched);
    }

    return enrichedChunks;
  }

  /**
   * Get surrounding chunks for context
   */
  private async getSurroundingChunks(
    documentId: number,
    chunkIndex: number,
    windowSize: number
  ): Promise<{ before?: string; after?: string }> {
    try {
      const allChunks = await this.vectorDbService.getDocumentChunks(documentId);

      const beforeChunks = allChunks
        .filter(
          (chunk) => chunk.chunkIndex < chunkIndex && chunk.chunkIndex >= chunkIndex - windowSize
        )
        .sort((a, b) => a.chunkIndex - b.chunkIndex)
        .map((chunk) => chunk.chunkText);

      const afterChunks = allChunks
        .filter(
          (chunk) => chunk.chunkIndex > chunkIndex && chunk.chunkIndex <= chunkIndex + windowSize
        )
        .sort((a, b) => a.chunkIndex - b.chunkIndex)
        .map((chunk) => chunk.chunkText);

      return {
        before: beforeChunks.length > 0 ? beforeChunks.join(' ') : undefined,
        after: afterChunks.length > 0 ? afterChunks.join(' ') : undefined,
      };
    } catch (error) {
      this.logger.warn(`Failed to get surrounding chunks for document ${documentId}:`, error);
      return {};
    }
  }

  /**
   * Calculate relevance score combining multiple factors
   */
  private calculateRelevanceScore(
    result: SimilaritySearchResult,
    query: RetrievalQuery,
    options: RankingOptions = {}
  ): number {
    const { recencyWeight = 0.1, lengthWeight = 0.1, positionWeight = 0.1 } = options;

    let score = result.similarity * 0.6; // Base similarity score (60% weight)

    // Length factor (prefer chunks with reasonable length)
    const idealLength = 500; // characters
    const lengthFactor = 1 - Math.abs(result.chunkText.length - idealLength) / idealLength;
    score += lengthFactor * lengthWeight;

    // Position factor (prefer chunks from beginning of document)
    const positionFactor = 1 / (1 + result.chunkIndex * 0.1);
    score += positionFactor * positionWeight;

    // Document metadata factors
    if (result.documentMetadata) {
      // Recency factor
      if (result.documentMetadata.ingestedAt) {
        const ingestedDate = new Date(result.documentMetadata.ingestedAt);
        const daysSinceIngestion = (Date.now() - ingestedDate.getTime()) / (1000 * 60 * 60 * 24);
        const recencyFactor = Math.exp(-daysSinceIngestion / 30); // Decay over 30 days
        score += recencyFactor * recencyWeight;
      }
    }

    // Keyword matching boost - improved for Chinese text
    const queryLower = query.query.toLowerCase();
    const chunkLower = result.chunkText.toLowerCase();

    // Handle both space-separated words (English) and character-based matching (Chinese)
    const hasChineseChars = /[\u4e00-\u9fff]/.test(queryLower);

    let keywordMatches = 0;
    let totalTerms = 0;

    if (hasChineseChars) {
      // For Chinese text, use character-based matching
      const chineseChars = queryLower.match(/[\u4e00-\u9fff]/g) || [];
      totalTerms = chineseChars.length;
      keywordMatches = chineseChars.filter((char) => chunkLower.includes(char)).length;
    } else {
      // For English text, use word-based matching
      const words = queryLower.split(' ').filter((word) => word.length > 2);
      totalTerms = words.length;
      keywordMatches = words.filter((word) => chunkLower.includes(word)).length;
    }

    score += (keywordMatches / Math.max(totalTerms, 1)) * 0.1;

    return Math.min(Math.max(score, 0), 1); // Clamp between 0 and 1
  }

  /**
   * Rank chunks by relevance and apply diversity
   */
  private rankChunks(chunks: EnrichedChunk[], query: RetrievalQuery): EnrichedChunk[] {
    // Sort by relevance score
    let rankedChunks = chunks.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Apply diversity to avoid too many chunks from the same document
    rankedChunks = this.applyDiversity(rankedChunks);

    // Limit results
    const maxResults = query.maxResults || this.defaultOptions.maxResults;
    return rankedChunks.slice(0, maxResults);
  }

  /**
   * Apply diversity to avoid over-representation from single documents
   */
  private applyDiversity(chunks: EnrichedChunk[]): EnrichedChunk[] {
    const documentChunkCounts = new Map<number, number>();
    const maxChunksPerDocument = 2; // Maximum chunks from same document
    const diversifiedChunks: EnrichedChunk[] = [];

    for (const chunk of chunks) {
      const currentCount = documentChunkCounts.get(chunk.documentId) || 0;

      if (currentCount < maxChunksPerDocument) {
        diversifiedChunks.push(chunk);
        documentChunkCounts.set(chunk.documentId, currentCount + 1);
      }
    }

    // If we have room and there are remaining chunks, add the best ones
    const remainingChunks = chunks.filter(
      (chunk) => !diversifiedChunks.some((dc) => dc.id === chunk.id)
    );

    for (const chunk of remainingChunks) {
      if (diversifiedChunks.length >= chunks.length * 0.8) break; // Don't exceed 80% of original
      diversifiedChunks.push(chunk);
    }

    return diversifiedChunks;
  }

  /**
   * Generate context text from ranked chunks
   */
  private generateContextText(chunks: EnrichedChunk[]): string {
    if (chunks.length === 0) {
      return '';
    }

    const contextParts: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      let chunkContext = '';

      // Add document title if available and different from previous
      if (chunk.documentTitle && (i === 0 || chunks[i - 1].documentTitle !== chunk.documentTitle)) {
        chunkContext += `\n[Source: ${chunk.documentTitle}]\n`;
      }

      // Add context before if available
      if (chunk.contextBefore) {
        chunkContext += `...${chunk.contextBefore} `;
      }

      // Add main chunk text
      chunkContext += chunk.chunkText;

      // Add context after if available
      if (chunk.contextAfter) {
        chunkContext += ` ${chunk.contextAfter}...`;
      }

      contextParts.push(chunkContext);
    }

    return contextParts.join('\n\n---\n\n');
  }

  /**
   * Get retrieval statistics
   */
  async getRetrievalStats(): Promise<{
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
  }> {
    const stats = await this.vectorDbService.getStats();

    // Get embedding coverage (chunks with embeddings)
    // This would require a custom query to count chunks with non-null embeddings
    // For now, we'll assume 100% coverage
    const embeddingCoverage = 1.0;

    // Average chunk size would also require a custom query
    const averageChunkSize = 500; // Estimate

    // Get reranking service info
    const rerankingInfo = this.rerankingService.getServiceInfo();

    return {
      totalDocuments: stats.documentsCount,
      totalChunks: stats.chunksCount,
      averageChunkSize,
      embeddingCoverage,
      reranking: {
        isConfigured: this.rerankingService.isConfigured(),
        provider: rerankingInfo.provider,
        method: rerankingInfo.method,
        isLocal: rerankingInfo.isLocal,
        requiresApiKey: rerankingInfo.requiresApiKey,
      },
    };
  }

  /**
   * Estimate token count
   */
  private estimateTokenCount(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Test retrieval with a sample query
   */
  async testRetrieval(query: string): Promise<{
    success: boolean;
    results: number;
    time: number;
    error?: string;
  }> {
    try {
      const startTime = Date.now();
      const result = await this.retrieveContext({
        query,
        maxResults: 3,
        similarityThreshold: 0.5,
      });
      const time = Date.now() - startTime;

      return {
        success: true,
        results: result.relevantChunks.length,
        time,
      };
    } catch (error) {
      return {
        success: false,
        results: 0,
        time: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
