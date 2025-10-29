import React from 'react';
import { MediaAttachment } from '../types/multimodal';

interface MediaAttachmentPreviewProps {
  attachment: MediaAttachment;
  onRemove?: () => void;
  showAnalysis?: boolean;
}

export const MediaAttachmentPreview: React.FC<MediaAttachmentPreviewProps> = ({
  attachment,
  onRemove,
  showAnalysis = false,
}) => {
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case 'image':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        );
      case 'video':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        );
      case 'audio':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
            />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        );
    }
  };

  const getStatusColor = () => {
    if (attachment.error) return 'text-red-600';
    if (attachment.processing) return 'text-yellow-600';
    if (attachment.processed) return 'text-green-600';
    return 'text-gray-600';
  };

  const getStatusText = () => {
    if (attachment.error) return 'Error';
    if (attachment.processing) return 'Processing...';
    if (attachment.processed) return 'Processed';
    return 'Ready';
  };

  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-white shadow-sm">
      <div className="flex items-start space-x-3">
        {/* Preview */}
        <div className="flex-shrink-0">
          {attachment.type === 'image' && attachment.url ? (
            <img
              src={attachment.url}
              alt={attachment.name}
              className="w-12 h-12 object-cover rounded"
            />
          ) : (
            <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
              {getIconForType(attachment.type)}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-900 truncate">{attachment.name}</p>
            {onRemove && (
              <button
                onClick={onRemove}
                className="ml-2 p-1 hover:bg-gray-100 rounded"
                title="Remove attachment"
              >
                <svg
                  className="w-4 h-4 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2 mt-1">
            <span className="text-xs text-gray-500">{formatFileSize(attachment.size)}</span>
            <span className="text-xs text-gray-400">•</span>
            <span className={`text-xs ${getStatusColor()}`}>{getStatusText()}</span>
          </div>

          {attachment.processing && (
            <div className="mt-2">
              <div className="w-full bg-gray-200 rounded-full h-1">
                <div
                  className="bg-blue-500 h-1 rounded-full animate-pulse"
                  style={{ width: '60%' }}
                />
              </div>
            </div>
          )}

          {attachment.error && <p className="mt-1 text-xs text-red-600">{attachment.error}</p>}

          {showAnalysis && attachment.analysis && (
            <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
              {attachment.analysis.extractedText && (
                <div>
                  <span className="font-medium">Extracted text:</span>
                  <p className="text-gray-600 mt-1 line-clamp-3">
                    {attachment.analysis.extractedText.substring(0, 200)}
                    {attachment.analysis.extractedText.length > 200 ? '...' : ''}
                  </p>
                </div>
              )}
              {attachment.analysis.description && (
                <div className="mt-2">
                  <span className="font-medium">Analysis:</span>
                  <p className="text-gray-600 mt-1">{attachment.analysis.description}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
