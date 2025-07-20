import { pipeline, env, FeatureExtractionPipeline } from '@xenova/transformers';
import { Logger } from 'winston';
import {
  EmbeddingRequest,
  EmbeddingResponse,
  BatchEmbeddingRequest,
  BatchEmbeddingResponse,
} from './embedding.service';

// Configure transformers to use local models cache
env.cacheDir = './models';
env.allowRemoteModels = true;
env.allowLocalModels = true;

export class LocalEmbeddingService {
  private pipeline: FeatureExtractionPipeline | null = null;
  private readonly defaultModel = 'Xenova/all-MiniLM-L6-v2'; // 384 dimensions, good for general use
  private readonly nativeDimensions = 384; // Native dimensions of the local model
  private readonly targetDimensions = 1536; // Target dimensions to match OpenAI (for database compatibility)
  private readonly maxTokensPerRequest = 512; // Model's context limit
  private readonly maxTextsPerBatch = 32; // Reasonable batch size for local processing

  constructor(private logger: Logger) {}

  /**
   * Initialize the embedding pipeline
   */
  private async initializePipeline(): Promise<void> {
    if (this.pipeline) return;

    try {
      this.logger.info(`Initializing local embedding model: ${this.defaultModel}`);

      // Create feature extraction pipeline
      this.pipeline = (await pipeline('feature-extraction', this.defaultModel, {
        revision: 'main',
        quantized: true, // Use quantized model for faster loading and less memory
      })) as FeatureExtractionPipeline;

      this.logger.info('Local embedding model initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize local embedding model:', error);
      throw new Error(
        `Failed to initialize local embedding model: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Check if the service is properly configured
   */
  isConfigured(): boolean {
    // Local embedding service is always configured since it doesn't require API keys
    // Return true as we can always initialize the local model
    return true;
  }

  /**
   * Get model information
   */
  getModelInfo() {
    return {
      provider: 'local',
      defaultModel: this.defaultModel,
      dimensions: this.targetDimensions, // Padded to match database schema
      nativeDimensions: this.nativeDimensions, // Original model dimensions
      maxTokens: this.maxTokensPerRequest,
      isLocal: true,
      requiresApiKey: false,
    };
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    try {
      await this.initializePipeline();

      if (!this.pipeline) {
        throw new Error('Embedding pipeline not initialized');
      }

      // Validate text length
      if (!request.text.trim()) {
        throw new Error('Text cannot be empty');
      }

      // Truncate text if too long
      let text = request.text.trim();
      const estimatedTokens = this.estimateTokenCount(text);

      if (estimatedTokens > this.maxTokensPerRequest) {
        // Rough truncation - could be improved with proper tokenization
        const charLimit = this.maxTokensPerRequest * 4;
        text = text.substring(0, charLimit);
        this.logger.warn(
          `Text truncated from ${estimatedTokens} to ~${this.maxTokensPerRequest} tokens`
        );
      }

      // Generate embedding
      const output = await this.pipeline(text, { pooling: 'mean', normalize: true });

      // Extract embedding array
      let embedding: number[];
      if (Array.isArray(output)) {
        embedding = output as number[];
      } else if (output && typeof output === 'object' && 'data' in output) {
        embedding = Array.from(output.data as Float32Array);
      } else {
        throw new Error('Unexpected output format from embedding model');
      }

      // Pad or truncate embedding to match target dimensions
      const paddedEmbedding = this.padEmbedding(embedding);

      return {
        embedding: paddedEmbedding,
        tokenCount: this.estimateTokenCount(text),
      };
    } catch (error) {
      this.logger.error('Failed to generate embedding:', error);
      throw new Error(
        `Embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async generateBatchEmbeddings(request: BatchEmbeddingRequest): Promise<BatchEmbeddingResponse> {
    try {
      await this.initializePipeline();

      if (!this.pipeline) {
        throw new Error('Embedding pipeline not initialized');
      }

      if (!request.texts.length) {
        return {
          embeddings: [],
          tokenCounts: [],
          totalTokens: 0,
        };
      }

      // Process texts in smaller batches to avoid memory issues
      const batchSize = Math.min(this.maxTextsPerBatch, request.texts.length);
      const embeddings: number[][] = [];
      const tokenCounts: number[] = [];
      let totalTokens = 0;

      for (let i = 0; i < request.texts.length; i += batchSize) {
        const batch = request.texts.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map((text) => this.generateEmbedding({ text }))
        );

        for (const result of batchResults) {
          embeddings.push(result.embedding); // Already padded by generateEmbedding
          tokenCounts.push(result.tokenCount);
          totalTokens += result.tokenCount;
        }

        // Add small delay between batches to prevent overwhelming the system
        if (i + batchSize < request.texts.length) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      }

      this.logger.info(
        `Generated ${embeddings.length} embeddings with ${totalTokens} total tokens`
      );

      return {
        embeddings,
        tokenCounts,
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
   * Generate query embedding (same as regular embedding for this model)
   */
  async generateQueryEmbedding(query: string): Promise<EmbeddingResponse> {
    const preprocessedQuery = this.preprocessQuery(query);
    return this.generateEmbedding({ text: preprocessedQuery });
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
   * Pad or truncate embedding to match target dimensions for database compatibility
   */
  private padEmbedding(embedding: number[]): number[] {
    if (embedding.length === this.targetDimensions) {
      return embedding;
    }

    if (embedding.length > this.targetDimensions) {
      // Truncate if longer than target
      return embedding.slice(0, this.targetDimensions);
    }

    // Pad with zeros if shorter than target
    const padded = new Array(this.targetDimensions).fill(0);
    for (let i = 0; i < embedding.length; i++) {
      padded[i] = embedding[i];
    }

    // Normalize the padded embedding to maintain unit length
    const magnitude = Math.sqrt(padded.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < padded.length; i++) {
        padded[i] /= magnitude;
      }
    }

    return padded;
  }
}
