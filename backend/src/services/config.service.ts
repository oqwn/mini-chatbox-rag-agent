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
}
