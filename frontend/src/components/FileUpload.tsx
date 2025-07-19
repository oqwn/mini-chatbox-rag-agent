import React, { useState, useRef } from 'react';
import { KnowledgeSource, IngestionResult } from '../services/rag-api';
import { FILE_CONFIG, getAllSupportedExtensions, isFileTypeSupported } from '../config/file-types';

interface FileUploadProps {
  knowledgeSources: KnowledgeSource[];
  onUploadSuccess?: (result: IngestionResult) => void;
  onUploadError?: (error: string) => void;
  className?: string;
}

interface UploadProgress {
  fileName: string;
  stage: 'uploading' | 'parsing' | 'chunking' | 'embedding' | 'storing' | 'completed' | 'error';
  progress: number;
  uploadProgress?: number;
  processingProgress?: number;
  error?: string;
  startTime: number;
  fileSize: number;
  chunksCreated?: number;
  tokensProcessed?: number;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  knowledgeSources,
  onUploadSuccess,
  onUploadError,
  className = '',
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [selectedKnowledgeSource, setSelectedKnowledgeSource] = useState<number | ''>('');
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supportedTypes = getAllSupportedExtensions();

  const updateProgress = (fileName: string, updates: Partial<UploadProgress>) => {
    setUploadProgress(prev =>
      prev.map(p => p.fileName === fileName ? { ...p, ...updates } : p)
    );
  };

