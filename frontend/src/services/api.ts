const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:20001/api';

// Simple token estimation (approximation for GPT models)
// More accurate than character/4 but less complex than full tokenization
export const estimateTokenCount = (text: string): number => {
  if (!text) return 0;

  // Remove extra whitespace and normalize
  const normalizedText = text.replace(/\s+/g, ' ').trim();

  // Basic tokenization approximation:
  // - Average 4 characters per token for English
  // - Account for punctuation and special characters
  // - Add overhead for markdown formatting
  const baseTokens = Math.ceil(normalizedText.length / 4);

  // Adjustments for common patterns
  const codeBlocks = (text.match(/```[\s\S]*?```/g) || []).length;
  const inlineCode = (text.match(/`[^`]+`/g) || []).length;
  const markdownLinks = (text.match(/\[([^\]]+)\]\(([^)]+)\)/g) || []).length;
  const markdownBold = (text.match(/\*\*[^*]+\*\*/g) || []).length;

  // Add overhead for formatting
  let adjustedTokens = baseTokens;
  adjustedTokens += codeBlocks * 2; // Code blocks tend to use more tokens
  adjustedTokens += inlineCode * 0.5;
  adjustedTokens += markdownLinks * 1;
  adjustedTokens += markdownBold * 0.2;

  return Math.max(1, Math.round(adjustedTokens));
};

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  tokenCount?: number;
  attachments?: Array<{
    id: string;
    name: string;
    type: string;
    size: number;
    analysis?: any;
  }>;
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

export interface RagEmbeddingSettings {
  model?: string;
  endpoint?: string;
}

export interface RagRerankingSettings {
  endpoint?: string;
  apiKey?: string;
  forceLocal?: string;
}

export interface RagSettings {
  embedding: RagEmbeddingSettings;
  reranking: RagRerankingSettings;
}

export interface SettingsResponse {
  openai: {
    isConfigured: boolean;
    baseUrl: string;
    model: string;
    availableModels: string[];
  };
  rag: {
    embedding: {
      model: string;
      endpoint: string;
      isConfigured: boolean;
    };
    reranking: {
      endpoint: string;
      hasApiKey: boolean;
      forceLocal: string;
      isConfigured: boolean;
    };
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
    openai?: OpenAISettings;
    rag?: RagSettings;
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
    signal?: AbortSignal,
    ragEnabled?: boolean
  ): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages, options, ragEnabled }),
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

  async testModelCapabilities(model: string): Promise<{ supportsFunctionCalling: boolean }> {
    return this.request('/chat/test-capabilities', {
      method: 'POST',
      body: JSON.stringify({ model }),
    });
  }

  // Multimodal support
  async processMediaFile(file: File): Promise<{
    success: boolean;
    mediaType: string;
    multimodal: boolean;
    textExtracted: boolean;
    extractedText?: string;
    analysis?: any;
    error?: string;
  }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('multimodal', 'true');

    const response = await fetch(`${API_BASE_URL}/rag/ingest/file`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Media processing failed');
    }

    return response.json();
  }

  async getMediaInfo(filename: string): Promise<{
    mediaType: string;
    isSupported: boolean;
    multimodalCapabilities: any;
  }> {
    return this.request(`/rag/media/info?filename=${encodeURIComponent(filename)}`);
  }

  async streamMessageWithMedia(
    messages: ChatMessage[],
    files: File[],
    options: ChatOptions | undefined,
    onMessage: (content: string) => void,
    onError: (error: string) => void,
    onDone: () => void,
    signal?: AbortSignal,
    ragEnabled?: boolean
  ): Promise<void> {
    // Process media files first if any
    const processedAttachments = [];

    if (files.length > 0) {
      for (const file of files) {
        try {
          const result = await this.processMediaFile(file);
          processedAttachments.push({
            id: Math.random().toString(36).substr(2, 9),
            name: file.name,
            type: result.mediaType,
            size: file.size,
            analysis: {
              extractedText: result.extractedText,
              ...result.analysis,
            },
          });
        } catch (error) {
          console.error(`Failed to process ${file.name}:`, error);
          processedAttachments.push({
            id: Math.random().toString(36).substr(2, 9),
            name: file.name,
            type: 'unknown',
            size: file.size,
            error: error instanceof Error ? error.message : 'Processing failed',
          });
        }
      }
    }

    // Add attachments to the last user message
    const messagesWithAttachments = [...messages];
    if (processedAttachments.length > 0 && messagesWithAttachments.length > 0) {
      const lastMessage = messagesWithAttachments[messagesWithAttachments.length - 1];
      if (lastMessage.role === 'user') {
        lastMessage.attachments = processedAttachments;

        // Add extracted text to message content
        const extractedTexts = processedAttachments
          .map((att) => att.analysis?.extractedText)
          .filter((text) => text && text.trim())
          .join('\n\n');

        if (extractedTexts) {
          lastMessage.content += `\n\n[Attached media content]:\n${extractedTexts}`;
        }
      }
    }

    // Use regular streaming with enhanced messages
    return this.streamMessage(
      messagesWithAttachments,
      options,
      onMessage,
      onError,
      onDone,
      signal,
      ragEnabled
    );
  }
}

export const apiService = new ApiService();
