import { encrypt, decrypt, isEncrypted } from '../utils/crypto';

const STORAGE_KEYS = {
  API_KEY: 'chatbox_api_key',
  BASE_URL: 'chatbox_base_url',
  MODEL: 'chatbox_model',
  MODEL_CAPABILITIES: 'chatbox_model_capabilities',
  // RAG configuration
  RAG_EMBEDDING_MODEL: 'chatbox_rag_embedding_model',
  RAG_EMBEDDING_ENDPOINT: 'chatbox_rag_embedding_endpoint',
  RAG_RERANK_ENDPOINT: 'chatbox_rag_rerank_endpoint',
  RAG_RERANK_API_KEY: 'chatbox_rag_rerank_api_key',
  RAG_RERANK_FORCE_LOCAL: 'chatbox_rag_rerank_force_local',
} as const;

type ModelCapability = {
  supportsFunctionCalling: boolean;
  lastChecked: number;
};

export class StorageService {
  static setApiKey(apiKey: string): void {
    if (apiKey) {
      // Encrypt the API key before storing
      const encryptedKey = encrypt(apiKey);
      localStorage.setItem(STORAGE_KEYS.API_KEY, encryptedKey);
    } else {
      localStorage.removeItem(STORAGE_KEYS.API_KEY);
    }
  }

  static getApiKey(): string | null {
    const storedKey = localStorage.getItem(STORAGE_KEYS.API_KEY);
    if (!storedKey) return null;

    // Decrypt the API key
    if (isEncrypted(storedKey)) {
      return decrypt(storedKey);
    }

    // Migrate unencrypted keys (for backward compatibility)
    this.setApiKey(storedKey);
    return storedKey;
  }

  static setBaseUrl(baseUrl: string): void {
    if (baseUrl) {
      localStorage.setItem(STORAGE_KEYS.BASE_URL, baseUrl);
    } else {
      localStorage.removeItem(STORAGE_KEYS.BASE_URL);
    }
  }

  static getBaseUrl(): string | null {
    return localStorage.getItem(STORAGE_KEYS.BASE_URL);
  }

  static setModel(model: string): void {
    if (model) {
      localStorage.setItem(STORAGE_KEYS.MODEL, model);
    } else {
      localStorage.removeItem(STORAGE_KEYS.MODEL);
    }
  }

  static getModel(): string | null {
    return localStorage.getItem(STORAGE_KEYS.MODEL);
  }

  static setModelCapability(model: string, supportsFunctionCalling: boolean): void {
    const capabilities = this.getModelCapabilities();
    capabilities[model] = {
      supportsFunctionCalling,
      lastChecked: Date.now(),
    };
    localStorage.setItem(STORAGE_KEYS.MODEL_CAPABILITIES, JSON.stringify(capabilities));
  }

  static getModelCapability(model: string): ModelCapability | null {
    const capabilities = this.getModelCapabilities();
    return capabilities[model] || null;
  }

  static getModelCapabilities(): Record<string, ModelCapability> {
    const stored = localStorage.getItem(STORAGE_KEYS.MODEL_CAPABILITIES);
    if (!stored) return {};
    try {
      return JSON.parse(stored);
    } catch {
      return {};
    }
  }

  // RAG Configuration methods
  static setRagEmbeddingModel(model: string): void {
    if (model) {
      localStorage.setItem(STORAGE_KEYS.RAG_EMBEDDING_MODEL, model);
    } else {
      localStorage.removeItem(STORAGE_KEYS.RAG_EMBEDDING_MODEL);
    }
  }

  static getRagEmbeddingModel(): string | null {
    return localStorage.getItem(STORAGE_KEYS.RAG_EMBEDDING_MODEL);
  }

  static setRagEmbeddingEndpoint(endpoint: string): void {
    if (endpoint) {
      localStorage.setItem(STORAGE_KEYS.RAG_EMBEDDING_ENDPOINT, endpoint);
    } else {
      localStorage.removeItem(STORAGE_KEYS.RAG_EMBEDDING_ENDPOINT);
    }
  }

  static getRagEmbeddingEndpoint(): string | null {
    return localStorage.getItem(STORAGE_KEYS.RAG_EMBEDDING_ENDPOINT);
  }

  static setRagRerankEndpoint(endpoint: string): void {
    if (endpoint) {
      localStorage.setItem(STORAGE_KEYS.RAG_RERANK_ENDPOINT, endpoint);
    } else {
      localStorage.removeItem(STORAGE_KEYS.RAG_RERANK_ENDPOINT);
    }
  }

  static getRagRerankEndpoint(): string | null {
    return localStorage.getItem(STORAGE_KEYS.RAG_RERANK_ENDPOINT);
  }

  static setRagRerankApiKey(apiKey: string): void {
    if (apiKey) {
      // Encrypt the API key before storing
      const encryptedKey = encrypt(apiKey);
      localStorage.setItem(STORAGE_KEYS.RAG_RERANK_API_KEY, encryptedKey);
    } else {
      localStorage.removeItem(STORAGE_KEYS.RAG_RERANK_API_KEY);
    }
  }

  static getRagRerankApiKey(): string | null {
    const storedKey = localStorage.getItem(STORAGE_KEYS.RAG_RERANK_API_KEY);
    if (!storedKey) return null;

    // Decrypt the API key
    if (isEncrypted(storedKey)) {
      return decrypt(storedKey);
    }

    // Migrate unencrypted keys (for backward compatibility)
    this.setRagRerankApiKey(storedKey);
    return storedKey;
  }

  static setRagRerankForceLocal(forceLocal: string): void {
    if (forceLocal) {
      localStorage.setItem(STORAGE_KEYS.RAG_RERANK_FORCE_LOCAL, forceLocal);
    } else {
      localStorage.removeItem(STORAGE_KEYS.RAG_RERANK_FORCE_LOCAL);
    }
  }

  static getRagRerankForceLocal(): string | null {
    return localStorage.getItem(STORAGE_KEYS.RAG_RERANK_FORCE_LOCAL);
  }

  static clearAll(): void {
    // Clear all chatbox-related keys from localStorage
    // Use a prefix match to ensure we get everything
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('chatbox_')) {
        keysToRemove.push(key);
      }
    }

    // Remove all found keys
    keysToRemove.forEach(key => localStorage.removeItem(key));

    // Explicitly clear known keys to be sure
    localStorage.removeItem(STORAGE_KEYS.API_KEY);
    localStorage.removeItem(STORAGE_KEYS.BASE_URL);
    localStorage.removeItem(STORAGE_KEYS.MODEL);
    localStorage.removeItem(STORAGE_KEYS.MODEL_CAPABILITIES);
    localStorage.removeItem(STORAGE_KEYS.RAG_EMBEDDING_MODEL);
    localStorage.removeItem(STORAGE_KEYS.RAG_EMBEDDING_ENDPOINT);
    localStorage.removeItem(STORAGE_KEYS.RAG_RERANK_ENDPOINT);
    localStorage.removeItem(STORAGE_KEYS.RAG_RERANK_API_KEY);
    localStorage.removeItem(STORAGE_KEYS.RAG_RERANK_FORCE_LOCAL);
  }
}
