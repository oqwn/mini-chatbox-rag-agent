const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:20001/api';

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

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  serverId: string;
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
    onDone: () => void,
    signal?: AbortSignal
  ): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages, options }),
      signal,
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
        // Check if the request was aborted
        if (signal?.aborted) {
          throw new Error('Request aborted');
        }

        const { done, value } = await reader.read();
        if (done) break;

        // Decode the chunk as plain text
        const chunk = decoder.decode(value, { stream: true });

        // Check for error messages
        if (chunk.includes('[ERROR]:')) {
          const errorMatch = chunk.match(/\[ERROR\]:\s*(.+)/);
          if (errorMatch) {
            onError(errorMatch[1]);
            return;
          }
        }

        // Send the chunk directly to the message handler
        if (chunk && !signal?.aborted) {
          onMessage(chunk);
        }
      }

      // Stream completed successfully
      if (!signal?.aborted) {
        onDone();
      }
    } catch (error) {
      if (signal?.aborted) {
        // Request was aborted, don't call error handler
        return;
      }
      throw error;
    } finally {
      reader.releaseLock();
    }
  }

  // MCP API methods
  async getMCPTools(): Promise<MCPTool[]> {
    return this.request('/mcp/tools');
  }

  async invokeMCPTool(
    serverId: string,
    toolName: string,
    parameters: Record<string, any>
  ): Promise<any> {
    return this.request(`/mcp/tools/${serverId}/${toolName}`, {
      method: 'POST',
      body: JSON.stringify({ parameters }),
    });
  }

  async getMCPServers(): Promise<any[]> {
    return this.request('/mcp/servers');
  }

  async createMCPServer(serverId: string, config: any): Promise<any> {
    return this.request('/mcp/servers', {
      method: 'POST',
      body: JSON.stringify({ serverId, config }),
    });
  }

  async getMCPServerTools(serverId: string): Promise<any[]> {
    return this.request(`/mcp/servers/${serverId}/tools`);
  }

  async getMCPServerResources(serverId: string): Promise<any[]> {
    return this.request(`/mcp/servers/${serverId}/resources`);
  }

  async getMCPServerPrompts(serverId: string): Promise<any[]> {
    return this.request(`/mcp/servers/${serverId}/prompts`);
  }

  async disconnectMCPServer(serverId: string): Promise<any> {
    return this.request(`/mcp/servers/${serverId}`, {
      method: 'DELETE',
    });
  }
}

export const apiService = new ApiService();
