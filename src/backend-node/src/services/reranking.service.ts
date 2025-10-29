import { Logger } from 'winston';

// Common interfaces for reranking
export interface RerankingRequest {
  query: string;
  documents: RerankingDocument[];
  topK?: number;
}

export interface RerankingDocument {
  id: string | number;
  text: string;
  title?: string;
  metadata?: Record<string, any>;
  originalScore?: number;
}

export interface RerankingResult {
  id: string | number;
  text: string;
  title?: string;
  metadata?: Record<string, any>;
  rerankScore: number;
  originalScore?: number;
  rank: number;
}

export interface RerankingResponse {
  results: RerankingResult[];
  processingTime: number;
  method: string;
  query: string;
}

// Base interface for all reranking services
export interface IRerankingService {
  rerank(request: RerankingRequest): Promise<RerankingResponse>;
  isConfigured(): boolean;
  getServiceInfo(): {
    provider: string;
    method: string;
    isLocal: boolean;
    requiresApiKey?: boolean;
    maxDocuments?: number;
  };
}

/**
 * Local reranking service using algorithmic approaches
 * Implements multiple ranking algorithms without requiring external models
 */
export class LocalRerankingService implements IRerankingService {
  constructor(private logger: Logger) {}

  isConfigured(): boolean {
    return true; // Local service is always configured
  }

  getServiceInfo() {
    return {
      provider: 'local',
      method: 'hybrid-algorithm',
      isLocal: true,
      requiresApiKey: false,
      maxDocuments: 100,
    };
  }

