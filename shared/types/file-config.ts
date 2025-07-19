export interface FileTypeCategory {
  extensions: string[];
  description: string;
}

export interface SupportedFileTypesConfig {
  supportedFileTypes: {
    documents: FileTypeCategory;
    data: FileTypeCategory;
    code: FileTypeCategory;
    other: FileTypeCategory;
  };
  limits: {
    maxFileSize: number;
    maxFileSizeMB: number;
    maxFileSizeDisplay: string;
  };
}

// Import the JSON config
import configJson from '../supported-file-types.json';

export const FILE_CONFIG: SupportedFileTypesConfig = configJson;

// Helper function to get all supported extensions
export function getAllSupportedExtensions(): string[] {
  const { supportedFileTypes } = FILE_CONFIG;
  return [
    ...supportedFileTypes.documents.extensions,
    ...supportedFileTypes.data.extensions,
    ...supportedFileTypes.code.extensions,
    ...supportedFileTypes.other.extensions
  ];
}

// Helper function to check if a file type is supported
export function isFileTypeSupported(filename: string): boolean {
  const ext = '.' + filename.split('.').pop()?.toLowerCase();
  return getAllSupportedExtensions().includes(ext);
}

// Helper function to get file extension
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? '.' + parts.pop()!.toLowerCase() : '';
}