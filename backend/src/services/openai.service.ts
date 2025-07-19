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
  tools?: any[];
  onToolCall?: (toolName: string, parameters: any) => Promise<any>;
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
      timeout: 10 * 60 * 1000, // 10 minutes timeout for long-running tool calls
      maxRetries: 0, // Don't retry on timeout
    });

    this.logger.info('AI client initialized with 10 minute timeout');
  }

  public updateConfiguration(apiKey: string, baseURL?: string): void {
    this.client = new OpenAI({
      apiKey,
      baseURL: baseURL || undefined,
      timeout: 10 * 60 * 1000, // 10 minutes timeout for long-running tool calls
      maxRetries: 0, // Don't retry on timeout
    });
    this.logger.info('AI client configuration updated with 10 minute timeout');
  }

  public async chat(messages: ChatMessage[], options: ChatCompletionOptions = {}): Promise<string> {
    if (!this.client) {
      throw new Error('AI client not initialized. Please configure API key.');
    }

    const {
      model = this.configService.get('OPENAI_MODEL') || 'gpt-4o-mini',
      temperature = 0.7,
      maxTokens = 1000,
      tools,
      onToolCall,
    } = options;

    try {
      // Convert MCP tools to OpenAI function format
      const functions = tools?.map((tool) => ({
        type: 'function' as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema || {
            type: 'object',
            properties: {},
          },
        },
      }));

      if (functions && functions.length > 0) {
        this.logger.info(
          `Sending ${functions.length} tools to AI:`,
          functions.map((f) => f.function.name)
        );
      }

      const requestParams: any = {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      };

      if (functions && functions.length > 0) {
        requestParams.tools = functions;
        requestParams.tool_choice = 'auto';
      }

      const completion = await this.client.chat.completions.create(requestParams);
      const message = completion.choices[0]?.message;

      if (!message) {
        return '';
      }

      // Handle tool calls
      if (message.tool_calls && message.tool_calls.length > 0 && onToolCall) {
        this.logger.info(
          `AI requested ${message.tool_calls.length} tool calls:`,
          message.tool_calls.map((tc) => tc.function.name)
        );
        const toolResults = await Promise.all(
          message.tool_calls.map(async (toolCall) => {
            try {
              const result = await onToolCall(
                toolCall.function.name,
                JSON.parse(toolCall.function.arguments)
              );
              return {
                tool_call_id: toolCall.id,
                role: 'tool' as const,
                content: JSON.stringify(result),
              };
            } catch (error) {
              return {
                tool_call_id: toolCall.id,
                role: 'tool' as const,
                content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              };
            }
          })
        );

        // Add the assistant's message with tool calls
        const updatedMessages = [
          ...messages,
          {
            role: 'assistant' as const,
            content: message.content || '',
            tool_calls: message.tool_calls,
          },
          ...toolResults,
        ];

        // Get the final response after tool execution
        const finalCompletion = await this.client.chat.completions.create({
          model,
          messages: updatedMessages as any,
          temperature,
          max_tokens: maxTokens,
        });

        return finalCompletion.choices[0]?.message?.content || '';
      }

      return message.content || '';
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
      tools,
    } = options;

    try {
      // For now, if tools are provided, use non-streaming approach
      // TODO: Implement proper streaming with tool support
      if (tools && tools.length > 0) {
        const result = await this.chat(messages, options);
        yield result;
        return;
      }

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

  public async testModelCapabilities(
    modelName: string
  ): Promise<{ supportsFunctionCalling: boolean }> {
    if (!this.client) {
      throw new Error('AI client not initialized. Please configure API key.');
    }

    // Create a minimal test to check if the model supports function calling
    // This test avoids actually executing tools to minimize cost
    const testTool = {
      type: 'function' as const,
      function: {
        name: 'test_capability',
        description: 'A test function to check if the model supports function calling',
        parameters: {
          type: 'object',
          properties: {
            test: {
              type: 'string',
              description: 'A test parameter',
            },
          },
          required: ['test'],
        },
      },
    };

    const testMessage = {
      role: 'user' as const,
      content: 'Simply respond with "test successful" without using any tools.',
    };

    try {
      // Make a minimal API call with tools to test capability
      await this.client.chat.completions.create({
        model: modelName,
        messages: [testMessage],
        tools: [testTool],
        tool_choice: 'none', // Don't force tool use, just test if tools are accepted
        max_tokens: 10, // Minimize cost
        temperature: 0,
      });

      // If we get here without error, the model supports function calling
      return { supportsFunctionCalling: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Check for specific error messages that indicate lack of function calling support
      if (
        errorMessage.includes('does not support tools') ||
        errorMessage.includes('tool use') ||
        errorMessage.includes('function calling') ||
        errorMessage.includes('tools parameter') ||
        (errorMessage.includes('400') && errorMessage.includes('tool'))
      ) {
        return { supportsFunctionCalling: false };
      }

      // For other errors (like auth, network issues), rethrow
      throw error;
    }
  }
}
