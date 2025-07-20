import { Logger } from 'winston';
import { ConfigService } from './config.service';
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
  static createEmbeddingService(configService: ConfigService, logger: Logger): IEmbeddingService {
    const openaiConfig = configService.getOpenAIConfig();
    const openaiApiKey = openaiConfig.apiKey;

    // Enhanced validation to catch more placeholder patterns
    const isValidApiKey =
      openaiApiKey &&
      openaiApiKey.trim() &&
      openaiApiKey.length > 20 && // Valid OpenAI keys are much longer
      openaiApiKey.startsWith('sk-') &&
      !openaiApiKey.includes('your-') &&
      !openaiApiKey.includes('***') &&
      !openaiApiKey.includes('placeholder') &&
      !openaiApiKey.includes('here') &&
      !/sk-[a-zA-Z0-9*]{10,20}here/.test(openaiApiKey); // Pattern like "sk-ope************here"

    if (isValidApiKey) {
      logger.info('Using OpenAI embedding service (valid API key provided)');
      try {
        return new EmbeddingService(configService, logger);
      } catch (error) {
        logger.warn('Failed to initialize OpenAI embedding service, falling back to local:', error);
        return new LocalEmbeddingService(logger);
      }
    } else {
      if (openaiApiKey && openaiApiKey.trim()) {
        logger.info(
          `Invalid or placeholder OpenAI API key detected (${openaiApiKey.substring(0, 10)}...), using local embedding service`
        );
      } else {
        logger.info('No OpenAI API key found, using local embedding service');
      }
      return new LocalEmbeddingService(logger);
    }
  }
}
