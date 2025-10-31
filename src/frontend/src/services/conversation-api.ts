const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:20001/api';

export interface Conversation {
  id?: number;
  sessionId: string;
  title?: string;
  memorySummary?: string;
  contextWindowSize?: number;
  messageCount?: number;
  lastActivity?: string;
  isArchived?: boolean;
  projectId?: number;
  isStarred?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Project {
  id: number;
  name: string;
  description?: string;
  color: string;
  icon: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Message {
  id?: number;
  conversationId: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, any>;
  tokenCount?: number;
  embedding?: number[];
  importanceScore?: number;
  isSummarized?: boolean;
  createdAt?: string;
}

export interface ConversationSummary {
  id?: number;
  conversationId: number;
  summaryText: string;
  messageRangeStart?: number;
  messageRangeEnd?: number;
  tokenCount?: number;
  compressionRatio?: number;
  createdAt?: string;
}

export interface MemoryStats {
  totalConversations: number;
  activeConversations: number;
  archivedConversations: number;
  totalMessages: number;
  averageMessagesPerConversation: number;
  cacheEntries: number;
  totalTokensUsed: number;
}

export interface ConversationsResponse {
  conversations: Conversation[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
  stats: MemoryStats;
}

export class ConversationApiService {
  // Get all conversations
  async getConversations(limit: number = 50, offset: number = 0): Promise<ConversationsResponse> {
    const response = await fetch(`${API_BASE_URL}/conversations/?limit=${limit}&offset=${offset}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get conversations: ${response.statusText}`);
    }

    return response.json();
  }

  // Get specific conversation
  async getConversation(sessionId: string): Promise<{ conversation: Conversation }> {
    const response = await fetch(`${API_BASE_URL}/conversations/${sessionId}/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Conversation not found');
      }
      throw new Error(`Failed to get conversation: ${response.statusText}`);
    }

    return response.json();
  }

  // Create new conversation
  async createConversation(
    sessionId: string,
    title?: string,
    contextWindowSize?: number
  ): Promise<{ conversation: Conversation }> {
    const response = await fetch(`${API_BASE_URL}/conversations/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
        title,
        contextWindowSize,
      }),
    });

    if (!response.ok) {
      if (response.status === 409) {
        throw new Error('Conversation already exists');
      }
      throw new Error(`Failed to create conversation: ${response.statusText}`);
    }

    return response.json();
  }

  // Update conversation
  async updateConversation(
    sessionId: string,
    updates: Partial<Conversation>
  ): Promise<{ conversation: Conversation }> {
    const response = await fetch(`${API_BASE_URL}/conversations/${sessionId}/`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error(`Failed to update conversation: ${response.statusText}`);
    }

    return response.json();
  }

  // Get conversation messages
  async getMessages(
    sessionId: string,
    options?: {
      limit?: number;
      offset?: number;
      tokenLimit?: number;
      importanceThreshold?: number;
    }
  ): Promise<{ messages: Message[] }> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());
    if (options?.tokenLimit) params.append('tokenLimit', options.tokenLimit.toString());
    if (options?.importanceThreshold) {
      params.append('importanceThreshold', options.importanceThreshold.toString());
    }

    const response = await fetch(
      `${API_BASE_URL}/conversations/${sessionId}/messages/?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get messages: ${response.statusText}`);
    }

    return response.json();
  }

  // Add message to conversation
  async addMessage(
    sessionId: string,
    message: {
      role: 'user' | 'assistant' | 'system';
      content: string;
      metadata?: Record<string, any>;
      tokenCount?: number;
      importanceScore?: number;
    }
  ): Promise<{ messageId: number }> {
    const response = await fetch(`${API_BASE_URL}/conversations/${sessionId}/messages/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...message,
        user_id: 'default_user' // Add user_id for backend to generate title
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to add message: ${response.statusText}`);
    }

    return response.json();
  }

  // Get conversation summaries
  async getSummaries(sessionId: string): Promise<{ summaries: ConversationSummary[] }> {
    const response = await fetch(`${API_BASE_URL}/conversations/${sessionId}/summaries/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get summaries: ${response.statusText}`);
    }

    return response.json();
  }

  // Create conversation summary
  async createSummary(
    sessionId: string,
    summary: {
      summaryText: string;
      messageRangeStart?: number;
      messageRangeEnd?: number;
      tokenCount?: number;
      compressionRatio?: number;
    }
  ): Promise<{ summaryId: number }> {
    const response = await fetch(`${API_BASE_URL}/conversations/${sessionId}/summaries/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(summary),
    });

    if (!response.ok) {
      throw new Error(`Failed to create summary: ${response.statusText}`);
    }

    return response.json();
  }

  // Prune old messages
  async pruneMessages(
    sessionId: string,
    keepRecentCount: number = 50
  ): Promise<{ pruningLog: any }> {
    const response = await fetch(`${API_BASE_URL}/conversations/${sessionId}/prune/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ keepRecentCount }),
    });

    if (!response.ok) {
      throw new Error(`Failed to prune messages: ${response.statusText}`);
    }

    return response.json();
  }

  // Get memory cache
  async getCache(key: string): Promise<{ data: any }> {
    const response = await fetch(`${API_BASE_URL}/conversations/cache/${key}/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Cache entry not found');
      }
      throw new Error(`Failed to get cache: ${response.statusText}`);
    }

    return response.json();
  }

  // Set memory cache
  async setCache(key: string, data: any, ttlMinutes?: number): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE_URL}/conversations/cache/${key}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data, ttlMinutes }),
    });

    if (!response.ok) {
      throw new Error(`Failed to set cache: ${response.statusText}`);
    }

    return response.json();
  }

  // Get memory statistics
  async getStats(): Promise<{ stats: MemoryStats }> {
    const response = await fetch(`${API_BASE_URL}/conversations/stats/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get memory stats: ${response.statusText}`);
    }

    return response.json();
  }

  // Get all projects
  async getProjects(): Promise<Project[]> {
    const response = await fetch(`${API_BASE_URL}/projects/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get projects: ${response.statusText}`);
    }

    const data = await response.json();
    return data.projects || [];
  }

  // Create new project
  async createProject(project: {
    name: string;
    description?: string;
    color?: string;
    icon?: string;
  }): Promise<Project> {
    const response = await fetch(`${API_BASE_URL}/projects/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(project),
    });

    if (!response.ok) {
      throw new Error(`Failed to create project: ${response.statusText}`);
    }

    const data = await response.json();
    return data.project;
  }

  // Update project
  async updateProject(projectId: number, updates: Partial<Project>): Promise<Project> {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error(`Failed to update project: ${response.statusText}`);
    }

    const data = await response.json();
    return data.project;
  }

  // Delete project
  async deleteProject(projectId: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to delete project: ${response.statusText}`);
    }
  }
}

export const conversationApiService = new ConversationApiService();
