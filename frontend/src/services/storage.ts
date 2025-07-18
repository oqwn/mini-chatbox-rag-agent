const STORAGE_KEYS = {
  API_KEY: 'chatbox_api_key',
  BASE_URL: 'chatbox_base_url',
  MODEL: 'chatbox_model',
} as const;

export class StorageService {
  static setApiKey(apiKey: string): void {
    if (apiKey) {
      localStorage.setItem(STORAGE_KEYS.API_KEY, apiKey);
    } else {
      localStorage.removeItem(STORAGE_KEYS.API_KEY);
    }
  }

  static getApiKey(): string | null {
    return localStorage.getItem(STORAGE_KEYS.API_KEY);
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

  static clearAll(): void {
    localStorage.removeItem(STORAGE_KEYS.API_KEY);
    localStorage.removeItem(STORAGE_KEYS.BASE_URL);
    localStorage.removeItem(STORAGE_KEYS.MODEL);
  }
}
