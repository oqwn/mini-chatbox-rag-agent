const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface OpenAISettings {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export interface SettingsResponse {
  openai: {
    isConfigured: boolean;
    baseUrl: string;
    model: string;
    availableModels: string[];
  };
}

class ApiService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  }

  async getSettings(): Promise<SettingsResponse> {
    return this.request('/settings');
  }

  async updateSettings(settings: {
    openai: OpenAISettings;
  }): Promise<{ success: boolean; message: string }> {
    return this.request('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  async sendMessage(messages: ChatMessage[], options?: ChatOptions): Promise<{ message: string }> {
    return this.request('/chat', {
      method: 'POST',
      body: JSON.stringify({ messages, options }),
    });
  }

  async streamMessage(
    messages: ChatMessage[],
    options: ChatOptions | undefined,
    onMessage: (content: string) => void,
    onError: (error: string) => void,
    onDone: () => void
  ): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages, options }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Stream request failed');
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('No response body');
    }

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              switch (data.type) {
                case 'content':
                  onMessage(data.content);
                  break;
                case 'error':
                  onError(data.error);
                  break;
                case 'done':
                  onDone();
                  break;
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

export const apiService = new ApiService();
