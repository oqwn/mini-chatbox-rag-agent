import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ragApiService, Document, DocumentChunk, SearchResult } from '../services/rag-api';

interface SearchState {
  query: string;
  results: SearchResult[];
  isSearching: boolean;
  searchTime: number;
  searchMethod: 'similarity' | 'rag';
}

export const DocumentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [document, setDocument] = useState<Document | null>(null);
  const [chunks, setChunks] = useState<DocumentChunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search state
  const [search, setSearch] = useState<SearchState>({
    query: '',
    results: [],
    isSearching: false,
    searchTime: 0,
    searchMethod: 'similarity',
  });

  // UI state
  const [activeTab, setActiveTab] = useState<'overview' | 'search' | 'chunks'>('search');
  const [expandedChunks, setExpandedChunks] = useState<Set<number>>(new Set());
  const [highlightedChunks, setHighlightedChunks] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!id) {
      setError('Document ID is required');
      setLoading(false);
      return;
    }
    loadDocumentData();
  }, [id]);

  const loadDocumentData = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const [documentResult, chunksResult] = await Promise.all([
        ragApiService.getDocument(parseInt(id)),
        ragApiService.getDocumentChunks(parseInt(id)),
      ]);

      setDocument(documentResult.document);
      setChunks(chunksResult.chunks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load document');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!search.query.trim()) return;

    setSearch((prev) => ({ ...prev, isSearching: true, results: [] }));
    const startTime = Date.now();

    try {
      let results: SearchResult[] = [];

      if (search.searchMethod === 'similarity') {
        // Test direct similarity search
        const response = await ragApiService.similaritySearch(
          search.query,
          undefined, // knowledgeSourceId
          10, // limit
          0.3 // threshold
        );
        results = response.results || [];
      } else {
        // Test full RAG retrieval
        const response = await ragApiService.search(search.query, {
          maxResults: 10,
          similarityThreshold: 0.3,
          useHybridSearch: true,
        });
        results = response.relevantChunks || [];
      }

      const searchTime = Date.now() - startTime;

      // Filter results to only show chunks from this document
      const documentResults = results.filter((result) => result.documentId === parseInt(id!));

      // Highlight matching chunks in the chunks view
      const matchingChunkIndices = new Set(documentResults.map((result) => result.chunkIndex));
      setHighlightedChunks(matchingChunkIndices);

      setSearch((prev) => ({
        ...prev,
        results: documentResults,
        searchTime,
        isSearching: false,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setSearch((prev) => ({ ...prev, isSearching: false }));
    }
  };

  const toggleChunkExpansion = (chunkIndex: number) => {
    const newExpanded = new Set(expandedChunks);
    if (newExpanded.has(chunkIndex)) {
      newExpanded.delete(chunkIndex);
    } else {
      newExpanded.add(chunkIndex);
    }
    setExpandedChunks(newExpanded);
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

  const renderSimilarityScore = (score: number) => {
    const percentage = (score * 100).toFixed(1);
    const colorClass =
      score > 0.8 ? 'text-green-600' : score > 0.6 ? 'text-yellow-600' : 'text-red-600';
    return <span className={`font-medium ${colorClass}`}>{percentage}%</span>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error || 'Document not found'}
          </div>
          <button onClick={() => navigate('/rag')} className="text-blue-600 hover:text-blue-900">
            ← Back to RAG Management
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Compact Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/rag')}
                className="text-gray-500 hover:text-gray-700"
              >
                ← Back
              </button>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">
                  {document.title || 'Untitled Document'}
                </h1>
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <span>{document.fileType}</span>
                  {document.fileSize && <span>{formatFileSize(document.fileSize)}</span>}
                  <span>{chunks.length} chunks</span>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <span
                className={`px-2 py-1 rounded-full text-xs font-medium ${
                  chunks.length > 0
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}
              >
                {chunks.length > 0 ? 'Processed' : 'No Chunks'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="max-w-6xl mx-auto px-4 pt-6">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8">
            {[
              { key: 'search', label: 'Test Search', icon: '🔍' },
              { key: 'chunks', label: 'View Chunks', icon: '📄' },
              { key: 'overview', label: 'Overview', icon: 'ℹ️' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {activeTab === 'search' && (
          <div className="space-y-6">
            {/* Search Interface */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Test Document Embeddings</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Search Query
                  </label>
                  <div className="flex space-x-3">
                    <input
                      type="text"
                      value={search.query}
                      onChange={(e) => setSearch((prev) => ({ ...prev, query: e.target.value }))}
                      placeholder="Enter a search query to test embeddings..."
                      className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                      onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <select
                      value={search.searchMethod}
                      onChange={(e) =>
                        setSearch((prev) => ({ ...prev, searchMethod: e.target.value as any }))
                      }
                      className="border border-gray-300 rounded-md px-3 py-2"
                    >
                      <option value="similarity">Similarity Search</option>
                      <option value="rag">RAG Retrieval</option>
                    </select>
                    <button
                      onClick={handleSearch}
                      disabled={search.isSearching || !search.query.trim()}
                      className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {search.isSearching ? 'Searching...' : 'Search'}
                    </button>
                  </div>
                </div>

                {search.results.length > 0 && (
                  <div className="text-sm text-gray-600">
                    Found {search.results.length} matching chunks in {search.searchTime}ms
                  </div>
                )}
              </div>
            </div>

            {/* Search Results */}
            {search.results.length > 0 && (
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b">
                  <h3 className="font-semibold">Search Results</h3>
                </div>
                <div className="divide-y">
                  {search.results.map((result, index) => (
                    <div key={index} className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Chunk {result.chunkIndex + 1}</span>
                        <div className="flex items-center space-x-4 text-xs">
                          <span>Similarity: {renderSimilarityScore(result.similarity)}</span>
                          {result.relevanceScore && (
                            <span>Relevance: {renderSimilarityScore(result.relevanceScore)}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-sm text-gray-700 bg-blue-50 p-3 rounded border">
                        {result.chunkText.substring(0, 300)}
                        {result.chunkText.length > 300 && '...'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {search.query && search.results.length === 0 && !search.isSearching && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800">No matching chunks found. This could mean:</p>
                <ul className="mt-2 text-sm text-yellow-700 list-disc list-inside">
                  <li>The query doesn't match the document content</li>
                  <li>The similarity threshold is too high</li>
                  <li>The embeddings haven't been generated yet</li>
                </ul>
              </div>
            )}
          </div>
        )}

        {activeTab === 'chunks' && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b">
              <h3 className="font-semibold">Document Chunks ({chunks.length})</h3>
              <p className="text-sm text-gray-600 mt-1">
                Click chunks to expand. Highlighted chunks match your search.
              </p>
            </div>
            {chunks.length > 0 ? (
              <div className="divide-y">
                {chunks.map((chunk, index) => {
                  const isHighlighted = highlightedChunks.has(chunk.chunkIndex);
                  const isExpanded = expandedChunks.has(chunk.chunkIndex);

                  return (
                    <div
                      key={chunk.id || index}
                      className={`p-4 ${isHighlighted ? 'bg-blue-50 border-l-4 border-blue-400' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => toggleChunkExpansion(chunk.chunkIndex)}
                          className="flex items-center space-x-2 text-left"
                        >
                          <span className="text-sm font-medium">
                            Chunk {chunk.chunkIndex + 1}
                            {isHighlighted && <span className="ml-2 text-blue-600">★</span>}
                          </span>
                          <span className="text-gray-400">{isExpanded ? '▼' : '▶'}</span>
                        </button>
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span>{chunk.tokenCount} tokens</span>
                          <span>{chunk.chunkText.length} chars</span>
                        </div>
                      </div>

                      <div
                        className={`mt-2 text-sm text-gray-700 ${isExpanded ? '' : 'line-clamp-2'}`}
                      >
                        {isExpanded ? (
                          <div className="whitespace-pre-wrap bg-gray-50 p-3 rounded border max-h-96 overflow-y-auto">
                            {chunk.chunkText}
                          </div>
                        ) : (
                          <div className="truncate">{chunk.chunkText.substring(0, 150)}...</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-6 py-8 text-center text-gray-500">
                No chunks found for this document.
              </div>
            )}
          </div>
        )}

        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-semibold mb-4">Document Information</h3>
              <dl className="space-y-3">
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-600">File Type:</dt>
                  <dd className="text-sm font-medium">{document.fileType || 'text'}</dd>
                </div>
                {document.fileSize && (
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-600">File Size:</dt>
                    <dd className="text-sm font-medium">{formatFileSize(document.fileSize)}</dd>
                  </div>
                )}
                {document.metadata?.ingestedAt && (
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-600">Uploaded:</dt>
                    <dd className="text-sm font-medium">
                      {formatDate(document.metadata.ingestedAt)}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-600">Total Chunks:</dt>
                  <dd className="text-sm font-medium">{chunks.length}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-600">Total Tokens:</dt>
                  <dd className="text-sm font-medium">
                    {chunks
                      .reduce((sum, chunk) => sum + (chunk.tokenCount || 0), 0)
                      .toLocaleString()}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-semibold mb-4">Processing Status</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Chunks Created:</span>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      chunks.length > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {chunks.length > 0 ? '✓ Complete' : '✗ Failed'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Embeddings:</span>
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    Ready for Testing
                  </span>
                </div>
                <div className="mt-4 p-3 bg-blue-50 rounded">
                  <p className="text-sm text-blue-800">
                    💡 Use the "Test Search" tab to verify that embeddings are working correctly by
                    searching for content from this document.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
