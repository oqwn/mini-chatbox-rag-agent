import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ragApiService, KnowledgeSource, Document, SystemInfo } from '../services/rag-api';
import { FileUpload } from '../components/FileUpload';

export const RagManagement: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'upload' | 'documents' | 'sources' | 'system'>(
    'documents'
  );
  const [knowledgeSources, setKnowledgeSources] = useState<KnowledgeSource[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Move document state
  const [movingDocumentId, setMovingDocumentId] = useState<number | null>(null);
  const [selectedKnowledgeSource, setSelectedKnowledgeSource] = useState<'all' | number>('all');

  // New Knowledge Source Form
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceDescription, setNewSourceDescription] = useState('');
  const [newSourceType, setNewSourceType] = useState('file');

  // Text ingestion form
  const [textTitle, setTextTitle] = useState('');
  const [textContent, setTextContent] = useState('');
  const [selectedSourceForText, setSelectedSourceForText] = useState<number | ''>('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [sourcesResult, documentsResult, systemResult] = await Promise.all([
        ragApiService.getKnowledgeSources(),
        ragApiService.getDocuments(),
        ragApiService.getSystemInfo(),
      ]);

      setKnowledgeSources(sourcesResult.sources);
      setDocuments(documentsResult.documents);
      setSystemInfo(systemResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKnowledgeSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceName.trim()) return;

    try {
      await ragApiService.createKnowledgeSource({
        name: newSourceName.trim(),
        description: newSourceDescription.trim() || undefined,
        sourceType: newSourceType,
      });

      setSuccess('Knowledge source created successfully');
      setNewSourceName('');
      setNewSourceDescription('');
      setNewSourceType('file');
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create knowledge source');
    }
  };

  const handleTextIngestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textTitle.trim() || !textContent.trim()) return;

    try {
      const result = await ragApiService.ingestText(
        textContent.trim(),
        textTitle.trim(),
        selectedSourceForText ? Number(selectedSourceForText) : undefined
      );

      setSuccess(
        `Text ingested successfully: ${result.chunksCreated} chunks created, ${result.totalTokens} tokens`
      );
      setTextTitle('');
      setTextContent('');
      setSelectedSourceForText('');
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to ingest text');
    }
  };

  const handleDeleteDocument = async (id: number, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;

    try {
      await ragApiService.deleteDocument(id);
      setSuccess('Document deleted successfully');
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete document');
    }
  };

  const handleMoveDocument = async (documentId: number, newKnowledgeSourceId: number | null) => {
    try {
      await ragApiService.moveDocument(documentId, newKnowledgeSourceId);
      setSuccess('Document moved successfully');
      setMovingDocumentId(null);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to move document');
    }
  };

  const getFilteredDocuments = () => {
    if (selectedKnowledgeSource === 'all') return documents;
    return documents.filter(doc => doc.knowledgeSourceId === selectedKnowledgeSource);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/chat')}
                className="mr-4 text-gray-600 hover:text-gray-900"
              >
                ← Back to Chat
              </button>
              <h1 className="text-3xl font-bold text-gray-900">RAG Management</h1>
            </div>
            <div className="text-sm text-gray-600">
              {systemInfo && (
                <span>
                  {systemInfo.database.documentsCount} documents • {systemInfo.database.chunksCount}{' '}
                  chunks
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { key: 'upload', label: 'Upload & Ingest', icon: '📁' },
              { key: 'documents', label: 'Documents', icon: '📄' },
              { key: 'sources', label: 'Knowledge Sources', icon: '🗂️' },
              { key: 'system', label: 'System Info', icon: '⚙️' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
            <span className="block sm:inline">{error}</span>
            <button
              className="absolute top-0 bottom-0 right-0 px-4 py-3"
              onClick={() => setError(null)}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {success && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative">
            <span className="block sm:inline">{success}</span>
            <button
              className="absolute top-0 bottom-0 right-0 px-4 py-3"
              onClick={() => setSuccess(null)}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {activeTab === 'upload' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* File Upload */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Upload Files</h3>
              <FileUpload
                knowledgeSources={knowledgeSources}
                onUploadSuccess={(result) => {
                  setSuccess(
                    `File uploaded successfully: ${result.chunksCreated} chunks created, ${result.totalTokens} tokens`
                  );
                  loadData();
                }}
                onUploadError={(error) => setError(error)}
              />
            </div>

            {/* Text Ingestion */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Ingest Text</h3>
              <form onSubmit={handleTextIngestion} className="space-y-4">
                <div>
                  <label htmlFor="text-title" className="block text-sm font-medium text-gray-700">
                    Title
                  </label>
                  <input
                    type="text"
                    id="text-title"
                    value={textTitle}
                    onChange={(e) => setTextTitle(e.target.value)}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Document title"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="text-source" className="block text-sm font-medium text-gray-700">
                    Knowledge Source (Optional)
                  </label>
                  <select
                    id="text-source"
                    value={selectedSourceForText}
                    onChange={(e) =>
                      setSelectedSourceForText(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select a knowledge source...</option>
                    {knowledgeSources.map((source) => (
                      <option key={source.id} value={source.id}>
                        {source.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="text-content" className="block text-sm font-medium text-gray-700">
                    Content
                  </label>
                  <textarea
                    id="text-content"
                    rows={6}
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Paste your text content here..."
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={!textTitle.trim() || !textContent.trim()}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Ingest Text
                </button>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="space-y-6">
            {/* Knowledge Base Filter */}
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Document Library</h3>
                <select
                  value={selectedKnowledgeSource}
                  onChange={(e) => setSelectedKnowledgeSource(
                    e.target.value === 'all' ? 'all' : Number(e.target.value)
                  )}
                  className="border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Knowledge Bases</option>
                  {knowledgeSources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Documents by Knowledge Base */}
            <div className="space-y-4">
              {/* Documents organized by knowledge base */}
              {knowledgeSources.map((source) => {
                const sourceDocs = documents.filter(doc => doc.knowledgeSourceId === source.id);
                if (selectedKnowledgeSource !== 'all' && selectedKnowledgeSource !== source.id) return null;
                if (sourceDocs.length === 0 && selectedKnowledgeSource !== source.id) return null;

                return (
                  <div key={source.id} className="bg-white rounded-lg shadow">
                    <div className="px-4 py-3 bg-blue-50 border-b">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-blue-900">
                          🗂️ {source.name}
                        </h4>
                        <span className="text-xs text-blue-600">
                          {sourceDocs.length} document{sourceDocs.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      {source.description && (
                        <p className="text-xs text-blue-700 mt-1">{source.description}</p>
                      )}
                    </div>
                    <ul className="divide-y divide-gray-200">
                      {sourceDocs.map((doc) => (
                        <li key={doc.id} className="px-4 py-3 hover:bg-gray-50">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center">
                                <span className="text-blue-400 mr-2">📄</span>
                                <h5 className="text-sm font-medium text-gray-900 truncate">
                                  {doc.title || 'Untitled'}
                                </h5>
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                                  {doc.fileType || 'text'}
                                </span>
                              </div>
                              <div className="mt-1 text-xs text-gray-500 space-x-3">
                                {doc.fileSize && <span>{formatFileSize(doc.fileSize)}</span>}
                                {doc.metadata?.ingestedAt && (
                                  <span>{formatDate(doc.metadata.ingestedAt)}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              {movingDocumentId === doc.id ? (
                                <div className="flex items-center space-x-2 bg-yellow-50 p-2 rounded">
                                  <span className="text-sm text-yellow-800">Move to:</span>
                                  <select
                                    onChange={(e) => {
                                      if (e.target.value !== String(source.id)) {
                                        handleMoveDocument(doc.id!, Number(e.target.value));
                                      }
                                    }}
                                    className="text-sm border-yellow-300 rounded bg-white"
                                    defaultValue={source.id}
                                  >
                                    {knowledgeSources.map((s) => (
                                      <option key={s.id} value={s.id}>
                                        {s.name}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    onClick={() => setMovingDocumentId(null)}
                                    className="text-yellow-600 hover:text-yellow-800 text-sm px-2 py-1 bg-white border border-yellow-300 rounded"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <button
                                    onClick={() => navigate(`/rag/documents/${doc.id}`)}
                                    className="text-blue-600 hover:text-blue-900 text-sm px-2 py-1 hover:bg-blue-50 rounded"
                                  >
                                    📖 View
                                  </button>
                                  <button
                                    onClick={() => setMovingDocumentId(doc.id!)}
                                    className="text-purple-600 hover:text-purple-900 text-sm px-2 py-1 hover:bg-purple-50 rounded"
                                  >
                                    🔄 Move
                                  </button>
                                  <button
                                    onClick={() => handleDeleteDocument(doc.id!, doc.title || 'Untitled')}
                                    className="text-red-600 hover:text-red-900 text-sm px-2 py-1 hover:bg-red-50 rounded"
                                  >
                                    🗑️ Delete
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </li>
                      ))}
                      {sourceDocs.length === 0 && (
                        <li className="px-4 py-6 text-center text-gray-500 text-sm">
                          No documents in this knowledge base yet.
                        </li>
                      )}
                    </ul>
                  </div>
                );
              })}

              {getFilteredDocuments().length === 0 && (
                <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                  <p>No documents found.</p>
                  <button
                    onClick={() => setActiveTab('upload')}
                    className="mt-4 text-blue-600 hover:text-blue-900"
                  >
                    Upload your first document →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'sources' && (
          <div className="space-y-6">
            {/* Create New Knowledge Source */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Create Knowledge Source</h3>
              <form onSubmit={handleCreateKnowledgeSource} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="source-name"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Name
                    </label>
                    <input
                      type="text"
                      id="source-name"
                      value={newSourceName}
                      onChange={(e) => setNewSourceName(e.target.value)}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., Company Documentation"
                      required
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="source-type"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Type
                    </label>
                    <select
                      id="source-type"
                      value={newSourceType}
                      onChange={(e) => setNewSourceType(e.target.value)}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="file">File Upload</option>
                      <option value="manual">Manual Entry</option>
                      <option value="api">API Integration</option>
                      <option value="web">Web Scraping</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="source-description"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Description (Optional)
                  </label>
                  <textarea
                    id="source-description"
                    rows={3}
                    value={newSourceDescription}
                    onChange={(e) => setNewSourceDescription(e.target.value)}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Describe what kind of documents this source contains..."
                  />
                </div>
                <button
                  type="submit"
                  disabled={!newSourceName.trim()}
                  className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Knowledge Source
                </button>
              </form>
            </div>

            {/* Existing Knowledge Sources */}
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <div className="px-4 py-5 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Knowledge Sources</h3>
              </div>
              <ul className="divide-y divide-gray-200">
                {knowledgeSources.map((source) => (
                  <li key={source.id} className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">{source.name}</h4>
                        {source.description && (
                          <p className="text-sm text-gray-600 mt-1">{source.description}</p>
                        )}
                        <div className="mt-1 flex items-center space-x-2">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {source.sourceType}
                          </span>
                          <span className="text-xs text-gray-500">
                            {documents.filter((d) => d.knowledgeSourceId === source.id).length}{' '}
                            documents
                          </span>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
                {knowledgeSources.length === 0 && (
                  <li className="px-4 py-8 text-center text-gray-500">
                    No knowledge sources found. Create one to organize your documents.
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'system' && systemInfo && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Database Stats */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Database</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Documents:</span>
                  <span className="text-sm font-medium">{systemInfo.database.documentsCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Chunks:</span>
                  <span className="text-sm font-medium">{systemInfo.database.chunksCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Knowledge Sources:</span>
                  <span className="text-sm font-medium">
                    {systemInfo.database.knowledgeSourcesCount}
                  </span>
                </div>
              </div>
            </div>

            {/* Embedding Info */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Embeddings</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Model:</span>
                  <span className="text-sm font-medium">{systemInfo.embedding.defaultModel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Dimensions:</span>
                  <span className="text-sm font-medium">{systemInfo.embedding.dimensions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Max Tokens:</span>
                  <span className="text-sm font-medium">
                    {systemInfo.embedding.maxTokens.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Status:</span>
                  <span
                    className={`text-sm font-medium ${systemInfo.embedding.isConfigured ? 'text-green-600' : 'text-red-600'}`}
                  >
                    {systemInfo.embedding.isConfigured ? 'Configured' : 'Not Configured'}
                  </span>
                </div>
              </div>
            </div>

            {/* System Status */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900 mb-4">System</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Status:</span>
                  <span className="text-sm font-medium text-green-600">
                    {systemInfo.system.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Average Chunk Size:</span>
                  <span className="text-sm font-medium">
                    {systemInfo.retrieval.averageChunkSize} chars
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Embedding Coverage:</span>
                  <span className="text-sm font-medium">
                    {(systemInfo.retrieval.embeddingCoverage * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-4">
                  Last updated: {formatDate(systemInfo.system.timestamp)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
