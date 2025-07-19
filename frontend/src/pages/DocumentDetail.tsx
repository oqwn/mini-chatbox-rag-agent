import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ragApiService, Document, DocumentChunk } from '../services/rag-api';

export const DocumentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [document, setDocument] = useState<Document | null>(null);
  const [chunks, setChunks] = useState<DocumentChunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error || 'Document not found'}
          </div>
          <button
            onClick={() => navigate('/rag')}
            className="mt-4 text-blue-600 hover:text-blue-900"
          >
            ← Back to RAG Management
          </button>
        </div>
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
                onClick={() => navigate('/rag')}
                className="mr-4 text-gray-600 hover:text-gray-900"
              >
                ← Back to RAG Management
              </button>
              <h1 className="text-3xl font-bold text-gray-900">Document Details</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Document Info */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              {document.title || 'Untitled Document'}
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Document information and content chunks
            </p>
          </div>
          <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
            <dl className="sm:divide-y sm:divide-gray-200">
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">File Type</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    {document.fileType || 'text'}
                  </span>
                </dd>
              </div>
              {document.fileSize && (
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">File Size</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {formatFileSize(document.fileSize)}
                  </dd>
                </div>
              )}
              {document.filePath && (
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Original Path</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 font-mono text-xs">
                    {document.filePath}
                  </dd>
                </div>
              )}
              {document.metadata?.ingestedAt && (
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Uploaded</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {formatDate(document.metadata.ingestedAt)}
                  </dd>
                </div>
              )}
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Content Chunks</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {chunks.length} chunks
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Document Chunks */}
        <div className="mt-8">
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Content Chunks</h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                Text chunks extracted from the document for vector search
              </p>
            </div>
            <div className="border-t border-gray-200">
              {chunks.length > 0 ? (
                <div className="space-y-4 p-4">
                  {chunks.map((chunk, index) => (
                    <div key={chunk.id || index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-900">
                          Chunk {chunk.chunkIndex + 1}
                        </span>
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span>{chunk.tokenCount} tokens</span>
                          <span>{chunk.chunkText.length} chars</span>
                        </div>
                      </div>
                      <div className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded border max-h-64 overflow-y-auto">
                        {chunk.chunkText}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-8 text-center text-gray-500">
                  No chunks found for this document.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