  const uploadFileWithProgress = async (file: File): Promise<IngestionResult> => {
    const fileName = file.name;
    const startTime = Date.now();

    // Initialize progress tracking
    const initialProgress: UploadProgress = {
      fileName,
      stage: 'uploading',
      progress: 0,
      uploadProgress: 0,
      processingProgress: 0,
      startTime,
      fileSize: file.size,
    };

    setUploadProgress(prev => [...prev, initialProgress]);

    try {
      // Create FormData for upload with progress tracking
      const formData = new FormData();
      formData.append('file', file);
      
      if (selectedKnowledgeSource) {
        formData.append('knowledgeSourceId', selectedKnowledgeSource.toString());
      }
      
      formData.append('metadata', JSON.stringify({
        originalFileName: file.name,
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
      }));

      // Use XMLHttpRequest for upload progress tracking
      const result = await new Promise<IngestionResult>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        // Track upload progress
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const uploadProgress = Math.round((event.loaded / event.total) * 100);
            updateProgress(fileName, {
              uploadProgress,
              progress: Math.round(uploadProgress * 0.3), // Upload is 30% of total progress
            });
          }
        });

        // Track response loading
        xhr.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const responseProgress = Math.round((event.loaded / event.total) * 100);
            updateProgress(fileName, {
              stage: 'parsing',
              progress: 30 + Math.round(responseProgress * 0.2), // Parsing is 20% of total
            });
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              
              // Simulate processing stages for better UX
              updateProgress(fileName, { stage: 'chunking', progress: 60 });
              setTimeout(() => {
                updateProgress(fileName, { stage: 'embedding', progress: 80 });
                setTimeout(() => {
                  updateProgress(fileName, { 
                    stage: 'storing', 
                    progress: 95,
                    chunksCreated: response.chunksCreated,
                    tokensProcessed: response.totalTokens
                  });
                  setTimeout(() => {
                    updateProgress(fileName, { stage: 'completed', progress: 100 });
                    resolve(response);
                  }, 200);
                }, 300);
              }, 200);
            } catch (error) {
              reject(new Error('Invalid response format'));
            }
          } else {
            try {
              const errorResponse = JSON.parse(xhr.responseText);
              reject(new Error(errorResponse.error || `HTTP ${xhr.status}`));
            } catch {
              reject(new Error(`HTTP ${xhr.status}`));
            }
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Network error occurred'));
        });

        xhr.addEventListener('timeout', () => {
          reject(new Error('Upload timeout'));
        });

        xhr.open('POST', `${import.meta.env.VITE_API_URL || 'http://localhost:20001'}/api/rag/ingest/file`);
        xhr.timeout = 300000; // 5 minutes timeout for large files
        xhr.send(formData);
      });

      return result;
    } catch (error) {
      updateProgress(fileName, {
        stage: 'error',
        progress: 0,
        error: error instanceof Error ? error.message : 'Upload failed'
      });
      throw error;
    }
  };

  const handleFiles = async (files: FileList) => {
    if (files.length === 0) return;

    setIsUploading(true);
    setUploadProgress([]);

    try {
      // Validate all files first
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Check if file has an extension
        if (!file.name.includes('.')) {
          throw new Error(`File ${file.name} must have an extension`);
        }
        
        // Check file type using shared config
        if (!isFileTypeSupported(file.name)) {
          const extension = '.' + file.name.split('.').pop()?.toLowerCase();
          throw new Error(
            `Unsupported file type: ${extension}. Supported types: ${supportedTypes.join(', ')}`
          );
        }

        // Check file size using shared config
        if (file.size > FILE_CONFIG.limits.maxFileSize) {
          throw new Error(`File too large: ${file.name}. Maximum size is ${FILE_CONFIG.limits.maxFileSizeDisplay}.`);
        }
      }

      const results: IngestionResult[] = [];

      // Process files in parallel for better performance (max 3 concurrent uploads)
      const concurrency = Math.min(3, files.length);
      const batches: File[][] = [];
      
      for (let i = 0; i < files.length; i += concurrency) {
        batches.push(Array.from(files).slice(i, i + concurrency));
      }

      for (const batch of batches) {
        const batchResults = await Promise.all(
          batch.map(file => uploadFileWithProgress(file))
        );
        results.push(...batchResults);
      }

      // Report aggregated success
      const totalChunks = results.reduce((sum, r) => sum + r.chunksCreated, 0);
      const totalTokens = results.reduce((sum, r) => sum + r.totalTokens, 0);

      if (onUploadSuccess) {
        onUploadSuccess({
          success: true,
          documentId: results[0].documentId,
          chunksCreated: totalChunks,
          totalTokens: totalTokens,
          processingTime: results.reduce((sum, r) => sum + r.processingTime, 0),
        });
      }

      // Clear progress after 3 seconds
      setTimeout(() => {
        setUploadProgress([]);
      }, 3000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      if (onUploadError) {
        onUploadError(errorMessage);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getStageLabel = (stage: UploadProgress['stage']): string => {
    switch (stage) {
      case 'uploading': return 'Uploading...';
      case 'parsing': return 'Parsing content...';
      case 'chunking': return 'Creating chunks...';
      case 'embedding': return 'Generating embeddings...';
      case 'storing': return 'Storing in database...';
      case 'completed': return 'Completed!';
      case 'error': return 'Error';
      default: return 'Processing...';
    }
  };

  const getStageColor = (stage: UploadProgress['stage']): string => {
    switch (stage) {
      case 'completed': return 'text-green-600';
      case 'error': return 'text-red-600';
      default: return 'text-blue-600';
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Knowledge Source Selection */}
      <div>
        <label htmlFor="knowledge-source" className="block text-sm font-medium text-gray-700 mb-2">
          Knowledge Source (Optional)
        </label>
        <select
          id="knowledge-source"
          value={selectedKnowledgeSource}
          onChange={(e) =>
            setSelectedKnowledgeSource(e.target.value === '' ? '' : Number(e.target.value))
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isUploading}
        >
          <option value="">Select a knowledge source...</option>
          {knowledgeSources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.name}
            </option>
          ))}
        </select>
      </div>

      {/* File Drop Zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive
            ? 'border-blue-400 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        } ${isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          accept={supportedTypes.join(',')}
          disabled={isUploading}
        />
        
        <div className="space-y-2">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="text-gray-600">
            <span className="font-medium text-blue-600 hover:text-blue-500">
              Click to upload
            </span>{' '}
            or drag and drop
          </div>
          <p className="text-xs text-gray-500">
            Supports documents, code files, and text formats (Max {FILE_CONFIG.limits.maxFileSizeDisplay} per file)
          </p>
        </div>
      </div>

      {/* Progress Display */}
      {uploadProgress.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-900">Upload Progress</h4>
          {uploadProgress.map((progress, index) => (
            <div key={index} className="border rounded-lg p-4 bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {progress.fileName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(progress.fileSize)} • {formatDuration(Date.now() - progress.startTime)}
                  </p>
                </div>
                <div className="ml-4 flex-shrink-0">
                  <span className={`text-xs font-medium ${getStageColor(progress.stage)}`}>
                    {getStageLabel(progress.stage)}
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    progress.stage === 'completed' 
                      ? 'bg-green-500' 
                      : progress.stage === 'error'
                      ? 'bg-red-500'
                      : 'bg-blue-500'
                  }`}
                  style={{ width: `${progress.progress}%` }}
                />
              </div>

              {/* Detailed Progress */}
              <div className="flex justify-between text-xs text-gray-500">
                <span>{progress.progress}% complete</span>
                {progress.chunksCreated && progress.tokensProcessed && (
                  <span>
                    {progress.chunksCreated} chunks • {progress.tokensProcessed.toLocaleString()} tokens
                  </span>
                )}
              </div>

              {/* Error Message */}
              {progress.error && (
                <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                  {progress.error}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload Button */}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className={`w-full px-4 py-2 text-sm font-medium rounded-md transition-colors ${
          isUploading
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500'
        }`}
      >
        {isUploading ? 'Processing Files...' : 'Choose Files'}
      </button>
    </div>
  );
};