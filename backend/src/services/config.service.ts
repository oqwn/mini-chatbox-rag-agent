import { Injectable } from '@/utils/decorators';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from root directory
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

@Injectable()
export class ConfigService {
  private config: Record<string, string> = {};

  constructor() {
    this.loadEnvironmentVariables();
  }

  private loadEnvironmentVariables(): void {
    this.config = {
      // Server config
      PORT: process.env.PORT || '3000',
      NODE_ENV: process.env.NODE_ENV || 'development',

      // Database config
      DATABASE_URL: process.env.DATABASE_URL || '',
      REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',

      // OpenAI config
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
      OPENAI_BASE_URL: process.env.OPENAI_BASE_URL || '',
      OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini',

      // RAG Embedding config
      EMBEDDING_MODEL: process.env.EMBEDDING_MODEL || '',
      EMBEDDING_ENDPOINT: process.env.EMBEDDING_ENDPOINT || '',

      // RAG Reranking config
      RERANK_ENDPOINT: process.env.RERANK_ENDPOINT || '',
      RERANK_API_KEY: process.env.RERANK_API_KEY || '',
      RERANK_FORCE_LOCAL: process.env.RERANK_FORCE_LOCAL || '',

      // CORS
      CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
    };
  }

  public get(key: string): string {
    return this.config[key] || '';
  }

  public set(key: string, value: string): void {
    this.config[key] = value;
  }

  public getAll(): Record<string, string> {
    return { ...this.config };
  }

  public updateOpenAIConfig(apiKey: string, baseUrl?: string, model?: string): void {
    if (apiKey) this.config.OPENAI_API_KEY = apiKey;
    // Allow empty string to clear the base URL
    if (baseUrl !== undefined) this.config.OPENAI_BASE_URL = baseUrl;
    // Allow empty string to clear the model
    if (model !== undefined) this.config.OPENAI_MODEL = model;
  }

  public getOpenAIConfig(): {
    apiKey: string;
    baseUrl: string;
    model: string;
  } {
    return {
      apiKey: this.config.OPENAI_API_KEY,
      baseUrl: this.config.OPENAI_BASE_URL,
      model: this.config.OPENAI_MODEL,
    };
  }

  public updateRagConfig(config: {
    embeddingModel?: string;
    embeddingEndpoint?: string;
    rerankEndpoint?: string;
    rerankApiKey?: string;
    rerankForceLocal?: string;
  }): void {
    if (config.embeddingModel !== undefined) this.config.EMBEDDING_MODEL = config.embeddingModel;
    if (config.embeddingEndpoint !== undefined)
      this.config.EMBEDDING_ENDPOINT = config.embeddingEndpoint;
    if (config.rerankEndpoint !== undefined) this.config.RERANK_ENDPOINT = config.rerankEndpoint;
    if (config.rerankApiKey !== undefined) this.config.RERANK_API_KEY = config.rerankApiKey;
    if (config.rerankForceLocal !== undefined)
      this.config.RERANK_FORCE_LOCAL = config.rerankForceLocal;
  }

  public getRagConfig(): {
    embeddingModel: string;
    embeddingEndpoint: string;
    rerankEndpoint: string;
    rerankApiKey: string;
    rerankForceLocal: string;
  } {
    return {
      embeddingModel: this.config.EMBEDDING_MODEL,
      embeddingEndpoint: this.config.EMBEDDING_ENDPOINT,
      rerankEndpoint: this.config.RERANK_ENDPOINT,
      rerankApiKey: this.config.RERANK_API_KEY,
      rerankForceLocal: this.config.RERANK_FORCE_LOCAL,
    };
  }
}
