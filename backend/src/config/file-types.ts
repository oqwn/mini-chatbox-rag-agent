// Shared file types configuration for backend
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

export const FILE_CONFIG: SupportedFileTypesConfig = {
  supportedFileTypes: {
    documents: {
      extensions: [".pdf", ".docx", ".doc", ".txt", ".md", ".rtf"],
      description: "Document files"
    },
    data: {
      extensions: [".json", ".csv", ".tsv", ".xml", ".yaml", ".yml", ".ini", ".conf", ".toml"],
      description: "Data and configuration files"
    },
    code: {
      extensions: [
        ".js", ".ts", ".jsx", ".tsx", ".py", ".java", ".cpp", ".c", ".h", ".hpp",
        ".css", ".scss", ".sass", ".less", ".html", ".htm", ".php", ".rb", ".go",
        ".rs", ".swift", ".kt", ".scala", ".pl", ".r", ".m", ".tex", ".vue",
        ".sql", ".sh", ".bat", ".ps1", ".dockerfile", ".makefile"
      ],
      description: "Source code files"
    },
    other: {
      extensions: [".log", ".gitignore", ".env", ".properties", ".cfg"],
      description: "Other text files"
    }
  },
  limits: {
    maxFileSize: 52428800,
    maxFileSizeMB: 50,
    maxFileSizeDisplay: "50MB"
  }
};

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