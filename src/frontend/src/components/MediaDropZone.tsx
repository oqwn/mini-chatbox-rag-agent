import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';

interface MediaDropZoneProps {
  onFilesSelected: (files: File[]) => void;
  children: React.ReactNode;
  disabled?: boolean;
  maxFiles?: number;
  acceptedFileTypes?: string[];
}

export const MediaDropZone: React.FC<MediaDropZoneProps> = ({
  onFilesSelected,
  children,
  disabled = false,
  maxFiles = 5,
  acceptedFileTypes = [
    // Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/tiff',
    'image/svg+xml',
    // Videos
    'video/mp4',
    'video/avi',
    'video/mov',
    'video/wmv',
    'video/webm',
    'video/mkv',
    // Audio
    'audio/mp3',
    'audio/wav',
    'audio/flac',
    'audio/aac',
    'audio/ogg',
    'audio/m4a',
    'audio/wma',
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
    'application/json',
    'text/csv',
    'application/xml',
    // Code files
    'text/javascript',
    'text/typescript',
    'text/css',
    'text/html',
    'application/x-python-code',
  ],
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onFilesSelected(acceptedFiles.slice(0, maxFiles));
      }
      setIsDragOver(false);
    },
    [onFilesSelected, maxFiles]
  );

  const onDragEnter = useCallback(() => {
    setIsDragOver(true);
  }, []);

  const onDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDragEnter,
    onDragLeave,
    disabled,
    accept: acceptedFileTypes.reduce(
      (acc, type) => {
        acc[type] = [];
        return acc;
      },
      {} as Record<string, string[]>
    ),
    maxFiles,
    noClick: true, // We'll handle click events manually
  });

  return (
    <div {...getRootProps()} className="relative">
      <input {...getInputProps()} />
      {children}

      {/* Drag overlay */}
      {(isDragActive || isDragOver) && !disabled && (
        <div className="absolute inset-0 bg-blue-500 bg-opacity-10 border-2 border-blue-500 border-dashed rounded-lg flex items-center justify-center z-50">
          <div className="text-center p-6">
            <svg
              className="mx-auto h-12 w-12 text-blue-500 mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="text-blue-600 font-medium">Drop files here</p>
            <p className="text-blue-500 text-sm">Images, videos, audio, and documents</p>
          </div>
        </div>
      )}
    </div>
  );
};