  async rerank(request: RerankingRequest): Promise<RerankingResponse> {
    const startTime = Date.now();

    try {
      this.logger.debug(
        `Reranking ${request.documents.length} documents for query: ${request.query.substring(0, 100)}...`
      );

      // Apply multiple ranking algorithms
      const scoredDocuments = request.documents.map((doc, index) => {
        const scores = {
          lexical: this.calculateLexicalScore(request.query, doc.text),
          semantic: this.calculateSemanticProximityScore(request.query, doc.text),
          position: this.calculatePositionScore(index, request.documents.length),
          length: this.calculateLengthScore(doc.text),
          title: this.calculateTitleScore(request.query, doc.title || ''),
          bm25: this.calculateBM25Score(request.query, doc.text, request.documents),
        };

        // Weighted combination of scores
        const rerankScore = this.combineScores(scores, doc.originalScore || 0);

        return {
          id: doc.id,
          text: doc.text,
          title: doc.title,
          metadata: doc.metadata,
          rerankScore,
          originalScore: doc.originalScore,
          rank: 0, // Will be set after sorting
        };
      });

      // Sort by rerank score and assign ranks
      const sortedResults = scoredDocuments
        .sort((a, b) => b.rerankScore - a.rerankScore)
        .map((doc, index) => ({ ...doc, rank: index + 1 }));

      // Limit results if topK is specified
      const finalResults = request.topK ? sortedResults.slice(0, request.topK) : sortedResults;

      const processingTime = Date.now() - startTime;

      this.logger.debug(`Reranked ${request.documents.length} documents in ${processingTime}ms`);

      return {
        results: finalResults,
        processingTime,
        method: 'local-hybrid',
        query: request.query,
      };
    } catch (error) {
      this.logger.error('Local reranking failed:', error);
      throw new Error(
        `Local reranking failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Calculate lexical similarity score using character/word overlap
   */
  private calculateLexicalScore(query: string, text: string): number {
    const queryLower = query.toLowerCase();
    const textLower = text.toLowerCase();

    // Handle Chinese and English text differently
    const hasChineseQuery = /[\u4e00-\u9fff]/.test(queryLower);
    const hasChineseText = /[\u4e00-\u9fff]/.test(textLower);

    if (hasChineseQuery || hasChineseText) {
      return this.calculateChineseLexicalScore(queryLower, textLower);
    } else {
      return this.calculateEnglishLexicalScore(queryLower, textLower);
    }
  }

  private calculateChineseLexicalScore(query: string, text: string): number {
    // For Chinese text, use character-based matching
    const queryChars = Array.from(query).filter((char) => /[\u4e00-\u9fff]/.test(char));
    const textChars = Array.from(text);

    let matches = 0;
    for (const char of queryChars) {
      if (textChars.includes(char)) {
        matches++;
      }
    }

    return queryChars.length > 0 ? matches / queryChars.length : 0;
  }

  private calculateEnglishLexicalScore(query: string, text: string): number {
    // For English text, use word-based matching
    const queryWords = query.split(/\s+/).filter((word) => word.length > 2);
    const textWords = text.split(/\s+/);

    let matches = 0;
    for (const word of queryWords) {
      if (textWords.some((textWord) => textWord.includes(word) || word.includes(textWord))) {
        matches++;
      }
    }

    return queryWords.length > 0 ? matches / queryWords.length : 0;
  }

  /**
   * Calculate semantic proximity using simple heuristics
   */
  private calculateSemanticProximityScore(query: string, text: string): number {
    // Simple semantic scoring based on term proximity and co-occurrence
    const queryTerms = this.extractTerms(query);
    const textTerms = this.extractTerms(text);

    if (queryTerms.length === 0) return 0;

    let proximityScore = 0;
    const maxDistance = 50; // Maximum distance for term proximity

    for (let i = 0; i < queryTerms.length; i++) {
      for (let j = i + 1; j < queryTerms.length; j++) {
        const term1 = queryTerms[i];
        const term2 = queryTerms[j];

        const pos1 = textTerms.indexOf(term1);
        const pos2 = textTerms.indexOf(term2);

        if (pos1 !== -1 && pos2 !== -1) {
          const distance = Math.abs(pos1 - pos2);
          if (distance <= maxDistance) {
            proximityScore += 1 / (1 + distance);
          }
        }
      }
    }

    return proximityScore / ((queryTerms.length * (queryTerms.length - 1)) / 2);
  }

  /**
   * Calculate position-based score (earlier results get higher scores)
   */
  private calculatePositionScore(position: number, totalResults: number): number {
    return 1 - position / totalResults;
  }

  /**
   * Calculate length-based score (prefer optimal length documents)
   */
  private calculateLengthScore(text: string): number {
    const optimalLength = 800; // Optimal character count
    const length = text.length;

    if (length === 0) return 0;

    // Penalty for documents that are too short or too long
    const lengthRatio = length / optimalLength;
    if (lengthRatio <= 1) {
      return lengthRatio; // Linear increase up to optimal
    } else {
      return 1 / lengthRatio; // Decrease for longer texts
    }
  }

  /**
   * Calculate title relevance score
   */
  private calculateTitleScore(query: string, title: string): number {
    if (!title) return 0;

    const titleScore = this.calculateLexicalScore(query, title);
    return titleScore * 2; // Title matches are weighted higher
  }

  /**
   * Calculate BM25 score (simplified implementation)
   */
  private calculateBM25Score(
    query: string,
    text: string,
    allDocuments: RerankingDocument[]
  ): number {
    const k1 = 1.2;
    const b = 0.75;

    const queryTerms = this.extractTerms(query);
    const docTerms = this.extractTerms(text);
    const docLength = docTerms.length;

    // Calculate average document length
    const avgDocLength =
      allDocuments.reduce((sum, doc) => sum + this.extractTerms(doc.text).length, 0) /
      allDocuments.length;

    let bm25Score = 0;

    for (const term of queryTerms) {
      const tf = docTerms.filter((t) => t === term).length; // Term frequency
      const df = allDocuments.filter((doc) => this.extractTerms(doc.text).includes(term)).length; // Document frequency

      if (df === 0) continue;

      const idf = Math.log((allDocuments.length - df + 0.5) / (df + 0.5));
      const tfComponent = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (docLength / avgDocLength)));

      bm25Score += idf * tfComponent;
    }

    return Math.max(0, bm25Score);
  }

  /**
   * Combine multiple scores with weights
   */
  private combineScores(scores: Record<string, number>, originalScore: number): number {
    const weights = {
      lexical: 0.25,
      semantic: 0.2,
      position: 0.05,
      length: 0.05,
      title: 0.15,
      bm25: 0.2,
      original: 0.1,
    };

    let combinedScore = 0;
    for (const [scoreType, score] of Object.entries(scores)) {
      combinedScore += (weights[scoreType as keyof typeof weights] || 0) * score;
    }

    // Add original score with weight
    combinedScore += weights.original * originalScore;

    return Math.min(Math.max(combinedScore, 0), 1);
  }

  /**
   * Extract terms from text for analysis
   */
  private extractTerms(text: string): string[] {
    const cleanText = text.toLowerCase().replace(/[^\w\u4e00-\u9fff\s]/g, ' ');

    // Handle Chinese and English differently
    if (/[\u4e00-\u9fff]/.test(cleanText)) {
      // For Chinese, extract individual characters and common words
      return Array.from(cleanText).filter((char) => /[\u4e00-\u9fff\w]/.test(char));
    } else {
      // For English, extract words
      return cleanText.split(/\s+/).filter((word) => word.length > 1);
    }
  }
}

/**
 * Remote reranking service for external reranking models (e.g., localhost, API endpoints)
 */
export class RemoteRerankingService implements IRerankingService {
  private endpoint: string;
  private apiKey?: string;
  private maxRetries = 3;
  private timeout = 10000; // 10 seconds

  constructor(
    private logger: Logger,
    endpoint?: string,
    apiKey?: string
  ) {
    this.endpoint = endpoint || process.env.RERANK_ENDPOINT || 'http://localhost:8080/rerank';
    this.apiKey = apiKey || process.env.RERANK_API_KEY;
  }

  isConfigured(): boolean {
    // Check if endpoint is reachable (simplified check)
    return (
      (!!this.endpoint && !this.endpoint.includes('localhost')) || this.isLocalEndpointAvailable()
    );
  }

  private isLocalEndpointAvailable(): boolean {
    // In a real implementation, you might want to ping the endpoint
    // For now, assume localhost endpoints are available if configured
    return this.endpoint.includes('localhost');
  }

  getServiceInfo() {
    return {
      provider: 'remote',
      method: 'neural-reranker',
      isLocal: this.endpoint.includes('localhost'),
      requiresApiKey: !!this.apiKey,
      maxDocuments: 1000,
    };
  }

  async rerank(request: RerankingRequest): Promise<RerankingResponse> {
    const startTime = Date.now();

    try {
      this.logger.debug(
        `Remote reranking ${request.documents.length} documents via ${this.endpoint}`
      );

      const payload = {
        query: request.query,
        documents: request.documents.map((doc) => ({
          id: doc.id,
          text: doc.text,
          title: doc.title,
          metadata: doc.metadata,
        })),
        top_k: request.topK || request.documents.length,
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await this.fetchWithRetry(this.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Remote reranking failed: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as any;
      const processingTime = Date.now() - startTime;

      // Transform response to our format
      const results: RerankingResult[] =
        data.results?.map((result: any, index: number) => ({
          id: result.id,
          text: result.text || request.documents.find((d) => d.id === result.id)?.text || '',
          title: result.title,
          metadata: result.metadata,
          rerankScore: result.score || result.relevance_score || 0,
          originalScore: request.documents.find((d) => d.id === result.id)?.originalScore,
          rank: index + 1,
        })) || [];

      this.logger.debug(`Remote reranked ${results.length} documents in ${processingTime}ms`);

      return {
        results,
        processingTime,
        method: 'remote-neural',
        query: request.query,
      };
    } catch (error) {
      this.logger.error('Remote reranking failed, falling back to local:', error);

      // Fallback to local reranking
      const localService = new LocalRerankingService(this.logger);
      const localResult = await localService.rerank(request);

      return {
        ...localResult,
        method: 'local-fallback',
      };
    }
  }

  private async fetchWithRetry(url: string, options: RequestInit): Promise<Response> {
    let lastError: Error;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown fetch error');

        if (attempt < this.maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff
          this.logger.warn(
            `Rerank request failed (attempt ${attempt}), retrying in ${delay}ms:`,
            error
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError!;
  }
}
