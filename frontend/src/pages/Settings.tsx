import React, { useState, useEffect } from 'react';
import { apiService, SettingsResponse } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { StorageService } from '../services/storage';

export const Settings: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [hasStoredApiKey, setHasStoredApiKey] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    // Load from local storage first
    const storedApiKey = StorageService.getApiKey();
    const storedBaseUrl = StorageService.getBaseUrl();
    const storedModel = StorageService.getModel();
    
    // Don't show the actual API key in the input field for security
    // Just keep track that we have one stored
    if (storedApiKey) setHasStoredApiKey(true);
    if (storedBaseUrl) setBaseUrl(storedBaseUrl);
    if (storedModel) setModel(storedModel);
    
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await apiService.getSettings();
      setSettings(response);
      
      // Only update from server if no local storage values
      if (!StorageService.getBaseUrl()) {
        setBaseUrl(response.openai.baseUrl);
      }
      if (!StorageService.getModel()) {
        setModel(response.openai.model);
      }
      
      setLoading(false);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to load settings' });
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!apiKey && !hasStoredApiKey) {
      setMessage({ type: 'error', text: 'API key is required' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      // Use the entered API key or the stored one
      const effectiveApiKey = apiKey || StorageService.getApiKey() || '';
      
      const response = await apiService.updateSettings({
        openai: {
          apiKey: effectiveApiKey,
          baseUrl: baseUrl || undefined,
          model: model || undefined,
        },
      });

      // Save to local storage
      if (apiKey) {
        StorageService.setApiKey(apiKey);
        setHasStoredApiKey(true);
      }
      StorageService.setBaseUrl(baseUrl);
      StorageService.setModel(model);
      
      setMessage({ type: 'success', text: response.message });
      setApiKey(''); // Clear the input field after saving
      await loadSettings(); // Reload settings to get new model list
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to update settings',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Settings</h1>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          ← Back to Chat
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">AI Configuration</h2>

        {(settings?.openai.isConfigured || hasStoredApiKey) && (
          <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
            ✓ AI service is configured and ready to use
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-1">
              API Key <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              id="apiKey"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                settings?.openai.isConfigured || hasStoredApiKey
                  ? '••••••••• (configured)'
                  : 'sk-...'
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-sm text-gray-500">
              Your API key for OpenAI-compatible services (OpenAI, OpenRouter, etc.)
              {hasStoredApiKey && ' Leave empty to keep existing key.'}
            </p>
          </div>

          <div>
            <label htmlFor="baseUrl" className="block text-sm font-medium text-gray-700 mb-1">
              Base URL (optional)
            </label>
            <input
              type="url"
              id="baseUrl"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.openai.com/v1"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-sm text-gray-500">
              API endpoint URL (e.g., https://api.openai.com/v1, https://openrouter.ai/api/v1)
            </p>
          </div>

          <div>
            <label htmlFor="model" className="block text-sm font-medium text-gray-700 mb-1">
              Model
            </label>
            {settings?.openai.availableModels.length ? (
              <select
                id="model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {settings.openai.availableModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                id="model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Enter model name (e.g., gpt-4, claude-3-opus)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
            <p className="mt-1 text-sm text-gray-500">Select the AI model to use for chat</p>
          </div>
        </div>

        {message && (
          <div
            className={`mt-4 p-3 rounded ${
              message.type === 'success'
                ? 'bg-green-100 border border-green-400 text-green-700'
                : 'bg-red-100 border border-red-400 text-red-700'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-4 py-2 rounded-md font-medium ${
              saving
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          
          <button
            onClick={() => {
              if (confirm('Are you sure you want to clear all stored settings?')) {
                StorageService.clearAll();
                setApiKey('');
                setBaseUrl('');
                setModel('');
                setHasStoredApiKey(false);
                setMessage({ type: 'success', text: 'Settings cleared from local storage' });
              }
            }}
            className="px-4 py-2 text-red-600 hover:text-red-800 border border-red-300 rounded-md hover:bg-red-50"
          >
            Clear Stored Settings
          </button>
        </div>
      </div>
    </div>
  );
};
