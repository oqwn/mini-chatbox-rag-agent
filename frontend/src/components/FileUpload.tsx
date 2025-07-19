import React, { useState, useRef } from 'react';
import { ragApiService, KnowledgeSource, IngestionResult } from '../services/rag-api';

interface FileUploadProps {
  knowledgeSources: KnowledgeSource[];
  onUploadSuccess?: (result: IngestionResult) => void;
  onUploadError?: (error: string) => void;
  className?: string;
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supportedTypes = [
    // Documents
    '.pdf',
    '.docx',
    '.doc',
    '.txt',
    '.md',
    '.rtf',
    // Data & Config
    '.json',
    '.csv',
    '.tsv',
    '.xml',
    '.yaml',
    '.yml',
    '.ini',
    '.conf',
    '.toml',
    // Code files
    '.js',
    '.ts',
    '.jsx',
    '.tsx',
    '.py',
    '.java',
    '.cpp',
    '.c',
    '.h',
    '.hpp',
    '.css',
    '.scss',
    '.sass',
    '.less',
    '.html',
    '.htm',
    '.php',
    '.rb',
    '.go',
    '.rs',
    '.swift',
    '.kt',
    '.scala',
    '.pl',
    '.r',
    '.m',
    '.tex',
    '.vue',
    '.sql',
    '.sh',
    '.bat',
    '.ps1',
    '.dockerfile',
    '.makefile',
    // Other text files
    '.log',
    '.gitignore',
    '.env',
    '.properties',
    '.cfg',
  ];

  const handleFiles = async (files: FileList) => {
    if (files.length === 0) return;

    setIsUploading(true);

    try {
      const results: IngestionResult[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Check file type
        const extension = '.' + file.name.split('.').pop()?.toLowerCase();
        if (!supportedTypes.includes(extension)) {
          throw new Error(
            `Unsupported file type: ${extension}. Supported types: ${supportedTypes.join(', ')}`
          );
        }

        // Check file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`File too large: ${file.name}. Maximum size is 10MB.`);
        }

        const result = await ragApiService.uploadFile(
          file,
          selectedKnowledgeSource ? Number(selectedKnowledgeSource) : undefined,
          {
            originalFileName: file.name,
            fileSize: file.size,
            uploadedAt: new Date().toISOString(),
          }
        );

        results.push(result);
      }

      // Report success
      const totalChunks = results.reduce((sum, r) => sum + r.chunksCreated, 0);
      const totalTokens = results.reduce((sum, r) => sum + r.totalTokens, 0);

      if (onUploadSuccess) {
        onUploadSuccess({
          success: true,
          documentId: results[0].documentId, // Use first document ID
          chunksCreated: totalChunks,
          totalTokens: totalTokens,
          processingTime: results.reduce((sum, r) => sum + r.processingTime, 0),
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      if (onUploadError) {
        onUploadError(errorMessage);
      }
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Knowledge Source Selection */}
      <div className="mb-4">
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
              {source.name} ({source.sourceType})
            </option>
          ))}
        </select>
      </div>

      {/* File Upload Area */}
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center transition-colors
          ${dragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={openFileDialog}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={supportedTypes.join(',')}
          onChange={handleFileSelect}
          className="hidden"
          disabled={isUploading}
        />

        {isUploading ? (
          <div className="space-y-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-sm text-gray-600">Uploading and processing files...</p>
          </div>
        ) : (
          <div className="space-y-2">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="text-sm text-gray-600">
              <button className="font-medium text-blue-600 hover:text-blue-500">
                Click to upload files
              </button>
              <span> or drag and drop</span>
            </div>
            <p className="text-xs text-gray-500">
              Support for text files, code, markdown, and more (Max 10MB each)
            </p>
          </div>
        )}
      </div>

      {/* Supported File Types */}
      <div className="mt-3">
        <details className="text-xs text-gray-500">
          <summary className="cursor-pointer hover:text-gray-700">
            Supported file types ({supportedTypes.length} formats)
          </summary>
          <div className="mt-2 pl-4">
            <div className="grid grid-cols-8 gap-1">
              {supportedTypes.map((type) => (
                <span key={type} className="text-xs bg-gray-100 px-1 py-0.5 rounded">
                  {type}
                </span>
              ))}
            </div>
          </div>
        </details>
      </div>
    </div>
  );
};
