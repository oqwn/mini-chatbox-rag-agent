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
  const [showStoredKey, setShowStoredKey] = useState(false);
  const [storedApiKey, setStoredApiKey] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [modelSupportsTools, setModelSupportsTools] = useState<boolean | null>(null);
  const [checkingModel, setCheckingModel] = useState(false);

  // RAG Configuration state
  const [ragEmbeddingModel, setRagEmbeddingModel] = useState('');
  const [ragEmbeddingEndpoint, setRagEmbeddingEndpoint] = useState('');
  const [ragRerankEndpoint, setRagRerankEndpoint] = useState('');
  const [ragRerankApiKey, setRagRerankApiKey] = useState('');
  const [ragRerankForceLocal, setRagRerankForceLocal] = useState('');
  const [hasStoredRerankKey, setHasStoredRerankKey] = useState(false);
  const [showStoredRerankKey, setShowStoredRerankKey] = useState(false);
  const [storedRerankApiKey, setStoredRerankApiKey] = useState('');

  useEffect(() => {
    // Load from local storage first
    const savedApiKey = StorageService.getApiKey();
    const storedBaseUrl = StorageService.getBaseUrl();
    const storedModel = StorageService.getModel();

    // Don't show the actual API key in the input field for security
    // Just keep track that we have one stored
    if (savedApiKey) {
      setHasStoredApiKey(true);
      setStoredApiKey(savedApiKey);
    }
    if (storedBaseUrl) setBaseUrl(storedBaseUrl);
    if (storedModel) {
      setModel(storedModel);
      // Check stored capability
      const capability = StorageService.getModelCapability(storedModel);
      if (capability) {
        setModelSupportsTools(capability.supportsFunctionCalling);
      }
    }

    // Load RAG configuration from local storage
    const savedRagEmbeddingModel = StorageService.getRagEmbeddingModel();
    const savedRagEmbeddingEndpoint = StorageService.getRagEmbeddingEndpoint();
    const savedRagRerankEndpoint = StorageService.getRagRerankEndpoint();
    const savedRagRerankApiKey = StorageService.getRagRerankApiKey();
    const savedRagRerankForceLocal = StorageService.getRagRerankForceLocal();

    if (savedRagEmbeddingModel) setRagEmbeddingModel(savedRagEmbeddingModel);
    if (savedRagEmbeddingEndpoint) setRagEmbeddingEndpoint(savedRagEmbeddingEndpoint);
    if (savedRagRerankEndpoint) setRagRerankEndpoint(savedRagRerankEndpoint);
    if (savedRagRerankApiKey) {
      setHasStoredRerankKey(true);
      setStoredRerankApiKey(savedRagRerankApiKey);
    }
    if (savedRagRerankForceLocal) setRagRerankForceLocal(savedRagRerankForceLocal);

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

      // Load RAG configuration from server if not in local storage
      if (response.rag) {
        if (!StorageService.getRagEmbeddingModel()) {
          setRagEmbeddingModel(response.rag.embedding.model || '');
        }
        if (!StorageService.getRagEmbeddingEndpoint()) {
          setRagEmbeddingEndpoint(response.rag.embedding.endpoint || '');
        }
        if (!StorageService.getRagRerankEndpoint()) {
          setRagRerankEndpoint(response.rag.reranking.endpoint || '');
        }
        if (!StorageService.getRagRerankForceLocal()) {
          setRagRerankForceLocal(response.rag.reranking.forceLocal || '');
        }
      }

      setLoading(false);

      // Auto-check capabilities for available models
      await checkAvailableModelsCapabilities(response.openai.availableModels);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to load settings' });
      setLoading(false);
    }
  };

  const checkAvailableModelsCapabilities = async (models: string[]) => {
    // Only check models we haven't tested recently (within last 24 hours)
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    for (const modelName of models) {
      const capability = StorageService.getModelCapability(modelName);
      if (!capability || capability.lastChecked < oneDayAgo) {
        // Test this model in the background
        try {
          const result = await apiService.testModelCapabilities(modelName);
          StorageService.setModelCapability(modelName, result.supportsFunctionCalling);
        } catch (error) {
          // Silently fail for background checks
          console.warn(`Failed to check capabilities for model ${modelName}:`, error);
        }
      }
    }
  };

  const testModelCapability = async (modelName: string) => {
    if (!modelName || checkingModel) return;

    setCheckingModel(true);
    try {
      const result = await apiService.testModelCapabilities(modelName);
      StorageService.setModelCapability(modelName, result.supportsFunctionCalling);
      setModelSupportsTools(result.supportsFunctionCalling);
    } catch (error) {
      console.error('Failed to test model capabilities:', error);
      // Don't show error to user for capability testing
    } finally {
      setCheckingModel(false);
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
      const effectiveRerankApiKey = ragRerankApiKey || StorageService.getRagRerankApiKey() || '';

      const updatePayload: {
        openai?: { apiKey: string; baseUrl?: string; model?: string };
        rag?: {
          embedding: { model?: string; endpoint?: string };
          reranking: { endpoint?: string; apiKey?: string; forceLocal?: string };
        };
      } = {};

      // Add OpenAI configuration
      updatePayload.openai = {
        apiKey: effectiveApiKey,
        baseUrl: baseUrl || undefined,
        model: model || undefined,
      };

      // Add RAG configuration if any fields have values
      const hasRagConfig =
        ragEmbeddingModel ||
        ragEmbeddingEndpoint ||
        ragRerankEndpoint ||
        ragRerankApiKey ||
        ragRerankForceLocal;
      if (hasRagConfig) {
        updatePayload.rag = {
          embedding: {
            model: ragEmbeddingModel || undefined,
            endpoint: ragEmbeddingEndpoint || undefined,
          },
          reranking: {
            endpoint: ragRerankEndpoint || undefined,
            apiKey: effectiveRerankApiKey || undefined,
            forceLocal: ragRerankForceLocal || undefined,
          },
        };
      }

      const response = await apiService.updateSettings(updatePayload);

      // Save to local storage
      if (apiKey) {
        StorageService.setApiKey(apiKey);
        setHasStoredApiKey(true);
        setStoredApiKey(apiKey);
      }
      StorageService.setBaseUrl(baseUrl);
      StorageService.setModel(model);

      // Save RAG configuration to local storage
      StorageService.setRagEmbeddingModel(ragEmbeddingModel);
      StorageService.setRagEmbeddingEndpoint(ragEmbeddingEndpoint);
      StorageService.setRagRerankEndpoint(ragRerankEndpoint);
      if (ragRerankApiKey) {
        StorageService.setRagRerankApiKey(ragRerankApiKey);
        setHasStoredRerankKey(true);
        setStoredRerankApiKey(ragRerankApiKey);
      }
      StorageService.setRagRerankForceLocal(ragRerankForceLocal);

      setMessage({ type: 'success', text: response.message });
      setApiKey(''); // Clear the input field after saving
      setRagRerankApiKey(''); // Clear the rerank API key input field
      setShowStoredKey(false); // Hide the key after saving
      setShowStoredRerankKey(false); // Hide the rerank key after saving
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
        <div className="space-x-2">
          <button
            onClick={() => navigate('/mcp')}
            className="px-4 py-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            MCP
          </button>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            ← Back to Chat
          </button>
        </div>
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
            <div className="relative">
              <input
                type={showStoredKey ? 'text' : 'password'}
                id="apiKey"
                value={showStoredKey && hasStoredApiKey && !apiKey ? storedApiKey : apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={
                  settings?.openai.isConfigured || hasStoredApiKey
                    ? '••••••••• (configured)'
                    : 'sk-...'
                }
                className="w-full px-3 py-2 pr-20 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {hasStoredApiKey && (
                <button
                  type="button"
                  onClick={() => setShowStoredKey(!showStoredKey)}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 px-3 py-1 text-sm text-gray-600 hover:text-gray-900"
                >
                  {showStoredKey ? 'Hide' : 'Show'}
                </button>
              )}
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Your API key for OpenAI-compatible services (OpenAI, OpenRouter, etc.)
              {hasStoredApiKey && ' Leave empty to keep existing key.'}
              <br />
              <span className="text-xs">
                API keys are encrypted and stored locally in your browser.
              </span>
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
                onChange={(e) => {
                  const newModel = e.target.value;
                  setModel(newModel);
                  // Check if we have cached capability for this model
                  const capability = StorageService.getModelCapability(newModel);
                  if (capability) {
                    setModelSupportsTools(capability.supportsFunctionCalling);
                  } else {
                    setModelSupportsTools(null);
                    // Auto-test the model if we have API configuration
                    if (hasStoredApiKey || apiKey) {
                      testModelCapability(newModel);
                    }
                  }
                }}
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
                onChange={(e) => {
                  const newModel = e.target.value;
                  setModel(newModel);
                  // Check if we have cached capability for this model
                  const capability = StorageService.getModelCapability(newModel);
                  if (capability) {
                    setModelSupportsTools(capability.supportsFunctionCalling);
                  } else {
                    setModelSupportsTools(null);
                    // Auto-test the model if we have API configuration
                    if (hasStoredApiKey || apiKey) {
                      testModelCapability(newModel);
                    }
                  }
                }}
                placeholder="Enter model name (e.g., gpt-4, claude-3-opus)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
            <p className="mt-1 text-sm text-gray-500">Select the AI model to use for chat</p>

            {/* Model capability indicator */}
            {model && modelSupportsTools !== null && (
              <div
                className={`mt-2 p-2 rounded-md text-sm ${
                  modelSupportsTools
                    ? 'bg-green-50 border border-green-200 text-green-700'
                    : 'bg-yellow-50 border border-yellow-200 text-yellow-700'
                }`}
              >
                {modelSupportsTools ? (
                  <>
                    <span className="font-medium">✓ Function calling supported</span>
                    <span className="block text-xs mt-1">
                      This model supports MCP tools and function calling features
                    </span>
                  </>
                ) : (
                  <>
                    <span className="font-medium">⚠ Function calling not supported</span>
                    <span className="block text-xs mt-1">
                      This model does not support MCP tools or function calling. Choose a compatible
                      model to use these features.
                    </span>
                  </>
                )}
              </div>
            )}

            {model && modelSupportsTools === null && !checkingModel && (
              <div className="mt-2 p-2 rounded-md text-sm bg-gray-50 border border-gray-200 text-gray-600">
                <span className="font-medium">ℹ Model capability unknown</span>
                <span className="block text-xs mt-1">
                  Function calling support will be detected when you use this model in chat
                </span>
              </div>
            )}

            {checkingModel && (
              <div className="mt-2 p-2 rounded-md text-sm bg-blue-50 border border-blue-200 text-blue-700">
                <span className="font-medium">🔍 Checking model capabilities...</span>
                <span className="block text-xs mt-1">
                  Testing if this model supports function calling
                </span>
              </div>
            )}
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
                setStoredApiKey('');
                setShowStoredKey(false);
                setModelSupportsTools(null);
                // Clear RAG settings
                setRagEmbeddingModel('');
                setRagEmbeddingEndpoint('');
                setRagRerankEndpoint('');
                setRagRerankApiKey('');
                setRagRerankForceLocal('');
                setHasStoredRerankKey(false);
                setStoredRerankApiKey('');
                setShowStoredRerankKey(false);
                setMessage({ type: 'success', text: 'Settings cleared from local storage' });
              }
            }}
            className="px-4 py-2 text-red-600 hover:text-red-800 border border-red-300 rounded-md hover:bg-red-50"
          >
            Clear Stored Settings
          </button>
        </div>
      </div>

      {/* RAG Configuration Section */}
      <div className="bg-white rounded-lg shadow p-6 mt-6">
        <h2 className="text-xl font-semibold mb-4">RAG Configuration</h2>

        {settings?.rag && (
          <div className="mb-4 p-3 bg-blue-100 border border-blue-400 text-blue-700 rounded">
            📊 Embedding:{' '}
            {settings.rag.embedding.isConfigured ? '✓ Configured' : '⚠ Not configured'} | 🔄
            Reranking: {settings.rag.reranking.isConfigured ? '✓ Configured' : '⚠ Not configured'}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Embedding Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 mb-3">🔍 Embedding Configuration</h3>

            <div>
              <label
                htmlFor="ragEmbeddingModel"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Embedding Model
              </label>
              <input
                type="text"
                id="ragEmbeddingModel"
                value={ragEmbeddingModel}
                onChange={(e) => setRagEmbeddingModel(e.target.value)}
                placeholder="text-embedding-3-small"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                OpenAI embedding model name (leave empty for default)
              </p>
            </div>

            <div>
              <label
                htmlFor="ragEmbeddingEndpoint"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Embedding Endpoint
              </label>
              <input
                type="url"
                id="ragEmbeddingEndpoint"
                value={ragEmbeddingEndpoint}
                onChange={(e) => setRagEmbeddingEndpoint(e.target.value)}
                placeholder="https://your-embedding-service/v1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                Custom embedding service endpoint (optional)
              </p>
            </div>
          </div>

          {/* Reranking Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 mb-3">🔄 Reranking Configuration</h3>

            <div>
              <label
                htmlFor="ragRerankEndpoint"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Rerank Endpoint
              </label>
              <input
                type="url"
                id="ragRerankEndpoint"
                value={ragRerankEndpoint}
                onChange={(e) => setRagRerankEndpoint(e.target.value)}
                placeholder="https://your-rerank-service/rerank"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-sm text-gray-500">Remote reranking service endpoint</p>
            </div>

            <div>
              <label
                htmlFor="ragRerankApiKey"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Rerank API Key
              </label>
              <div className="relative">
                <input
                  type={showStoredRerankKey ? 'text' : 'password'}
                  id="ragRerankApiKey"
                  value={
                    showStoredRerankKey && hasStoredRerankKey && !ragRerankApiKey
                      ? storedRerankApiKey
                      : ragRerankApiKey
                  }
                  onChange={(e) => setRagRerankApiKey(e.target.value)}
                  placeholder={
                    hasStoredRerankKey
                      ? '••••••••• (configured)'
                      : 'Optional API key for rerank service'
                  }
                  className="w-full px-3 py-2 pr-20 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {hasStoredRerankKey && (
                  <button
                    type="button"
                    onClick={() => setShowStoredRerankKey(!showStoredRerankKey)}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 px-3 py-1 text-sm text-gray-600 hover:text-gray-900"
                  >
                    {showStoredRerankKey ? 'Hide' : 'Show'}
                  </button>
                )}
              </div>
              <p className="mt-1 text-sm text-gray-500">
                API key for remote reranking service (encrypted storage)
                {hasStoredRerankKey && ' Leave empty to keep existing key.'}
              </p>
            </div>

            <div>
              <label
                htmlFor="ragRerankForceLocal"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Force Local Reranking
              </label>
              <select
                id="ragRerankForceLocal"
                value={ragRerankForceLocal}
                onChange={(e) => setRagRerankForceLocal(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Auto (use remote if available)</option>
                <option value="true">Always use local reranking</option>
                <option value="false">Prefer remote reranking</option>
              </select>
              <p className="mt-1 text-sm text-gray-500">
                Whether to force local reranking algorithms
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="text-sm font-medium text-blue-800 mb-2">📝 RAG Configuration Notes</h4>
          <ul className="text-xs text-blue-700 space-y-1">
            <li>• Embedding models are used for document indexing and similarity search</li>
            <li>• Reranking improves search relevance by reordering results</li>
            <li>• Local services work offline but may have lower performance</li>
            <li>• Remote services require network connectivity but offer better accuracy</li>
            <li>• All settings are stored securely and persistently in your browser</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
