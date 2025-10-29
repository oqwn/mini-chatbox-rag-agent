import OpenAI from 'openai';
import { Logger } from 'winston';
import { ConfigService } from './config.service';

export interface EmbeddingRequest {
  text: string;
  model?: string;
}

export interface EmbeddingResponse {
  embedding: number[];
  tokenCount: number;
}

export interface BatchEmbeddingRequest {
  texts: string[];
  model?: string;
}

export interface BatchEmbeddingResponse {
  embeddings: number[][];
  tokenCounts: number[];
  totalTokens: number;
}

export class EmbeddingService {
  private openai: OpenAI;
  private defaultModel = 'text-embedding-3-small'; // 1536 dimensions, cost-effective
  private maxTokensPerRequest = 8191; // OpenAI limit for embeddings
  private maxTextsPerBatch = 100; // Reasonable batch size
  private _isConfigured = false;

  constructor(
    private configService: ConfigService,
    private logger: Logger
  ) {
    const config = this.configService.getOpenAIConfig();
    if (!config.apiKey || !config.apiKey.trim()) {
      throw new Error('OPENAI_API_KEY is required for OpenAI embedding service');
    }

    this.openai = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || undefined,
    });

    this._isConfigured = true;
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    try {
      const model = request.model || this.defaultModel;

      // Validate text length
      if (!request.text.trim()) {
        throw new Error('Text cannot be empty');
      }

      this.logger.debug(`Generating embedding for text (${request.text.length} chars)`);

      const response = await this.openai.embeddings.create({
        model,
        input: request.text,
        encoding_format: 'float',
      });

      if (!response.data || response.data.length === 0) {
        throw new Error('No embedding data received from OpenAI');
      }

      const embedding = response.data[0].embedding;
      const tokenCount = response.usage?.total_tokens || 0;

      this.logger.debug(
        `Generated embedding with ${embedding.length} dimensions, ${tokenCount} tokens`
      );

      return {
        embedding,
        tokenCount,
      };
    } catch (error) {
      this.logger.error('Failed to generate embedding:', error);
      throw new Error(
        `Embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate embeddings for multiple texts in batches
   */
  async generateBatchEmbeddings(request: BatchEmbeddingRequest): Promise<BatchEmbeddingResponse> {
    try {
      if (!request.texts || request.texts.length === 0) {
        throw new Error('Texts array cannot be empty');
      }

      const model = request.model || this.defaultModel;
      const validTexts = request.texts.filter((text) => text.trim().length > 0);

      if (validTexts.length === 0) {
        throw new Error('No valid texts provided');
      }

      this.logger.info(`Generating embeddings for ${validTexts.length} texts`);

      // Process in batches to respect API limits
      const batches = this.chunkArray(validTexts, this.maxTextsPerBatch);
      const allEmbeddings: number[][] = [];
      const allTokenCounts: number[] = [];
      let totalTokens = 0;

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        this.logger.debug(`Processing batch ${i + 1}/${batches.length} with ${batch.length} texts`);

        const response = await this.openai.embeddings.create({
          model,
          input: batch,
          encoding_format: 'float',
        });

        if (!response.data || response.data.length !== batch.length) {
          throw new Error(
            `Batch ${i + 1}: Expected ${batch.length} embeddings, got ${response.data?.length || 0}`
          );
        }

        // Collect embeddings and token counts
        response.data.forEach((item, index) => {
          allEmbeddings.push(item.embedding);
          allTokenCounts.push(this.estimateTokenCount(batch[index]));
        });

        totalTokens += response.usage?.total_tokens || 0;

        // Add delay between batches to respect rate limits
        if (i < batches.length - 1) {
          await this.delay(100); // 100ms delay between batches
        }
      }

      this.logger.info(`Generated ${allEmbeddings.length} embeddings using ${totalTokens} tokens`);

      return {
        embeddings: allEmbeddings,
        tokenCounts: allTokenCounts,
        totalTokens,
      };
    } catch (error) {
      this.logger.error('Failed to generate batch embeddings:', error);
      throw new Error(
        `Batch embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate embedding for query text (with potential preprocessing)
   */
  async generateQueryEmbedding(query: string, model?: string): Promise<EmbeddingResponse> {
    // Preprocess query for better retrieval
    const processedQuery = this.preprocessQuery(query);

    return this.generateEmbedding({
      text: processedQuery,
      model: model || this.defaultModel,
    });
  }

  /**
   * Check if the service is properly configured
   */
  isConfigured(): boolean {
    return this._isConfigured;
  }

  /**
   * Get embedding model information
   */
  getModelInfo(): {
    provider: string;
    defaultModel: string;
    dimensions: number;
    maxTokens: number;
    isLocal: boolean;
    requiresApiKey: boolean;
  } {
    const dimensions =
      this.defaultModel === 'text-embedding-3-small'
        ? 1536
        : this.defaultModel === 'text-embedding-3-large'
          ? 3072
          : 1536;

    return {
      provider: 'openai',
      defaultModel: this.defaultModel,
      dimensions,
      maxTokens: this.maxTokensPerRequest,
      isLocal: false,
      requiresApiKey: true,
    };
  }

  /**
   * Estimate token count for text (rough approximation)
   * Improved for international characters including Chinese
   */
  private estimateTokenCount(text: string): number {
    // More accurate estimation for mixed language content
    // Chinese characters: ~1 char = 1.5-2 tokens
    // English words: ~4 chars = 1 token
    const chineseCharCount = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const otherCharCount = text.length - chineseCharCount;

    const chineseTokens = Math.ceil(chineseCharCount * 1.8);
    const englishTokens = Math.ceil(otherCharCount / 4);

    return chineseTokens + englishTokens;
  }

  /**
   * Preprocess query text for better retrieval
   * Fixed to preserve Chinese characters and other Unicode text
   */
  private preprocessQuery(query: string): string {
    // Basic preprocessing - preserve Chinese and other Unicode characters
    return (
      query
        .trim()
        .toLowerCase()
        // Only remove specific punctuation, preserve Chinese and other Unicode characters
        .replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g, ' ')
        .replace(/\s+/g, ' ')
    ); // Normalize whitespace
  }

  /**
   * Chunk array into smaller arrays
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  static cosineSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same dimensions');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (norm1 * norm2);
  }

  /**
   * Validate embedding dimensions
   */
  static validateEmbedding(embedding: number[], expectedDimensions: number): boolean {
    return (
      Array.isArray(embedding) &&
      embedding.length === expectedDimensions &&
      embedding.every((num) => typeof num === 'number' && !isNaN(num))
    );
  }
}
