import { useEffect } from 'react';
import { apiService } from '../services/api';
import { StorageService } from '../services/storage';

export const useInitializeSettings = () => {
  useEffect(() => {
    const initializeSettings = async () => {
      // Check if we have stored settings
      const storedApiKey = StorageService.getApiKey();
      const storedBaseUrl = StorageService.getBaseUrl();
      const storedModel = StorageService.getModel();

      if (storedApiKey) {
        try {
          // Update backend with stored settings
          await apiService.updateSettings({
            openai: {
              apiKey: storedApiKey,
              baseUrl: storedBaseUrl || undefined,
              model: storedModel || undefined,
            },
          });
        } catch (error) {
          console.error('Failed to initialize settings from local storage:', error);
        }
      }
    };

    initializeSettings();
  }, []);
};