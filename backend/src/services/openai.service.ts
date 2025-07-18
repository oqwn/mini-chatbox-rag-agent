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

interface ModelResponse {
  id: string;
  name?: string;
  [key: string]: unknown;
}

interface ModelsListResponse {
  data?: ModelResponse[];
  models?: ModelResponse[];
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
      this.logger.warn('API key not configured');
      return;
    }

    this.client = new OpenAI({
      apiKey,
      baseURL: baseURL || undefined,
    });

    this.logger.info('AI client initialized');
  }

  public updateConfiguration(apiKey: string, baseURL?: string): void {
    this.client = new OpenAI({
      apiKey,
      baseURL: baseURL || undefined,
    });
    this.logger.info('AI client configuration updated');
  }

  public async chat(messages: ChatMessage[], options: ChatCompletionOptions = {}): Promise<string> {
    if (!this.client) {
      throw new Error('AI client not initialized. Please configure API key.');
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
      this.logger.error('AI chat error:', error);
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
      throw new Error('AI client not initialized. Please configure API key.');
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
      this.logger.error('AI stream error:', error);
      throw new Error(
        `Failed to get chat stream: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  public async getAvailableModels(): Promise<string[]> {
    if (!this.client) {
      this.logger.warn('Cannot fetch models - AI client not initialized');
      return [];
    }

    const baseURL = this.configService.get('OPENAI_BASE_URL') || '';

    // Handle OpenRouter specifically
    if (baseURL.includes('openrouter.ai')) {
      try {
        const apiKey = this.configService.get('OPENAI_API_KEY');
        const response = await fetch('https://openrouter.ai/api/v1/models', {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = (await response.json()) as ModelsListResponse;
          const models = data.data || [];

          // Extract model IDs and sort by popularity/capability
          const openRouterModels = models
            .map((model: ModelResponse) => model.id)
            .filter((id: string) => {
              // Filter out non-chat models
              const lowerId = id.toLowerCase();
              return (
                !lowerId.includes('embed') &&
                !lowerId.includes('whisper') &&
                !lowerId.includes('tts') &&
                !lowerId.includes('dall-e')
              );
            })
            .sort((a: string, b: string) => {
              // Prioritize popular models
              const priorities = ['claude-3', 'gpt-4', 'gpt-3.5', 'mixtral', 'llama'];
              for (const priority of priorities) {
                const aHas = a.toLowerCase().includes(priority);
                const bHas = b.toLowerCase().includes(priority);
                if (aHas && !bHas) return -1;
                if (!aHas && bHas) return 1;
              }
              return a.localeCompare(b);
            });

          return openRouterModels.length > 0 ? openRouterModels : [];
        }
      } catch (error) {
        this.logger.error('Failed to fetch OpenRouter models:', error);
      }
    }

    // Handle local/custom endpoints
    else if (baseURL && !baseURL.includes('api.openai.com')) {
      try {
        const apiKey = this.configService.get('OPENAI_API_KEY');
        // Try OpenAI-compatible models endpoint
        const modelsUrl = baseURL.endsWith('/') ? `${baseURL}models` : `${baseURL}/models`;
        const response = await fetch(modelsUrl, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = (await response.json()) as ModelsListResponse;
          const models = data.data || data.models || [];

          if (Array.isArray(models)) {
            const modelIds = models
              .map((model: ModelResponse | string) =>
                typeof model === 'string' ? model : model.id || model.name
              )
              .filter((id): id is string => Boolean(id));

            return modelIds.length > 0 ? modelIds : [];
          }
        }
      } catch (error) {
        this.logger.error('Failed to fetch models from custom endpoint:', error);
      }
    }

    // Default OpenAI handling
    try {
      const models = await this.client.models.list();
      const chatModels = models.data
        .filter((model) => model.id.includes('gpt') && !model.id.includes('instruct'))
        .map((model) => model.id)
        .sort((a, b) => {
          // Sort models to put newer/better ones first
          const priority = ['gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'];
          const aIndex = priority.findIndex((p) => a.startsWith(p));
          const bIndex = priority.findIndex((p) => b.startsWith(p));
          if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
          if (aIndex !== -1) return -1;
          if (bIndex !== -1) return 1;
          return a.localeCompare(b);
        });

      return chatModels.length > 0 ? chatModels : [];
    } catch (error) {
      this.logger.error('Failed to fetch models from API:', error);
      return [];
    }
  }

  public isConfigured(): boolean {
    return this.client !== null;
  }
}
