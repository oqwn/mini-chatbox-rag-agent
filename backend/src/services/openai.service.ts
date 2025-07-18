import OpenAI from 'openai';
import { Injectable } from '@/utils/decorators';
import { ConfigService } from './config.service';
import { Logger } from 'winston';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

@Injectable()
export class OpenAIService {
  private client: OpenAI | null = null;
  private logger: Logger;

  constructor(
    private configService: ConfigService,
    logger: Logger
  ) {
    this.logger = logger;
    this.initializeClient();
  }

  private initializeClient(): void {
    const apiKey = this.configService.get('OPENAI_API_KEY');
    const baseURL = this.configService.get('OPENAI_BASE_URL');

    if (!apiKey) {
      this.logger.warn('OpenAI API key not configured');
      return;
    }

    this.client = new OpenAI({
      apiKey,
      baseURL: baseURL || undefined,
    });

    this.logger.info('OpenAI client initialized');
  }

  public updateConfiguration(apiKey: string, baseURL?: string): void {
    this.client = new OpenAI({
      apiKey,
      baseURL: baseURL || undefined,
    });
    this.logger.info('OpenAI client configuration updated');
  }

  public async chat(messages: ChatMessage[], options: ChatCompletionOptions = {}): Promise<string> {
    if (!this.client) {
      throw new Error('OpenAI client not initialized. Please configure API key.');
    }

    const {
      model = this.configService.get('OPENAI_MODEL') || 'gpt-4o-mini',
      temperature = 0.7,
      maxTokens = 1000,
    } = options;

    try {
      const completion = await this.client.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      });

      return completion.choices[0]?.message?.content || '';
    } catch (error) {
      this.logger.error('OpenAI chat error:', error);
      throw new Error(
        `Failed to get chat completion: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  public async *chatStream(
    messages: ChatMessage[],
    options: ChatCompletionOptions = {}
  ): AsyncGenerator<string, void, unknown> {
    if (!this.client) {
      throw new Error('OpenAI client not initialized. Please configure API key.');
    }

    const {
      model = this.configService.get('OPENAI_MODEL') || 'gpt-4o-mini',
      temperature = 0.7,
      maxTokens = 1000,
    } = options;

    try {
      const stream = await this.client.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }
    } catch (error) {
      this.logger.error('OpenAI stream error:', error);
      throw new Error(
        `Failed to get chat stream: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  public async getAvailableModels(): Promise<string[]> {
    // Static list as fallback
    const fallbackModels = [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-4-turbo-preview',
      'gpt-4',
      'gpt-3.5-turbo',
      'gpt-3.5-turbo-16k',
      'gpt-3.5-turbo-0125',
    ];

    if (!this.client) {
      this.logger.warn('Cannot fetch models - OpenAI client not initialized');
      return fallbackModels;
    }

    try {
      const models = await this.client.models.list();
      const chatModels = models.data
        .filter(model => model.id.includes('gpt') && !model.id.includes('instruct'))
        .map(model => model.id)
        .sort((a, b) => {
          // Sort models to put newer/better ones first
          const priority = ['gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'];
          const aIndex = priority.findIndex(p => a.startsWith(p));
          const bIndex = priority.findIndex(p => b.startsWith(p));
          if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
          if (aIndex !== -1) return -1;
          if (bIndex !== -1) return 1;
          return a.localeCompare(b);
        });

      return chatModels.length > 0 ? chatModels : fallbackModels;
    } catch (error) {
      this.logger.error('Failed to fetch models from OpenAI:', error);
      return fallbackModels;
    }
  }

  public isConfigured(): boolean {
    return this.client !== null;
  }
}
