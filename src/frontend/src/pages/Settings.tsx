import React, { useState, useEffect } from 'react';
import { apiService, SettingsResponse } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { StorageService } from '../services/storage';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Select, useModelOptions } from '../components/ui/Select';

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
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type?: 'danger' | 'warning' | 'info';
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

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

      // Only check capability for the currently selected model, not all models
      // This reduces unnecessary API calls on page load
      if (model) {
        const capability = StorageService.getModelCapability(model);
        if (capability) {
          setModelSupportsTools(capability.supportsFunctionCalling);
        }
      }
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

      // Test model capability after saving if model is set
      if (model) {
        const capability = StorageService.getModelCapability(model);
        if (capability) {
          setModelSupportsTools(capability.supportsFunctionCalling);
        } else {
          // Test capability for the newly saved model
          await testModelCapability(model);
        }
      }
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-5xl mx-auto p-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
            <p className="text-gray-600">Configure your AI and RAG settings</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/mcp')}
              className="px-4 py-2 text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg shadow-sm transition-all hover:shadow-md font-medium"
            >
              MCP
            </button>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg shadow-sm transition-all hover:shadow-md font-medium flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Chat
            </button>
          </div>
        </div>

        {/* AI Configuration Card */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">AI Configuration</h2>
              <p className="text-sm text-gray-600">Configure your AI model and API settings</p>
            </div>
          </div>

          {(settings?.openai?.isConfigured || hasStoredApiKey) && (
            <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl flex items-center gap-3">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-green-900">AI service is configured</p>
                <p className="text-sm text-green-700">Your API is ready to use</p>
              </div>
            </div>
          )}

          <div className="space-y-6">
            <div>
              <label htmlFor="apiKey" className="block text-sm font-semibold text-gray-800 mb-2">
                API Key <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showStoredKey ? 'text' : 'password'}
                  id="apiKey"
                  value={showStoredKey && hasStoredApiKey && !apiKey ? storedApiKey : apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={
                    settings?.openai?.isConfigured || hasStoredApiKey
                      ? '••••••••• (configured)'
                      : 'sk-...'
                  }
                  className="w-full px-4 py-3 pr-24 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm hover:border-gray-400"
                />
                {hasStoredApiKey && (
                  <button
                    type="button"
                    onClick={() => setShowStoredKey(!showStoredKey)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-md transition-all"
                  >
                    {showStoredKey ? 'Hide' : 'Show'}
                  </button>
                )}
              </div>
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <span className="font-medium">Your API key for OpenAI-compatible services</span> (OpenAI, OpenRouter, etc.)
                  {hasStoredApiKey && <span className="block mt-1 text-xs text-blue-600">Leave empty to keep existing key.</span>}
                </p>
                <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Encrypted and stored locally in your browser
                </p>
              </div>
            </div>

            <div>
              <label htmlFor="baseUrl" className="block text-sm font-semibold text-gray-800 mb-2">
                Base URL <span className="text-gray-400 text-xs font-normal">(optional)</span>
              </label>
              <input
                type="url"
                id="baseUrl"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.openai.com/v1"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm hover:border-gray-400"
              />
              <p className="mt-2 text-sm text-gray-600">
                API endpoint URL (e.g., https://api.openai.com/v1, https://openrouter.ai/api/v1)
              </p>
            </div>

          <div>
            {settings?.openai?.availableModels?.length ? (
              <Select
                id="model"
                label="Model"
                value={model}
                onChange={(newModel) => {
                  setModel(newModel);
                  // Check if we have cached capability for this model
                  const capability = StorageService.getModelCapability(newModel);
                  if (capability) {
                    setModelSupportsTools(capability.supportsFunctionCalling);
                  } else {
                    setModelSupportsTools(null);
                    // Don't auto-test on selection change - only test after saving
                  }
                }}
                options={useModelOptions(settings.openai.availableModels, true)}
                helperText="Select from available models fetched from your API provider"
                showCount={true}
              />
            ) : (
              <div>
                <label htmlFor="model" className="block text-sm font-medium text-gray-700 mb-1">
                  Model
                </label>
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
                      // Don't auto-test on input change - only test after saving
                    }
                  }}
                  placeholder="Enter model name (e.g., gpt-4, claude-3-opus)"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Enter the model name manually (API key required for model list)
                </p>
              </div>
            )}

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
              className={`mt-6 p-4 rounded-xl flex items-start gap-3 ${
                message.type === 'success'
                  ? 'bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200'
                  : 'bg-gradient-to-r from-red-50 to-rose-50 border border-red-200'
              }`}
            >
              {message.type === 'success' ? (
                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ) : (
                <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              )}
              <p className={`text-sm font-medium ${message.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>
                {message.text}
              </p>
            </div>
          )}

          <div className="mt-8 flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all shadow-md ${
                saving
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 hover:shadow-lg transform hover:-translate-y-0.5'
              }`}
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </span>
              ) : (
                'Save Settings'
              )}
            </button>

          <button
            onClick={() => {
              setConfirmDialog({
                isOpen: true,
                title: 'Clear All Settings',
                message: 'Are you sure you want to clear all stored settings? This will remove settings from both local storage and the server.',
                type: 'danger',
                onConfirm: async () => {
                  try {
                    // Clear server-side settings
                    await apiService.resetSettings();

                    // Clear local storage
                    StorageService.clearAll();

                    // Clear component state
                    setApiKey('');
                    setBaseUrl('');
                    setModel('');
                    setHasStoredApiKey(false);
                    setStoredApiKey('');
                    setShowStoredKey(false);
                    setModelSupportsTools(null);
                    setRagEmbeddingModel('');
                    setRagEmbeddingEndpoint('');
                    setRagRerankEndpoint('');
                    setRagRerankApiKey('');
                    setRagRerankForceLocal('');
                    setHasStoredRerankKey(false);
                    setStoredRerankApiKey('');
                    setShowStoredRerankKey(false);

                    setMessage({ type: 'success', text: 'All settings cleared successfully' });

                    // Reload settings to get fresh defaults
                    await loadSettings();
                  } catch (error) {
                    setMessage({
                      type: 'error',
                      text: 'Failed to clear settings: ' + (error instanceof Error ? error.message : 'Unknown error')
                    });
                  }
                  setConfirmDialog({ ...confirmDialog, isOpen: false });
                },
              });
            }}
            className="px-6 py-3 text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border-2 border-red-300 hover:border-red-400 rounded-lg font-semibold transition-all shadow-sm hover:shadow-md"
          >
            Clear All Settings
          </button>
        </div>
      </div>

      {/* RAG Configuration Section */}
      <div className="bg-white rounded-xl shadow-lg p-8 mt-6 border border-gray-200">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">RAG Configuration</h2>
            <p className="text-sm text-gray-600">Configure retrieval and reranking settings</p>
          </div>
        </div>

        {settings?.rag && (
          <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Embedding:</span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  settings.rag.embedding?.isConfigured
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {settings.rag.embedding?.isConfigured ? '✓ Configured' : 'Not configured'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Reranking:</span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  settings.rag.reranking?.isConfigured
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {settings.rag.reranking?.isConfigured ? '✓ Configured' : 'Not configured'}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Embedding Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Embedding Configuration</h3>

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
            <h3 className="text-lg font-medium text-gray-900 mb-3">Reranking Configuration</h3>

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

        <div className="mt-8 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-blue-900 mb-3">RAG Configuration Notes</h4>
              <ul className="text-sm text-blue-800 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span>Embedding models are used for document indexing and similarity search</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span>Reranking improves search relevance by reordering results</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span>Local services work offline but may have lower performance</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span>Remote services require network connectivity but offer better accuracy</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span>All settings are stored securely and persistently in your browser</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Confirm Dialog */}
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          type={confirmDialog.type}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        />
      </div>
      </div>
    </div>
  );
};
