import { Logger } from 'winston';
import { EmbeddingService } from './embedding.service';
import { LocalEmbeddingService } from './local-embedding.service';

// Define a common interface for all embedding services
export interface IEmbeddingService {
  generateEmbedding(request: {
    text: string;
    model?: string;
  }): Promise<{ embedding: number[]; tokenCount: number }>;
  generateBatchEmbeddings(request: {
    texts: string[];
    model?: string;
  }): Promise<{ embeddings: number[][]; tokenCounts: number[]; totalTokens: number }>;
  generateQueryEmbedding(query: string): Promise<{ embedding: number[]; tokenCount: number }>;
  isConfigured(): boolean;
  getModelInfo(): {
    provider: string;
    defaultModel: string;
    dimensions: number;
    maxTokens: number;
    isLocal?: boolean;
    requiresApiKey?: boolean;
  };
}

export class EmbeddingFactory {
  static createEmbeddingService(logger: Logger): IEmbeddingService {
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (openaiApiKey && openaiApiKey.trim()) {
      logger.info('Using OpenAI embedding service (API key provided)');
      try {
        return new EmbeddingService(logger);
      } catch (error) {
        logger.warn('Failed to initialize OpenAI embedding service, falling back to local:', error);
        return new LocalEmbeddingService(logger);
      }
    } else {
      logger.info('No OpenAI API key found, using local embedding service');
      return new LocalEmbeddingService(logger);
    }
  }
}
