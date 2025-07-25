import { Injectable } from '@/utils/decorators';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env files in priority order: backend-specific first, then root
const backendEnvPath = path.resolve(__dirname, '../../.env');
const rootEnvPath = path.resolve(__dirname, '../../../.env');

// Load root .env first (as base)
dotenv.config({ path: rootEnvPath });
// Load backend .env second (overrides root values)
dotenv.config({ path: backendEnvPath, override: true });

console.log('Config Service: Loading environment from:');
console.log('  Root .env:', rootEnvPath);
console.log('  Backend .env:', backendEnvPath);

@Injectable()
export class ConfigService {
  private config: Record<string, string> = {};

  constructor() {
    this.loadEnvironmentVariables();

    // Debug: Log loaded API key configuration
    console.log('Config Service: Loaded configuration:');
    console.log(
      '  OPENAI_API_KEY:',
      this.config.OPENAI_API_KEY ? `${this.config.OPENAI_API_KEY.substring(0, 20)}...` : 'NOT SET'
    );
    console.log('  OPENAI_BASE_URL:', this.config.OPENAI_BASE_URL || 'NOT SET');
    console.log('  OPENAI_MODEL:', this.config.OPENAI_MODEL || 'NOT SET');
  }

  public resetToEnvironmentDefaults(): void {
    console.log('Config Service: Resetting to environment defaults');
    this.loadEnvironmentVariables();
    console.log('Config Service: Reset complete');
    console.log(
      '  OPENAI_API_KEY:',
      this.config.OPENAI_API_KEY ? `${this.config.OPENAI_API_KEY.substring(0, 20)}...` : 'NOT SET'
    );
    console.log('  OPENAI_BASE_URL:', this.config.OPENAI_BASE_URL || 'NOT SET');
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
    console.log('Config Service: Updating OpenAI configuration:');
    console.log(
      '  Previous API Key:',
      this.config.OPENAI_API_KEY ? `${this.config.OPENAI_API_KEY.substring(0, 20)}...` : 'NOT SET'
    );
    console.log('  New API Key:', apiKey ? `${apiKey.substring(0, 20)}...` : 'NOT SET');
    console.log('  Previous Base URL:', this.config.OPENAI_BASE_URL || 'NOT SET');
    console.log('  New Base URL:', baseUrl !== undefined ? baseUrl || 'CLEARED' : 'NO CHANGE');

    if (apiKey) this.config.OPENAI_API_KEY = apiKey;
    // Allow empty string to clear the base URL
    if (baseUrl !== undefined) this.config.OPENAI_BASE_URL = baseUrl;
    // Allow empty string to clear the model
    if (model !== undefined) this.config.OPENAI_MODEL = model;

    console.log('Config Service: Updated values:');
    console.log(
      '  Final API Key:',
      this.config.OPENAI_API_KEY ? `${this.config.OPENAI_API_KEY.substring(0, 20)}...` : 'NOT SET'
    );
    console.log('  Final Base URL:', this.config.OPENAI_BASE_URL || 'NOT SET');
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
