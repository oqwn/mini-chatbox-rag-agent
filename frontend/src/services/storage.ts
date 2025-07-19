import { encrypt, decrypt, isEncrypted } from '../utils/crypto';

const STORAGE_KEYS = {
  API_KEY: 'chatbox_api_key',
  BASE_URL: 'chatbox_base_url',
  MODEL: 'chatbox_model',
  MODEL_CAPABILITIES: 'chatbox_model_capabilities',
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

  static clearAll(): void {
    localStorage.removeItem(STORAGE_KEYS.API_KEY);
    localStorage.removeItem(STORAGE_KEYS.BASE_URL);
    localStorage.removeItem(STORAGE_KEYS.MODEL);
    localStorage.removeItem(STORAGE_KEYS.MODEL_CAPABILITIES);
    // Note: We keep the encryption key so that if the user re-enters
    // their API key, it will be encrypted with the same key
  }
}
